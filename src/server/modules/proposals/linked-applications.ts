import "server-only";
import { z } from "zod";
import { AppError } from "@/lib/errors";
import { proposals } from "@/server/oracle/api";
import type { RecordIdentity } from "@/features/modules/proposals/record";
import { proposalPage } from "./record";
import { ethicsCreateAllowed } from "@/server/modules/ethics/actions";

export type ApplicationKind = "ETHICS" | "DUE_DILIGENCE";

const applicationResponse = z.object({
  items: z.array(
    z.object({
      setup_flow_id: z.coerce.number().int().positive(),
      obj_ref_id: z.coerce.number().int().positive().nullish(),
      obj_ref_type: z.string().nullish(),
      application_number: z.string(),
      setup_description: z.string().nullish(),
      status: z.string().nullish(),
      status_lkp_code: z.string().nullish(),
      access_type: z.enum(["EA_ACCESS", "RESPONDENT_ACCESS", "APPROVER_ACCESS"]).nullish(),
      created_by: z.string().nullish(),
      reviewer_name: z.string().nullish(),
      last_updated_by: z.string().nullish(),
      creation_date: z.string().nullish(),
      last_update_date: z.string().nullish(),
      deadline_date: z.string().nullish(),
      expiry_date: z.string().nullish(),
      ethics_type: z.string().nullish(),
    }),
  ),
});

export function mapLinkedApplications(raw: unknown, proposalId: string, kind: ApplicationKind = "ETHICS") {
  const parsed = applicationResponse.safeParse(raw);
  if (!parsed.success)
    throw new AppError(
      "CONTRACT",
      "Oracle returned invalid linked applications.",
    );
  if (
    parsed.data.items.some(
      (row) => kind === "DUE_DILIGENCE"
        ? String(row.obj_ref_id ?? "") !== proposalId || row.obj_ref_type !== "PROPOSAL"
        : row.obj_ref_id != null && String(row.obj_ref_id) !== proposalId,
    )
  )
    throw new AppError(
      "FORBIDDEN",
      "Application is outside this Proposal.",
      403,
    );
  return parsed.data.items.map((row) => ({
    id: row.setup_flow_id,
    reference: row.application_number,
    title: row.setup_description || "",
    status: row.status || "",
    statusCode: row.status_lkp_code || "",
    accessType: row.access_type || "",
    createdBy: row.created_by || "",
    reviewer: row.reviewer_name || "",
    updatedBy: row.last_updated_by || "",
    created: row.creation_date || "",
    updated: row.last_update_date || "",
    deadline: row.deadline_date || "",
    expiry: row.expiry_date || "",
    ethicsType: row.ethics_type || "",
  }));
}

export async function proposalLinkedApplications(
  type: RecordIdentity["type"],
  id: string,
  kind: ApplicationKind,
) {
  const page =
    kind === "ETHICS" ? "proposals-ethics" : "proposals-due-diligence";
  const context = await proposalPage(type, id, page);
  const [raw, ethicsAllowed] = await Promise.all([
    proposals.linkedApplications({ kind, proposalId: id }),
    kind === "ETHICS" ? ethicsCreateAllowed() : Promise.resolve(false),
  ]);
  return {
    rows: mapLinkedApplications(raw, id, kind),
    bundle: context.bundle,
    canCreate: context.rights.edit === true &&
      (kind === "DUE_DILIGENCE" || ethicsAllowed),
    canLink: kind === "DUE_DILIGENCE" &&
      context.access.get("proposals-link-due-diligence")?.edit === true,
  };
}
