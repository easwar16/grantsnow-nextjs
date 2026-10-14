import "server-only";
import { z } from "zod";
import { authenticate } from "@/server/session/service";
import { oracle } from "@/server/api/transport";
import { requireModule, requireRead } from "@/server/permissions/policy";
import {
  resources,
  label,
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
  const resourceModule = identity.type.toLowerCase();
  function field(
    key: string,
    fallback: string,
    value: unknown,
    kind: "text" | "date" = "text",
  ) {
    const specific = rb.find(
      (x) =>
        x.module_name.toLowerCase() === resourceModule &&
        x.label_type === "labels" &&
        x.label_name === key,
    );
    const generic = rb.find(
      (x) =>
        x.module_name.toLowerCase() === "proposal" &&
        x.label_type === "labels" &&
        x.label_name === key,
    );
    const resource = specific || generic;
    if (resource?.is_visible !== "Y") return [];
    return [
      {
        key,
        label:
          resource.label_value ||
          label(rb, "proposal", "labels", key, fallback),
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
  const roles = z
    .object({
      items: z.array(
        z.object({ page_name: z.string(), read_access: z.string() }),
      ),
    })
    .parse(
      await oracle("getSecurityUser_roles", {
        token: session.token,
        p_obj_type: identity.type,
        p_obj_id: identity.id,
      }),
    );
  requireRead(roles.items, "proposals-summary");
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
