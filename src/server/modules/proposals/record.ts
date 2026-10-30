import "server-only";
import { cache } from "react";
import moment from "moment";
import { z } from "zod";
import { authenticate } from "@/server/identity/session/service";
import { proposals, roles as recordRoles } from "@/server/oracle/api";
import {
  resources,
  type Resources,
} from "@/server/platform/configuration/resources";
import {
  recordIdentity,
  type RecordIdentity,
  type ProposalSummary,
} from "@/features/modules/proposals/record";
import { AppError } from "@/lib/errors";
import { serverFunctions } from "@/server/functions";
const summarySchema = z.object({
  proposal_id: z.number().int().positive(),
  proposal_type: z.string(),
  proposal_number: z.string(),
  proposal_title: z.string().optional(),
  proposal_status_value: z.string(),
  proposal_status: z.string().nullish(),
  pi_name: z.string().nullish(),
  org_unit_name: z.string().nullish(),
  primary_sponsor: z.string().nullish(),
  risk_desc: z.string().nullish(),
  opportunity_title: z.string().nullish(),
  activity_type_value: z.string().nullish(),
  proposal_type_value: z.string().nullish(),
  proposal_start_date: z.string().nullish(),
  proposal_end_date: z.string().nullish(),
  submission_deadline_date: z.string().nullish(),
  cost_model_name: z.string().nullish(),
  currency_code: z.string().nullish(),
  assigned_to_name: z.string().nullish(),
  proposal_stage: z.string().nullish(),
  category: z.string().nullish(),
  opportunity_url: z.string().nullish(),
  is_confidential: z.string().nullish(),
  attribute_1: z.string().nullish(),
  attribute_2: z.string().nullish(),
  attribute_3: z.string().nullish(),
  attribute_4: z.string().nullish(),
  collaborators: z
    .array(
      z.object({
        prop_collab_rltn_id: z.number().int().positive().nullish(),
        collaborator_id: z.number().int().positive(),
        collaborator_name: z.string().nullish(),
        collaborator_role_type: z.string().nullish(),
        prop_collab_rltn_descr: z.string().nullish(),
        country_code: z.string().nullish(),
        vat_code: z.string().nullish(),
        costing_enabled: z.union([z.string(), z.boolean()]).nullish(),
      }),
    )
    .nullish(),
  tags: z.string().nullish(),
  proposal_period_version_id: z.number().int().positive().nullish(),
  created_by_id: z.number().int().positive().nullish(),
  locked_modules: z.array(z.object({ page_id: z.number().int() })).nullish(),
  departments: z
    .array(
      z.object({
        investigator_type_lkp_code: z.string().nullish(),
        full_name: z.string().nullish(),
        employee_number: z.union([z.string(), z.number()]).nullish(),
        org_unit_name: z.string().nullish(),
        proposal_title: z.string().nullish(),
        proposal_description: z.string().nullish(),
        prop_deptmt_rltn_id: z.number().int().positive().nullish(),
        investigator_type: z.string().nullish(),
        sub_proposal_type: z.string().nullish(),
        sub_proposal_type_value: z.string().nullish(),
        exclude_pricing: z.union([z.string(), z.boolean()]).nullish(),
        proposal_number: z.string().nullish(),
      }),
    )
    .nullish(),
  sponsors: z
    .array(
      z.object({
        prop_sponsors_rltn_id: z.number().int().positive().nullish(),
        party_name: z.string().nullish(),
        sponsor_type: z.string().nullish(),
        sponsor_type_flag_lkp_code: z.string().nullish(),
        funder_type_code: z.string().nullish(),
        funder_type: z.string().nullish(),
        sponsor_priority: z.union([z.number(), z.string()]).nullish(),
      }),
    )
    .nullish(),
  proposal_deadlines: z
    .array(
      z.object({
        deadline_id: z.number().int().positive().nullish(),
        deadline_type: z.string().nullish(),
        deadline_description: z.string().nullish(),
        deadline_date: z.string().nullish(),
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
  page_id: z.number().int().positive().nullish(),
  read_access: z.string().nullish(),
  edit_access: z.string().nullish(),
  delete_access: z.string().nullish(),
});
type RoleRow = z.infer<typeof roleRow>;
const roleRows = z.object({ items: z.array(roleRow) });
/**
 * Object roles per page (legacy prepareRoles). Legacy lets the last duplicate row win while its entry
 * gate denies on any read 'N'; here a right holds only when every row for the page grants it.
 */
export function objectAccess(items: RoleRow[]) {
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
  const codeLabel = (value: string | null | undefined) =>
    value
      ? value
          .toLowerCase()
          .split("_")
          .map((part) => part[0]?.toUpperCase() + part.slice(1))
          .join(" ")
      : "";
  const section = (key: string, fallback: string) =>
    serverFunctions.resources.resourceVisible(rb, bundle, "header-labels", key)
      ? serverFunctions.resources.label(
          rb,
          bundle,
          "header-labels",
          key,
          fallback,
        )
      : "";
  const duration = (() => {
    if (!r.proposal_start_date || !r.proposal_end_date) return "";
    const start = moment(r.proposal_start_date).startOf("day");
    const end = moment(r.proposal_end_date).add(1, "day").startOf("day");
    if (!start.isValid() || !end.isValid()) return "";
    let months = (end.year() - start.year()) * 12 + end.month() - start.month();
    let anchor = start.clone().add(months, "months");
    if (end.isBefore(anchor)) {
      months -= 1;
      anchor = start.clone().add(months, "months");
    }
    const days = end.diff(anchor, "days");
    const partial = anchor.clone().add(1, "month").diff(anchor, "days");
    return (months + days / partial).toFixed(2);
  })();
  function field(
    key: string,
    fallback: string,
    value: unknown,
    kind: "text" | "date" = "text",
  ) {
    if (!serverFunctions.resources.resourceVisible(rb, bundle, "labels", key))
      return [];
    return [
      {
        key,
        label: serverFunctions.resources.label(
          rb,
          bundle,
          "labels",
          key,
          fallback,
        ),
        value: typeof value === "string" ? value : "",
        kind,
      },
    ];
  }
  function detailField(
    key: string,
    fallback: string,
    value: unknown,
    kind: "text" | "date" = "text",
  ) {
    if (!serverFunctions.resources.resourceVisible(rb, bundle, "labels", key))
      return [];
    return [
      {
        key,
        label: serverFunctions.resources.label(
          rb,
          bundle,
          "labels",
          key,
          fallback,
        ),
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
    statusCode: r.proposal_status ?? "",
    budgetVersionId: r.proposal_period_version_id ?? null,
    creatorId: r.created_by_id ?? null,
    lockedPageIds: (r.locked_modules ?? []).map((lock) => lock.page_id),
    detailColumns: [
      [
        ...detailField(
          "detail-proposal-number",
          "Proposal Number",
          r.proposal_number,
        ),
        ...detailField(
          "detail-full-project-title",
          "Full Project Title",
          r.proposal_title,
        ),
        ...detailField("detail-applicant-name", "Creator", ""),
        ...detailField(
          "detail-proposal-status",
          "Proposal Status",
          r.proposal_status_value,
        ),
        ...detailField(
          "detail-pi-name",
          "Principal Investigator Name",
          r.pi_name,
        ),
      ],
      [
        ...detailField("detail-org-unit", "Org Unit", r.org_unit_name),
        ...detailField(
          "detail-primary-sponsor",
          "Primary funder",
          r.primary_sponsor,
        ),
        ...detailField("detail-proposal-risk", "Proposal Risk", r.risk_desc),
        ...detailField(
          "detail-opportunity-title",
          "Opportunity Title",
          r.opportunity_title,
        ),
        ...detailField(
          "detail-start-date",
          "Start Date",
          r.proposal_start_date,
          "date",
        ),
      ],
      [
        ...detailField(
          "detail-end-date",
          "End Date",
          r.proposal_end_date,
          "date",
        ),
        ...detailField(
          "details-months-duration",
          "Duration (Months)",
          duration,
        ),
        ...detailField("detail-cost-model", "Cost Model", r.cost_model_name),
        ...detailField("active-budget-version", "Active Budget Version", ""),
      ],
    ],
    labels: {
      funderTypeVisible: serverFunctions.resources.resourceVisible(
        rb,
        bundle,
        "table-headers",
        "funder-type",
      ),
      funder: serverFunctions.resources.label(
        rb,
        bundle,
        "table-headers",
        "sponsor",
        "Funder",
      ),
      funderType: serverFunctions.resources.label(
        rb,
        bundle,
        "table-headers",
        "funder-type",
        "Funder Type",
      ),
      funderRole: serverFunctions.resources.label(
        rb,
        bundle,
        "table-headers",
        "type",
        "Funder Role",
      ),
      priority: serverFunctions.resources.label(
        rb,
        bundle,
        "table-headers",
        "sponsor-priority",
        "Priority",
      ),
      piDetails: section("pi-details", "Principal Investigator Details"),
      proposalDetails: section("proposal-details", "Proposal Details"),
      opportunityDetails: section("opportunity-details", "Opportunity Details"),
      collaboratorDetails: section(
        "collaborator-details",
        "Research partner details",
      ),
      subproposalDetails: section(
        "subproposal-details",
        "Sub-proposal details",
      ),
      collaboratorQuestion: serverFunctions.resources.label(
        rb,
        bundle,
        "labels",
        "collaborator-check",
        "Will this proposal have research partners?",
      ),
      subproposalQuestion: serverFunctions.resources.label(
        rb,
        bundle,
        "labels",
        "subproposals-check",
        "Will you be working with other internal departments as subprojects?",
      ),
      sponsors: serverFunctions.resources.label(
        rb,
        bundle,
        "header-labels",
        "sponsor-details",
        "Sponsor Details",
      ),
      investigators: serverFunctions.resources.label(
        rb,
        bundle,
        "header-labels",
        "investigator-details",
        "Investigators",
      ),
      deadlines: serverFunctions.resources.label(
        rb,
        bundle,
        "header-labels",
        "summary-deadline-date",
        "Deadline Date",
      ),
      noData: serverFunctions.resources.label(
        rb,
        bundle,
        "helper-texts",
        "no-data",
        "No data to display.",
      ),
    },
    sponsors: (r.sponsors ?? []).map((s, index) => ({
      id: String(s.prop_sponsors_rltn_id ?? `row-${index}`),
      name: s.party_name ?? "",
      funderType: s.funder_type ?? codeLabel(s.funder_type_code),
      type: s.sponsor_type ?? "",
      roleCode: s.sponsor_type_flag_lkp_code ?? "",
      priority:
        s.sponsor_priority === null || s.sponsor_priority === undefined
          ? ""
          : String(s.sponsor_priority),
    })),
    investigators: (r.departments ?? []).map((d, index) => ({
      id: String(d.prop_deptmt_rltn_id ?? `row-${index}`),
      name: d.full_name ?? "",
      role: d.investigator_type ?? "",
      organization: d.org_unit_name ?? "",
    })),
    deadlines: (r.proposal_deadlines ?? []).map((d, index) => ({
      id: String(d.deadline_id ?? `row-${index}`),
      type: d.deadline_type ?? "",
      description: d.deadline_description ?? "",
      date: d.deadline_date ?? "",
    })),
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
    piFields: [
      ...field("full-name", "Full Name", pi?.full_name || r.pi_name),
      ...field(
        "employee-number",
        "Employee number",
        pi?.employee_number === null || pi?.employee_number === undefined
          ? ""
          : String(pi.employee_number),
      ),
      ...field("org-unit", "Org Unit", pi?.org_unit_name || r.org_unit_name),
    ],
    proposalFields: [
      ...field(
        "full-project-title",
        "Full Project Title",
        pi?.proposal_title || r.proposal_title,
      ),
      ...field(
        "project-description",
        "Project description",
        pi?.proposal_description,
      ),
      ...field("activity-type", "Activity type", r.activity_type_value),
      ...field(
        "proposal-stage",
        "Proposal Stages",
        codeLabel(r.proposal_stage),
      ),
      ...field("proposal-type", "Proposal type", r.proposal_type_value),
      ...field("proposal-category", "Proposal Category", r.category),
      ...field("start-date", "Start date", r.proposal_start_date, "date"),
      ...field("duration-months", "Months(Duration)", duration),
      ...field("end-date", "End date", r.proposal_end_date, "date"),
      ...field("cost-model", "Cost model", r.cost_model_name),
      ...field("keywords", "Keywords", r.tags),
      ...field(
        "confidential",
        "Confidential",
        r.is_confidential === "Y"
          ? "Yes"
          : r.is_confidential === "N"
            ? "No"
            : "",
      ),
      ...field("assigned-to", "Assigned To", r.assigned_to_name),
    ],
    opportunityFields: [
      ...field("opportunity-title", "Opportunity Title", r.opportunity_title),
      ...field("opportunity-url", "Opportunity URL", r.opportunity_url),
    ],
    collaboratorAnswer: r.collaborators?.length ? "Yes" : "No",
    subproposalAnswer: r.departments?.some(
      (row) => row.investigator_type_lkp_code !== "PI",
    )
      ? "Yes"
      : "No",
    collaborators: (r.collaborators ?? []).map((row) => ({
      id: String(row.prop_collab_rltn_id ?? row.collaborator_id),
      name: row.collaborator_name ?? "",
      role: row.collaborator_role_type ?? "",
      description: row.prop_collab_rltn_descr ?? "",
      countryCode: row.country_code ?? "",
      vatCode: row.vat_code ?? "",
      costingEnabled:
        row.costing_enabled === "Y" || row.costing_enabled === true,
    })),
    subproposals: (r.departments ?? [])
      .filter((row) => row.investigator_type_lkp_code !== "PI")
      .map((row) => ({
        id: String(
          row.prop_deptmt_rltn_id ?? row.employee_number ?? row.full_name ?? "",
        ),
        type: row.sub_proposal_type_value ?? row.sub_proposal_type ?? "",
        name: row.full_name ?? "",
        orgUnit: row.org_unit_name ?? "",
        role: row.investigator_type ?? "",
        excludePricing:
          row.exclude_pricing === "Y" || row.exclude_pricing === true,
        proposalNumber: row.proposal_number ?? "",
      })),
    attributes: Object.fromEntries(
      ["attribute_1", "attribute_2", "attribute_3", "attribute_4"].flatMap(
        (key) => {
          const value =
            r[
              key as
                "attribute_1" | "attribute_2" | "attribute_3" | "attribute_4"
            ];
          return value === null || value === undefined ? [] : [[key, value]];
        },
      ),
    ),
  };
}
export async function loadSummary(input: RecordIdentity) {
  const identity = recordIdentity.parse(input),
    { user } = await authenticate();
  serverFunctions.permissions.requireModule(user, "PROPOSALS");
  const roles = roleRows.parse(
    await recordRoles.record({
      objectType: identity.type,
      objectId: identity.id,
    }),
  ).items;
  if (!objectAccess(roles).get("proposals-summary")?.read)
    throw new AppError("FORBIDDEN", "Read access has not been granted.", 403);
  const [raw, rb] = await Promise.all([
    proposals.summary({ id: identity.id }),
    resources(),
  ]);
  return mapSummary(raw, identity, rb);
}

/** Record context shared by the Proposal layout and its tab during one server render. */
export const proposalContext = cache(
  async (type: RecordIdentity["type"], id: string) => {
    const identity = recordIdentity.parse({ type, id });
    const { session, user } = await authenticate();
    serverFunctions.permissions.requireModule(user, "PROPOSALS");
    const roles = roleRows.parse(
      await recordRoles.record({ objectType: type, objectId: id }),
    ).items;
    const access = objectAccess(roles);
    if (![...access.values()].some((right) => right.read))
      throw new AppError("FORBIDDEN", "Read access has not been granted.", 403);
    const [raw, rb] = await Promise.all([
      proposals.summary({ id }),
      resources(),
    ]);
    const summary = mapSummary(raw, identity, rb);
    const summaryPage = roles.find(
      (role) => role.page_name === "proposals-summary",
    );
    const finalizable = summaryPage?.page_id
      ? await proposals.finalizablePages({ type, id }).then(
          (raw) =>
            z
              .object({ items: z.array(z.object({ page_name: z.string() })) })
              .parse(raw)
              .items.some(
                (page) => page.page_name.toLowerCase() === "proposals-summary",
              ),
          () => false,
        )
      : false;
    return {
      identity,
      session,
      user,
      access,
      pageIds: new Map(roles.map((role) => [role.page_name, role.page_id])),
      summary,
      bundle: proposalBundle(rb, type),
      finalize: {
        pageId: summaryPage?.page_id ?? null,
        visible: finalizable && summary.statusCode === "DRFT",
        checked: summaryPage?.page_id
          ? summary.lockedPageIds.includes(summaryPage.page_id)
          : false,
        editable: access.get("proposals-summary")?.edit === true,
      },
    };
  },
);

export async function proposalPage(
  type: RecordIdentity["type"],
  id: string,
  page: string,
) {
  const context = await proposalContext(type, id);
  const rights = context.access.get(page);
  if (rights?.read !== true)
    throw new AppError("FORBIDDEN", "Read access has not been granted.", 403);
  return { ...context, rights };
}
