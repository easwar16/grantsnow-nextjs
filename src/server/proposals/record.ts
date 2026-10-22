import "server-only";
import { z } from "zod";
import { authenticate } from "@/server/session/service";
import { oracle } from "@/server/api/transport";
import { requireModule } from "@/server/permissions/policy";
import {
  resources,
  label,
  resourceVisible,
  type Resources,
} from "@/server/configuration/resources";
import {
  recordIdentity,
  type RecordIdentity,
  type ProposalSummary,
} from "@/features/proposals/record";
import { AppError } from "@/lib/errors";
const summarySchema = z.object({
  proposal_id: z.number().int().positive(),
  proposal_type: z.string(),
  proposal_number: z.string(),
  proposal_title: z.string().optional(),
  proposal_status_value: z.string(),
  pi_name: z.string().nullish(),
  org_unit_name: z.string().nullish(),
  activity_type_value: z.string().nullish(),
  proposal_type_value: z.string().nullish(),
  proposal_start_date: z.string().nullish(),
  proposal_end_date: z.string().nullish(),
  submission_deadline_date: z.string().nullish(),
  cost_model_name: z.string().nullish(),
  currency_code: z.string().nullish(),
  assigned_to_name: z.string().nullish(),
  tags: z.string().nullish(),
  departments: z
    .array(
      z.object({
        investigator_type_lkp_code: z.string().nullish(),
        full_name: z.string().nullish(),
        org_unit_name: z.string().nullish(),
        proposal_title: z.string().nullish(),
        proposal_description: z.string().nullish(),
      }),
    )
    .nullish(),
});
/** The record's bundle: its per-type bundle when provisioned (any row), otherwise `proposal`; keys never fall back one by one. */
export function proposalBundle(rb: Resources, type: RecordIdentity["type"]) {
  const bundle = type.toLowerCase();
  return rb.some((r) => r.module_name.toLowerCase() === bundle)
    ? bundle
    : "proposal";
}
const roleRow = z.object({
  page_name: z.string(),
  read_access: z.string().nullish(),
  edit_access: z.string().nullish(),
  delete_access: z.string().nullish(),
});
/**
 * Object roles per page (legacy prepareRoles). Legacy lets the last duplicate row win while its entry
 * gate denies on any read 'N'; here a right holds only when every row for the page grants it.
 */
export function objectAccess(items: z.infer<typeof roleRow>[]) {
  const access = new Map<
    string,
    { read: boolean; edit: boolean; delete: boolean }
  >();
  for (const row of items) {
    const prior = access.get(row.page_name) ?? {
      read: true,
      edit: true,
      delete: true,
    };
    access.set(row.page_name, {
      read: prior.read && row.read_access === "Y",
      edit: prior.edit && row.edit_access === "Y",
      delete: prior.delete && row.delete_access === "Y",
    });
  }
  return access;
}
export function mapSummary(
  raw: unknown,
  identity: RecordIdentity,
  rb: Resources,
): ProposalSummary {
  const parsed = summarySchema.safeParse(raw);
  if (!parsed.success)
    throw new AppError(
      "CONTRACT",
      "Oracle returned an invalid Proposal Summary.",
    );
  const r = parsed.data;
  if (
    String(r.proposal_id) !== identity.id ||
    r.proposal_type !== identity.type
  )
    throw new AppError(
      "FORBIDDEN",
      "The returned record does not match the authorized identity.",
      403,
    );
  const pi = r.departments?.find((d) => d.investigator_type_lkp_code === "PI");
  const bundle = proposalBundle(rb, identity.type);
  function field(
    key: string,
    fallback: string,
    value: unknown,
    kind: "text" | "date" = "text",
  ) {
    if (!resourceVisible(rb, bundle, "labels", key)) return [];
    return [
      {
        key,
        label: label(rb, bundle, "labels", key, fallback),
        value: typeof value === "string" ? value : "",
        kind,
      },
    ];
  }
  return {
    id: identity.id,
    type: identity.type,
    reference: r.proposal_number,
    title: r.proposal_title || pi?.proposal_title || r.proposal_number,
    status: r.proposal_status_value,
    fields: [
      ...field(
        "full-name",
        "Principal Investigator",
        pi?.full_name || r.pi_name,
      ),
      ...field(
        "org-unit",
        "Organization",
        pi?.org_unit_name || r.org_unit_name,
      ),
      ...field(
        "full-project-title",
        "Full Project Title",
        pi?.proposal_title || r.proposal_title,
      ),
      ...field(
        "project-description",
        "Project Description",
        pi?.proposal_description,
      ),
      ...field("activity-type", "Activity Type", r.activity_type_value),
      ...field("proposal-type", "Proposal Type", r.proposal_type_value),
      ...field("start-date", "Start Date", r.proposal_start_date, "date"),
      ...field("end-date", "End Date", r.proposal_end_date, "date"),
      ...field(
        "submission-deadline",
        "Submission Deadline",
        r.submission_deadline_date,
        "date",
      ),
      ...field("cost-model", "Cost Model", r.cost_model_name),
      ...field("currency", "Currency", r.currency_code),
      ...field("assigned-to", "Assigned to", r.assigned_to_name),
      ...field("tags", "Tags", r.tags),
    ],
  };
}
export async function loadSummary(input: RecordIdentity) {
  const identity = recordIdentity.parse(input),
    { session, user } = await authenticate();
  requireModule(user, "PROPOSALS");
  const roles = z.object({ items: z.array(roleRow) }).parse(
    await oracle("getSecurityUser_roles", {
      token: session.token,
      p_obj_type: identity.type,
      p_obj_id: identity.id,
    }),
  );
  if (!objectAccess(roles.items).get("proposals-summary")?.read)
    throw new AppError("FORBIDDEN", "Read access has not been granted.", 403);
  const [raw, rb] = await Promise.all([
    oracle(
      "getProposalProposal_id",
      { token: session.token },
      undefined,
      undefined,
      { proposal_id: identity.id },
    ),
    resources(),
  ]);
  return mapSummary(raw, identity, rb);
}
