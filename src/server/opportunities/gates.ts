import "server-only";
import { cache } from "react";
import { z } from "zod";
import { authenticate } from "@/server/session/service";
import { oracle } from "@/server/api/transport";
import { AppError } from "@/lib/errors";
import {
  label,
  resourceRequired,
  resourceVisible,
  type Resources,
} from "@/server/configuration/resources";
import type { CardActions } from "@/features/opportunities/types";
export type Opener = CardActions["opener"];
export type ConvertKind = "OUTLINE_PROPOSAL" | "PROPOSAL";
export type RoleRow = {
  page_name: string;
  read_access: string | null;
  edit_access?: string | null;
};
export const bundleOf = (opener: Opener) =>
  opener === "finder" ? "opportunities-eoi" : "dashboard";
/** Role based: every row for the page must grant it; no rows (or no roles read) denies. */
export function pageAccess(roles: RoleRow[] | null, page: string) {
  const rows = (roles ?? []).filter((r) => r.page_name === page);
  return {
    read: rows.length > 0 && rows.every((r) => r.read_access === "Y"),
    edit: rows.length > 0 && rows.every((r) => r.edit_access === "Y"),
  };
}
/** GN-Angular's two CardViews: the finder reads opportunities-eoi rows, Home the dashboard's (and shows status, no pills or More Info). */
export function cardActions(
  rows: Resources,
  roles: RoleRow[] | null,
  opener: Opener,
  tab: string,
  deadlineWarningDays: number | null,
): CardActions {
  const bundle = bundleOf(opener),
    finder = opener === "finder";
  const visible = (group: string, key: string) =>
    resourceVisible(rows, bundle, group, key);
  const access = (page: string) => pageAccess(roles, page);
  return {
    opener,
    pills: {
      new: finder && visible("labels", "new"),
      closingSoon: finder && visible("labels", "closing-soon"),
    },
    moreInfo: finder,
    status: !finder || visible("labels", "status"),
    share: visible("button-labels", "share"),
    notes:
      access("opportunity-notes").read && visible("button-labels", "notes"),
    notesEdit: access("opportunity-notes").edit,
    comments: finder && tab === "shared",
    apply:
      access("apply-opportunities").read && visible("button-labels", "apply"),
    convert:
      access("convert-opportunity").read && visible("button-labels", "convert"),
    convertToProposal:
      access("convert-opportunity-to-proposal").read &&
      visible("button-labels", "convert-to-proposal"),
    deadlineWarningDays,
  };
}
const cardLabels = [
  ["publication-date", "labels", "publication-date", "Publication Date"],
  ["opening-date", "labels", "opening-date", "Opening Date"],
  ["closing-date", "labels", "closing-date", "Closing Date"],
  ["funding-type", "labels", "funding-type", "Funding Type"],
  ["total-fund", "labels", "total-fund", "Total Fund"],
  ["aoi-count", "labels", "aoi-count", "Number of Applications"],
  ["proposals-count", "labels", "proposals-count", "Number of Proposals"],
  [
    "outline-proposals-count",
    "labels",
    "outline-proposals-count",
    "Number of Outline Proposals",
  ],
  ["not-available", "labels", "not-available", "N/A"],
  ["check-website", "labels", "check-website", "Check website"],
  ["more-info", "button-labels", "more_info", "More Info"],
  ["new", "labels", "new", "New"],
  ["closing-soon", "labels", "closing-soon", "Closing Soon"],
  ["share", "button-labels", "share", "Share"],
  ["share-comments", "button-labels", "share-comments", "Comments"],
  ["notes", "button-labels", "notes", "Notes"],
  ["apply", "button-labels", "apply", "Apply"],
  ["convert", "button-labels", "convert", "Convert"],
  [
    "convert-to-proposal",
    "button-labels",
    "convert-to-proposal",
    "Convert to Proposal",
  ],
  ["notes-title", "dialog-titles", "opportunity-notes", "Opportunity Notes"],
  ["save", "button-labels", "save", "Save"],
  ["close", "button-labels", "close", "Close"],
  ["cancel", "button-labels", "cancel", "Cancel"],
  ["continue", "button-labels", "continue", "Continue"],
  [
    "deadline-title",
    "dialog-titles",
    "deadline-warning",
    "Application deadline approaching",
  ],
  [
    "deadline-message",
    "warning-messages",
    "deadline-warning",
    "You are applying close to the application deadline. Please ensure you have enough time to complete your submission.",
  ],
  ["comments-title", "dialog-titles", "share-comments", "Share comments"],
  ["comment-singular", "labels", "comment-singular", "comment"],
  ["comment-plural", "labels", "comment-plural", "comments"],
  [
    "no-share-comments",
    "labels",
    "no-share-comments",
    "This opportunity has not been shared with a comment yet.",
  ],
] as const;
export function cardLabelTexts(rows: Resources, opener: Opener) {
  return Object.fromEntries(
    cardLabels.map(([key, group, name, fallback]) => [
      key,
      label(rows, bundleOf(opener), group, name, fallback),
    ]),
  ) as Record<(typeof cardLabels)[number][0], string>;
}
const CONVERT_FIELDS = [
  "full-name",
  "employee-number",
  "org-unit",
  "activity-type",
  "start-date",
  "end-date",
  "duration-months",
  "primary-sponsor",
  "stage",
  "confidential",
] as const;
export type ConvertField = (typeof CONVERT_FIELDS)[number];
/** Mandatory in the seed bundles when the backend row has no flag; the finder's leaves activity type optional. */
const SEED_REQUIRED: ConvertField[] = [
  "full-name",
  "org-unit",
  "activity-type",
  "start-date",
  "end-date",
  "primary-sponsor",
  "stage",
];
const NEVER_REQUIRED: ConvertField[] = [
  "employee-number",
  "duration-months",
  "confidential",
];
const FIELD_FALLBACKS: Record<ConvertField, string> = {
  "full-name": "Principal Investigator",
  "employee-number": "Employee Number",
  "org-unit": "Org Unit",
  "activity-type": "Activity Type",
  "start-date": "Start Date",
  "end-date": "End Date",
  "duration-months": "Duration (Months)",
  "primary-sponsor": "Primary Sponsor",
  stage: "Proposal Stage",
  confidential: "Confidential",
};
/**
 * GN-Angular gatesOf: each field is gated by its `labels.<key>` row in the opener's bundle; the finder has one
 * stage key per kind, the dashboard one. Required comes from the row's flag, else the seed default.
 */
export function convertGates(
  rows: Resources,
  opener: Opener,
  kind: ConvertKind,
) {
  const bundle = bundleOf(opener),
    finder = opener === "finder";
  const key = (f: ConvertField) =>
    f === "stage"
      ? finder && kind === "OUTLINE_PROPOSAL"
        ? "outline-proposal-stage"
        : "proposal-stage"
      : f;
  return Object.fromEntries(
    CONVERT_FIELDS.map((f) => {
      const show = resourceVisible(rows, bundle, "labels", key(f));
      const seed =
        SEED_REQUIRED.includes(f) && !(finder && f === "activity-type");
      return [
        f,
        {
          show,
          required:
            show &&
            !NEVER_REQUIRED.includes(f) &&
            resourceRequired(rows, bundle, "labels", key(f), seed),
          label: label(rows, bundle, "labels", key(f), FIELD_FALLBACKS[f]),
        },
      ];
    }),
  ) as Record<
    ConvertField,
    { show: boolean; required: boolean; label: string }
  >;
}
const globals = z.object({
  items: z.array(
    z.object({
      var_key: z.string(),
      var_value: z.union([z.string(), z.number()]).nullish(),
    }),
  ),
});
/** The deadline warning (8203): OPP_DEADLINE_WARNING_DAYS (default 3) when OPP_DEADLINE_WARNING_ENABLED is 'Y'. */
export function deadlineWarningDays(
  items: z.infer<typeof globals>["items"],
): number | null {
  const value = (key: string) =>
    items.find((r) => r.var_key === key)?.var_value;
  if (value("OPP_DEADLINE_WARNING_ENABLED") !== "Y") return null;
  return Number(value("OPP_DEADLINE_WARNING_DAYS") ?? 3) || 3;
}
export const opportunityGlobals = cache(async () => {
  const { session } = await authenticate();
  try {
    return deadlineWarningDays(
      globals.parse(
        await oracle("getPre_award_costingGetGlobalVar", {
          token: session.token,
        }),
      ).items,
    );
  } catch (e) {
    if (e instanceof AppError && e.code === "EXPIRED") throw e;
    // The warning is advisory; without the globals the actions proceed as with the flag off.
    return null;
  }
});
