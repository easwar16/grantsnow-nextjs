import "server-only";
import { z } from "zod";
import { AppError } from "@/lib/errors";
import { awards } from "@/server/oracle/api";
import { resources } from "@/server/platform/configuration/resources";
import type { DueDiligenceView } from "@/features/modules/awards/record/due-diligence-model";
import { awardRecordRead } from "../record";
import { serverFunctions } from "@/server/functions";

const BUNDLE = "award";
const text = z.union([z.string(), z.number()]).nullish();
const rowSchema = z.object({
  setup_flow_id: z.union([z.string(), z.number()]),
  obj_ref_id: z.coerce.number().int().positive().nullish(),
  obj_ref_type: z.string().nullish(),
  application_number: text,
  status: text,
  status_lkp_code: text,
  setup_description: text,
  created_by: text,
  reviewer_name: text,
  last_updated_by: text,
  creation_date: text,
  last_update_date: text,
  deadline_date: text,
  expiry_date: text,
  ethics_type: text,
  ethics_form_type: text,
  org_unit_name: text,
});
/** The card's fields in legacy order, each behind its `labels.dd-list-*` gate; dates are formatted on screen. */
const FIELDS = [
  ["createdBy", "created_by", "dd-list-created-by", "Created by", false],
  ["reviewer", "reviewer_name", "dd-list-reviewer", "Reviewer", false],
  [
    "updatedBy",
    "last_updated_by",
    "dd-list-last-updated-by",
    "Last Updated by",
    false,
  ],
  ["created", "creation_date", "dd-list-creation-date", "Created On", true],
  [
    "updated",
    "last_update_date",
    "dd-list-last-updated-date",
    "Last Updated Date",
    true,
  ],
  ["deadline", "deadline_date", "dd-list-deadline-date", "Deadline Date", true],
  ["expiry", "expiry_date", "dd-list-expiry-date", "Expiry Date", true],
  [
    "type",
    "ethics_type",
    "dd-list-due-diligence-type",
    "Due Diligence Type",
    false,
  ],
  ["form", "ethics_form_type", "dd-list-form-type", "Form Type", false],
  ["org", "org_unit_name", "dd-list-org-unit", "Org Unit", false],
] as const;

/**
 * The Due Diligence tab (legacy awards-due-diligence): the due-diligence records linked to the award. Legacy's
 * Create, View and Link open or change the Due Diligence module's own scoped records.
 */
export async function dueDiligenceView(id: string): Promise<DueDiligenceView> {
  const context = await awardRecordRead(id, "due-diligence");
  const [raw, rows] = await Promise.all([
    awards.dueDiligence({ awardId: id }),
    resources(),
  ]);
  const items =
    z.object({ items: z.array(rowSchema).nullish() }).parse(raw).items ?? [];
  assertAwardDueDiligenceScope(items, id);
  const shown = FIELDS.filter(([, , key]) =>
    serverFunctions.resources.resourceVisible(rows, BUNDLE, "labels", key),
  );
  return {
    parentId: id,
    canCreate: context.access.roles.get("awards-due-diligence")?.edit === true,
    canLink: context.access.roles.get("awards-link-due-diligence")?.edit === true,
    records: items.map((r) => {
      const code = String(r.status_lkp_code ?? "");
      return {
        id: String(r.setup_flow_id),
        number: String(r.application_number ?? ""),
        status: r.status ? String(r.status) : undefined,
        // Legacy: in progress is info, a draft the plain badge, anything else success.
        tone: code === "WIP" ? "info" : code === "DRFT" ? undefined : "success",
        title: String(r.setup_description ?? ""),
        fields: shown.flatMap(([field, column, key, fallback, date]) => {
          const value = r[column];
          return value === null || value === undefined || value === ""
            ? []
            : [
                {
                  key: field,
                  label: serverFunctions.resources.label(
                    rows,
                    BUNDLE,
                    "labels",
                    key,
                    fallback,
                  ),
                  value: String(value),
                  date,
                },
              ];
        }),
      };
    }),
    texts: {
      empty: serverFunctions.resources.label(
        rows,
        BUNDLE,
        "helper-texts",
        "dd-no-records",
        "No due diligence records",
      ),
    },
  };
}

/** Validate the Oracle result before any linked record is shown or opened. */
export function assertAwardDueDiligenceScope(
  items: { obj_ref_id?: number | null; obj_ref_type?: string | null }[],
  id: string,
) {
  if (items.some((row) => String(row.obj_ref_id ?? "") !== id ||
      row.obj_ref_type !== "AWARD"))
    throw new AppError("FORBIDDEN", "Due Diligence record is outside this Award.", 403);
}
