import "server-only";
import { z } from "zod";
import { objects } from "@/server/oracle/api";
import { resources } from "@/server/platform/configuration/resources";
import { legacyDeepLink } from "@/shared/auth/legacy-link";
import type {
  LinkedGroup,
  LinkedObjects,
  LinkedTextKey,
} from "@/features/record/linked/model";
import { serverFunctions } from "@/server/functions";

/** Legacy linkedModulesDialog reads the ETHICS bundle wherever it opens (awards, ethics, contracts). */
const BUNDLE = "ethics";
/** The dialog's sections in legacy order (LinkedButtonActionChain): group key, the MODULE_NAMEs it takes, fallback. */
const GROUPS: [string, string[], string][] = [
  ["parent-proposal", ["PROPOSAL", "OUTLINE_PROPOSAL"], "Parent Proposal"],
  ["sub-proposals", ["SUB_PROPOSAL"], "Sub Proposals"],
  ["extended-proposals", ["EXTENSION_PROPOSAL"], "Extended Proposals"],
  [
    "extended-sub-proposal",
    ["EXTENSION_SUB_PROPOSAL"],
    "Extended Sub Proposal",
  ],
  ["awards", ["AWARD"], "Awards"],
  ["contracts", ["CONTRACT"], "Contracts"],
  ["ethics", ["ETHICS"], "Ethics"],
  ["due-diligence", ["DUE_DILIGENCE"], "Due Diligence"],
];
const TEXTS: Record<LinkedTextKey, [string, string, string]> = {
  title: ["dialog-titles", "linked-objects", "Linked Objects"],
  updatedBy: ["labels", "last-updated-by", "Last Updated by"],
  updated: ["labels", "last-update-date", "Last Update Date"],
  noData: ["helper-texts", "no-data", "No data to display."],
  view: ["button-labels", "view", "View"],
  none: ["labels", "no-linked-data-found", "No Linked Data Found"],
};

const text = z
  .union([z.string(), z.number()])
  .nullish()
  .transform((v) =>
    v === null || v === undefined || v === "" ? undefined : String(v),
  );
const linkRow = z.object({
  MODULE_NAME: z.string().nullish(),
  OBJECT_ID: z.union([z.string(), z.number()]).nullish(),
  OBJECT_NAME: text,
  OBJECT_STATUS: text,
  OBJECT_TITLE: text,
  LAST_UPDATED_BY: text,
  LAST_UPDATE_DATE: text,
  OBJECT_LINK: z.string().nullish(),
});
const body = z.object({ ObjectLinks: z.array(linkRow).nullish() });

/** A legacy VBCS link to the record, as the in-app route it maps to (H26); null when it is not one. */
function inAppHref(link: string | null | undefined) {
  if (!link) return undefined;
  try {
    return (
      legacyDeepLink(new URL(link, "https://local.invalid").search) ?? undefined
    );
  } catch {
    return undefined;
  }
}

/** Groups an objectLinked reply; the object itself is left out of its own module's group, as legacy does for awards. */
export function linkedGroups(
  raw: unknown,
  self: { module: string; id: number },
  labelOf: (key: string, fallback: string) => string,
): LinkedGroup[] {
  const rows = body.parse(raw).ObjectLinks ?? [];
  return GROUPS.flatMap(([key, modules, fallback]) => {
    const records = rows
      .filter(
        (r) =>
          modules.includes(r.MODULE_NAME ?? "") &&
          !(r.MODULE_NAME === self.module && Number(r.OBJECT_ID) === self.id),
      )
      .map((r, i) => ({
        id: `${key}-${r.OBJECT_ID ?? i}`,
        name: r.OBJECT_NAME ?? "",
        status: r.OBJECT_STATUS,
        title: r.OBJECT_TITLE,
        updatedBy: r.LAST_UPDATED_BY,
        updated: r.LAST_UPDATE_DATE,
        href: inAppHref(r.OBJECT_LINK),
      }));
    return records.length
      ? [{ key, label: labelOf(key, fallback), records }]
      : [];
  });
}

/** The records linked to an object. The caller has already checked the user may see the object. */
export async function linkedObjects(
  self: { module: string; id: number },
  none: { bundle: string; key: string; fallback: string },
): Promise<LinkedObjects> {
  const [raw, rows] = await Promise.all([
    objects.linked({ objectType: self.module, objectId: self.id }),
    resources(),
  ]);
  const t = (group: string, key: string, fallback: string) =>
    serverFunctions.resources.label(rows, BUNDLE, group, key, fallback);
  return {
    groups: linkedGroups(raw, self, (key, fallback) =>
      t("labels", key, fallback),
    ),
    texts: {
      ...(Object.fromEntries(
        Object.entries(TEXTS).map(([k, [group, key, fallback]]) => [
          k,
          t(group, key, fallback),
        ]),
      ) as Record<LinkedTextKey, string>),
      none: serverFunctions.resources.label(
        rows,
        none.bundle,
        "labels",
        none.key,
        none.fallback,
      ),
    },
  };
}
