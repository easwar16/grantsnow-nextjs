import "server-only";
import { cache } from "react";
import { z } from "zod";
import { authenticate } from "@/server/identity/session/service";
import { lookups, roles as recordRoles } from "@/server/oracle/api";
import { recordId, recordRoleRows } from "@/server/record/shared";
import type { AttachmentHost } from "@/server/record/attachments/attachments";
import { AppError } from "@/lib/errors";
import { serverFunctions } from "@/server/functions";
import {
  FUND_MODULE,
  fundTabs,
  pageOf,
  type FundRecordFilters,
  type FundTab,
} from "@/shared/claims/fund-record";

export const fundRecordIdentity = z.object({
  id: recordId,
  tab: z.enum(fundTabs),
});

/**
 * One fund's record (legacy claims-funds-inquiry-info-page vbBeforeEnter): the drawer grant, then the fund's own
 * CLAIM_FUNDS roles. Legacy refused no roles or Summary read N; a missing Summary row is refused too (fail closed).
 */
export const fundRecordContext = cache(async (id: string) => {
  if (!recordId.safeParse(id).success)
    throw new AppError("BAD_REQUEST", "Invalid fund identity.", 400);
  const { session, user } = await authenticate();
  serverFunctions.permissions.requireDrawerAccess(user, "claims-funds-inquiry");
  const access = serverFunctions.permissions.objectAccessOf(
    recordRoleRows.parse(
      await recordRoles.record({ objectType: FUND_MODULE, objectId: id }),
    ).items,
  );
  if (access.roles.get(pageOf("summary"))?.read !== true)
    throw new AppError("FORBIDDEN", "You don't have access to this fund", 403);
  return {
    session,
    user,
    id,
    access,
    // Legacy getTabs: a tab shows when its page has read access.
    tabs: fundTabs.filter(
      (tab) => access.roles.get(pageOf(tab))?.read === true,
    ),
  };
});
export type FundRecordContext = Awaited<ReturnType<typeof fundRecordContext>>;

/** A tab the record does not show is refused, as getTabs hides it and subFlowAccessGuard turns it away. */
export async function fundRecordRead(id: string, tab: FundTab) {
  const context = await fundRecordContext(id);
  if (!context.tabs.includes(tab))
    throw new AppError(
      "FORBIDDEN",
      "You do not have access to this page.",
      403,
    );
  return context;
}

const lookupRow = z.object({
  lookup_type_code: z.string().nullish(),
  lookup_code: z.union([z.string(), z.number()]).nullish(),
  lookup_code_value: z.string().nullish(),
});
type Option = { value: string; label: string };
/** The filter bar's function and object codes (legacy loadLookups), held for the session as lookups are. */
export const fundFilterChoices = cache(async () => {
  const items = z
    .object({ items: z.array(lookupRow) })
    .parse(
      await lookups.codes({ types: "FPCG_FUNCTION_CODE,FPCG_OBJECT_CODE" }),
    ).items;
  const of = (type: string): Option[] =>
    items.flatMap((r) =>
      r.lookup_type_code === type && r.lookup_code != null
        ? [
            {
              value: String(r.lookup_code),
              label: r.lookup_code_value || String(r.lookup_code),
            },
          ]
        : [],
    );
  return {
    functions: of("FPCG_FUNCTION_CODE"),
    objects: of("FPCG_OBJECT_CODE"),
  };
});

/**
 * The filters a tab reads with: each empty one is its list's first code (legacy loadLookups' default, so Budget and
 * Claims never open unfiltered); a code the list does not offer is refused.
 */
export async function resolvedFilters(f: FundRecordFilters) {
  const { functions, objects } = await fundFilterChoices();
  const pick = (value: string, options: Option[]) => {
    if (value === "") return options[0]?.value ?? "";
    if (!options.some((o) => o.value === value))
      throw new AppError("BAD_REQUEST", "Unknown filter value.", 400);
    return value;
  };
  return {
    func: pick(f.func, functions),
    object: pick(f.object, objects),
    status: f.status || "APPROVED",
  };
}

/**
 * The Attachments tab as an attachments host (legacy object-attachments with CLAIM_FUNDS, the fund id as its folder):
 * upload and delete with edit access on `claims-funds-attachments`; funds inquiry has no draft or lock.
 */
export async function fundAttachmentHost(
  id: string,
  mode: "read" | "view" | "edit",
): Promise<AttachmentHost> {
  const context = await fundRecordRead(id, "attachments");
  const canEdit =
    context.access.roles.get(pageOf("attachments"))?.edit === true;
  if (mode === "edit" && !canEdit)
    throw new AppError(
      "FORBIDDEN",
      "You do not have access to change these attachments.",
      403,
    );
  return {
    objectType: FUND_MODULE,
    objectId: id,
    objectNumber: id,
    pathSegment: FUND_MODULE,
    bundle: "claims",
    token: context.session.token,
    user: context.user,
    canEdit: mode !== "read" && canEdit,
  };
}
