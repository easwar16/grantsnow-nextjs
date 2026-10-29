import "server-only";
import { z } from "zod";
import { awards, lookups, people } from "@/server/oracle/api";
import {
  resources,
  type Resources,
} from "@/server/platform/configuration/resources";
import { globalVariables } from "@/server/platform/configuration/formatting";
import { orNull } from "@/server/record/shared";
import { AppError } from "@/lib/errors";
import { pageOf } from "@/shared/awards/award-record";
import {
  costTree,
  type CostLine,
} from "@/features/modules/awards/record/projects-model";
import type {
  ProjectsView,
  ProjectRow,
  TeamMember,
} from "@/features/modules/awards/record/projects-types";
import {
  awardPageLock,
  awardRecordRead,
  isDraft,
  type AwardRecordContext,
} from "../record";
import { serverFunctions } from "@/server/functions";

const BUNDLE = "award";
const PAGE = pageOf("projects");
const str = (v: unknown) => (v === null || v === undefined ? "" : String(v));
const day = (v: unknown) => str(v).slice(0, 10);
const num = (v: unknown) => {
  const n = Number(v);
  return v === null || v === undefined || v === "" || !Number.isFinite(n)
    ? null
    : n;
};
const truthy = (v: unknown) => v === true || Number(v) === 1 || v === "Y";
const list = (raw: Record<string, unknown>, key: string) =>
  Array.isArray(raw[key]) ? (raw[key] as Record<string, unknown>[]) : [];

export function projectsOf(raw: Record<string, unknown>): ProjectRow[] {
  return list(raw, "Award Projects").map((p) => ({
    id: str(p.project_id),
    linkId: str(p.award_project_link_id),
    templateId: str(p.project_template_id),
    name: str(p.project_name),
    number: str(p.project_number),
    erpId: str(p.erp_project_id),
    managerEmail: str(p.manager_email),
    orgId: str(p.org_id),
    orgName: str(p.org_unit_name),
    start: day(p.start_date),
    end: day(p.end_date),
    intellectualProperty: str(p.intellectual_property),
    researchLocation: str(p.research_location),
    researchOffice: str(p.research_office_location),
    enteredBy: str(p.proposal_entered_by),
    creditReceiver: str(p.credit_receiver),
    conflict: str(p.conflict_of_interest),
    conflictDetails: str(p.details_of_conflict),
    indirectSchedule: str(p.indirect_cost_schedule),
    allowedSchedule: str(p.allowed_cost_schedule),
    editable: truthy(p.is_editable),
  }));
}
function teamOf(raw: Record<string, unknown>): TeamMember[] {
  return list(raw, "Award ProjectsTeam Members").map((m) => ({
    id: str(m.team_member_id),
    personId: str(m.person_id),
    person: str(m.person_name),
    projectId: str(m.project_id),
    projectName: str(m.project_name),
    roleId: str(m.project_role_id),
    role: str(m.project_role_name),
    start: day(m.effective_start_date),
    end: day(m.effective_end_date),
    erpId: str(m.erp_team_member_id),
    editable: truthy(m.is_editable),
  }));
}
export function costLinesOf(raw: Record<string, unknown>): CostLine[] {
  return list(raw, "Award Project Cost Line").map((l) => ({
    id: Number(l.id),
    project_id: Number(l.project_id),
    funding_section_lkp_code: str(l.funding_section_lkp_code),
    funding_section: str(l.funding_section),
    cost_category_type_lkp_code: str(l.cost_category_type_lkp_code),
    cost_category: str(l.cost_category),
    costing_group_id: num(l.costing_group_id),
    staff_name: str(l.staff_name),
    cost_category_description: str(l.cost_category_description),
    cost_start_date: day(l.cost_start_date),
    cost_end_date: day(l.cost_end_date),
    gl_nominal: str(l.gl_nominal),
    gl_nominal_code: str(l.gl_nominal_code),
    unit_type: str(l.unit_type),
    units: num(l.units),
    project_hours: num(l.project_hours),
    project_months: num(l.project_months),
    sponsor_contribution: num(l.sponsor_contribution) ?? 0,
    instituition_contribution: num(l.instituition_contribution) ?? 0,
    total_cost: num(l.total_cost) ?? 0,
    is_editable: truthy(l.is_editable),
    person_id: num(l.person_id),
    project_role_id: num(l.project_role_id),
    cost_category_item_id: num(l.cost_category_item_id),
    award_project_link_id: num(l.award_project_link_id),
  }));
}

/** The page's gates (legacy awards-projects-start-page): page rights, a draft, the lock, the award, the Add buttons. */
async function projectGates(id: string) {
  const context = await awardRecordRead(id, "projects");
  const lock = await awardPageLock(context, "projects");
  const role = (key: string) => context.access.roles.get(key);
  const open = isDraft(context) && !lock.locked;
  const edit = open && role(PAGE)?.edit === true;
  const add = (button: string) =>
    edit && truthy(context.award.is_editable) && role(button)?.read === true;
  return {
    context,
    edit,
    remove: open && role(PAGE)?.delete === true,
    addProject: add("awards-projects-add-project"),
    addCost: add("awards-projects-add-project-cost"),
    addTeam: add("awards-projects-add-project-teammember"),
    // Legacy checked neither the lock nor the award here; the same rules as every other change now apply.
    editGlobal: edit && truthy(context.award.is_editable),
  };
}

const items = <T extends z.ZodTypeAny>(row: T) =>
  z.object({ items: z.array(row) });
const codeRows = items(
  z.object({
    lookup_type_code: z.string().nullish(),
    lookup_code: z.string(),
    lookup_code_value: z.string().nullish(),
    lookup_code_descr: z.string().nullish(),
  }),
);
async function projectChoices() {
  const [orgs, everyone, staff, roles, sections, codes] = await Promise.all([
    lookups.orgUnits({}).then(serverFunctions.organizations.orgUnitRows),
    people.all(),
    // The team dialog's list is legacy's app-level getPersonList (unfiltered).
    people
      .inOrg({})
      .then(
        (raw) =>
          items(
            z.object({ person_id: z.coerce.number(), full_name: z.string() }),
          ).parse(raw).items,
      ),
    orNull(
      awards.projectRoles().then(
        (raw) =>
          items(
            z.object({
              project_role_id: z.coerce.number(),
              project_role_name: z.string(),
            }),
          ).parse(raw).items,
      ),
    ),
    orNull(
      awards.fundingSections().then(
        (raw) =>
          items(
            z.object({
              lookup_code: z.string(),
              lookup_code_value: z.string(),
            }),
          ).parse(raw).items,
      ),
    ),
    lookups
      .codes({ types: "COST_CATEGORY_TYPES,GL_NOMINALS,UNIT_TYPE" })
      .then((raw) => codeRows.parse(raw).items),
  ]);
  const ofType = (type: string, by: "value" | "descr") =>
    codes
      .filter((c) => c.lookup_type_code === type)
      .map((c) => ({
        value: c.lookup_code,
        label:
          (by === "value" ? c.lookup_code_value : c.lookup_code_descr) ??
          c.lookup_code,
      }));
  return {
    orgs: orgs.map((o) => ({
      value: o.id,
      label: " ".repeat(o.depth) + o.name,
    })),
    everyone: everyone.flatMap((p) =>
      p.full_name ? [{ value: String(p.person_id), label: p.full_name }] : [],
    ),
    staff: staff.map((p) => ({
      value: String(p.person_id),
      label: p.full_name,
    })),
    roles: (roles ?? []).map((r) => ({
      value: String(r.project_role_id),
      label: r.project_role_name,
    })),
    sections: (sections ?? []).map((s) => ({
      value: s.lookup_code,
      label: s.lookup_code_value,
    })),
    categories: ofType("COST_CATEGORY_TYPES", "descr"),
    glNominals: ofType("GL_NOMINALS", "value"),
    unitTypes: ofType("UNIT_TYPE", "descr"),
  };
}
type Choices = Awaited<ReturnType<typeof projectChoices>>;

/** A field: visible on 'Y', required from the RB flag, its label. */
const fieldOf =
  (rows: Resources, group = "labels") =>
  (key: string, fallback: string) => ({
    show: serverFunctions.resources.resourceVisible(rows, BUNDLE, group, key),
    required: serverFunctions.resources.resourceRequired(
      rows,
      BUNDLE,
      group,
      key,
      false,
    ),
    label: serverFunctions.resources.label(rows, BUNDLE, group, key, fallback),
    help: serverFunctions.resources.resourceDescription(
      rows,
      BUNDLE,
      group,
      key,
    ),
  });

export async function projectsView(id: string): Promise<ProjectsView> {
  const [gates, rows, choices, globals] = await Promise.all([
    projectGates(id),
    resources(),
    projectChoices(),
    globalVariables(),
  ]);
  const { context } = gates;
  const t = (group: string, key: string, fallback: string) =>
    serverFunctions.resources.label(rows, BUNDLE, group, key, fallback);
  const f = fieldOf(rows);
  const h = fieldOf(rows, "table-headers");
  return {
    awardId: id,
    award: {
      start: day(context.award.award_start_date),
      end: day(context.award.award_end_date),
    },
    projects: projectsOf(context.raw),
    team: teamOf(context.raw),
    costs: costTree(costLinesOf(context.raw)),
    gates: {
      edit: gates.edit,
      remove: gates.remove,
      addProject: gates.addProject,
      addCost: gates.addCost,
      addTeam: gates.addTeam,
      editGlobal: gates.editGlobal,
      splitByPeriod:
        str(
          globals.find((g) => g.var_key === "SPLIT_AWARD_COST_ITEM_BY_PERIOD")
            ?.var_value,
        ) === "Y",
    },
    choices,
    projectFields: {
      name: f("project-name", "Project Name"),
      number: f("project-number", "Project Number"),
      erpId: f("project-erp-project-id", "ERP Project Id"),
      managerEmail: f("project-manager-email", "Manager Email"),
      orgId: f("org-unit", "Org Unit"),
      start: f("project-start-date", "Start Date"),
      end: f("project-end-date", "End Date"),
      intellectualProperty: f(
        "project-intelectual-property",
        "Intellectual Property",
      ),
      researchLocation: f("project-research-location", "Research Location"),
      researchOffice: f("project-research-office", "Research Office Location"),
      enteredBy: f("project-proposal-entered-by", "Proposal Entered By"),
      creditReceiver: f("project-credit-receiver", "Credit Receiver"),
      conflict: f("project-conflict-of-interest", "Conflict of Interest"),
      conflictDetails: f("project-details-of-conflict", "Details of Conflict"),
    },
    teamFields: {
      personId: f("projectTeam-staff-name", "Staff Name"),
      projectId: f("project", "Project"),
      roleId: f("projectTeam-project-roles", "Project Role"),
      start: f("projectTeam-effective-start-date", "Effective Start Date"),
      end: f("projectTeam-effective-end-date", "Effective End Date"),
    },
    teamColumns: {
      project: t("labels", "projectTeam-project", "Project"),
      projectName: t("labels", "projectTeam-project-name", "Project Name"),
      person: t("labels", "projectTeam-person", "Person"),
      role: t("labels", "projectTeam-project-roles", "Project Role"),
      start: t("labels", "projectTeam-start-date", "Start Date"),
      end: t("labels", "projectTeam-end-date", "End Date"),
    },
    costColumns: {
      item: h("project-cost-category-item", "Cost Category Item"),
      role: h("project-cost-role", "Role"),
      start: h("project-cost-start-date", "Start Date"),
      end: h("project-cost-end-date", "End Date"),
      glNominal: h("project-cost-gl-nominal", "GL Nominal"),
      unitType: h("project-cost-unit-type", "Unit Type"),
      quantity: h("project-cost-unit-qty", "Quantity"),
      hours: h("project-cost-hours", "Hours"),
      months: h("project-cost-months", "Months"),
      sponsor: h("project-cost-funder-contribution", "Funder Contribution"),
      sponsorPct: h("project-cost-funder-percentage", "Funder %"),
      institution: h(
        "project-cost-institution-contribution",
        "Institution Contribution",
      ),
      institutionPct: h("project-cost-institution-percentage", "Institution %"),
      total: h("project-cost-total", "Total"),
    },
    costFields: {
      project: f("project", "Project"),
      start: f("project-cost-start-date", "Start Date"),
      end: f("project-cost-end-date", "End Date"),
      section: f("projectCost-cost-section", "Cost Section"),
      category: f("projectCost-cost-category", "Cost Category"),
      item: f("projectCost-cost-category-item", "Cost Category Item"),
      person: f("person", "Person"),
      months: f("projectCost-project-months", "Project Months"),
      role: f("projectCost-project-roles", "Project Role"),
      unitType: f("projectCost-unit-type", "Unit Type"),
      units: f("projectCost-units", "Units"),
      hours: f("projectCost-project-hours", "Project Hours"),
      description: f("projectCost-item-description", "Item Description"),
      glNominal: f("projectCost-gl-nominal", "GL Nominal"),
      sponsor: f("projectCost-sponsor_contribution", "Funder Contribution"),
      sponsorPct: f("projectCost-sponsor_percent", "Funder %"),
      institution: f(
        "projectCost-instituition-contribuition",
        "Institution Contribution",
      ),
      institutionPct: f("projectCost-instituition-percent", "Institution %"),
      total: f("projectCost-total", "Total"),
    },
    globalFields: {
      instiCost: t("labels", "projectCost-InstiCost", "Institution Cost"),
      instiPct: t("labels", "projectCost-InstiPerc", "Institution %"),
      funderCost: t("labels", "projectCost-funderCost", "Funder Cost"),
      funderPct: t("labels", "projectCost-funderPerc", "Funder %"),
      total: t("labels", "projectCost-grandTotal", "Grand Total"),
    },
    texts: {
      projects: t("labels", "projects", "Projects"),
      costs: t("labels", "project-costs", "Project Costs"),
      team: t("labels", "project-team", "Project Team"),
      addProject: t("button-labels", "project-add-project", "Add Project"),
      editProject: t("button-labels", "project-edit", "Edit"),
      projectTitle: t("labels", "award-projects", "Award Projects"),
      addCost: t("labels", "project-cost-add-project-cost", "Add Project Cost"),
      costTitle: t("labels", "project-award-cost-items", "Award Cost Items"),
      editGlobal: t("button-labels", "projectCost-editGlobal", "Edit"),
      editCost: t("button-labels", "projectCost-edit", "Edit"),
      deleteCost: t("button-labels", "projectCost-delete", "Delete"),
      deleteTitle: t("dialog-titles", "warning", "Warning"),
      deleteMessage: t(
        "warning-messages",
        "permanent-delete",
        "This operation will remove this record permanently. Do you want to proceed?",
      ),
      clone: t("button-labels", "clone", "Clone"),
      addRow: t("button-labels", "projectCost-add-row", "Add Row"),
      addTeam: t("labels", "add-project-team-member", "Add Team Member"),
      editTeam: t("button-labels", "projectTeam-edit", "Edit"),
      teamTitle: t("dialog-titles", "award-team-members", "Award Team Members"),
      save: t("button-labels", "project-save", "Save"),
      cancel: t("button-labels", "project-cancel", "Cancel"),
      total: t("labels", "total", "Total"),
      noData: t("helper-texts", "project-no-data", "No data to display."),
      required: t(
        "error-msg",
        "required-fields",
        "Please fill all the required fields",
      ),
      // Legacy literals (no bundle keys).
      projectSaved: "Project has been saved Successfully",
      teamSaved: "Project Team Members Saved Successfully",
    },
  };
}

// ── Writes ────────────────────────────────────────────────────────────────────

const text = z.string().max(4000);
const date = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .or(z.literal(""));
const idText = z.string().regex(/^\d{0,15}$/);
function inAward(
  context: AwardRecordContext,
  start: string,
  end: string,
  s = day(context.award.award_start_date),
  e = day(context.award.award_end_date),
) {
  if (
    (start && end && end < start) ||
    (start && s && start < s) ||
    (end && e && end > e)
  )
    throw new AppError(
      "BAD_REQUEST",
      "The dates must be within the award's dates.",
      400,
    );
}
async function requiredCheck(
  values: Record<string, string>,
  keys: Record<string, string>,
) {
  const rows = await resources();
  const missing = Object.entries(keys).some(
    ([field, key]) =>
      serverFunctions.resources.resourceVisible(rows, BUNDLE, "labels", key) &&
      serverFunctions.resources.resourceRequired(
        rows,
        BUNDLE,
        "labels",
        key,
        false,
      ) &&
      (values[field] ?? "").trim() === "",
  );
  if (missing)
    throw new AppError(
      "BAD_REQUEST",
      "Please fill all the required fields",
      400,
    );
}
const offered = (choices: Choices[keyof Choices], value: string) =>
  value === "" || choices.some((c) => c.value === value);

const projectInput = z
  .object({
    id: idText,
    name: text,
    managerEmail: z
      .string()
      .max(320)
      .refine((v) => v === "" || /^[^@\s]+@[^@\s]+$/.test(v)),
    orgId: idText,
    start: date,
    end: date,
    intellectualProperty: text,
    researchLocation: text,
    researchOffice: text,
    enteredBy: text,
    creditReceiver: text,
    conflict: text,
    conflictDetails: text,
  })
  .strict();
/** WRITES: a project (legacy prepareProjectPayload); an existing one only while it is editable. */
export async function saveProject(id: string, raw: unknown) {
  const input = projectInput.parse(raw);
  const gates = await projectGates(id);
  const existing = projectsOf(gates.context.raw).find((p) => p.id === input.id);
  if (input.id ? !gates.edit || !existing?.editable : !gates.addProject)
    throw new AppError("FORBIDDEN", "This project cannot be changed.", 403);
  inAward(gates.context, input.start, input.end);
  await requiredCheck(input, {
    name: "project-name",
    managerEmail: "project-manager-email",
    orgId: "org-unit",
    start: "project-start-date",
    end: "project-end-date",
  });
  if (!offered((await projectChoices()).orgs, input.orgId))
    throw new AppError("BAD_REQUEST", "A chosen value is not offered.", 400);
  const a = gates.context.award;
  await awards.saveProject({
    body: {
      ProjectID: existing ? Number(existing.id) : undefined,
      org_id: num(input.orgId),
      ProjectTemplateID: num(existing?.templateId),
      ProjectNumber: existing?.number || undefined,
      ProjectName: input.name,
      AwardID: a.award_id,
      ERPProjectID: existing?.erpId || null,
      StartDate: input.start || null,
      EndDate: input.end || null,
      ManagerEmail: input.managerEmail || null,
      ResearchLocation: input.researchLocation || null,
      ResearchOfficeLocation: input.researchOffice || null,
      IndirectCostSchedule: existing?.indirectSchedule || null,
      AllowedCostSchedule: existing?.allowedSchedule || null,
      IntellectualProperty: input.intellectualProperty || null,
      ProposalEnteredBy: input.enteredBy || null,
      // The contract's spelling.
      CreditReciever: input.creditReceiver || null,
      ConflictOfInterest: input.conflict || null,
      DetailsOfConflict: input.conflictDetails || null,
      ProposalID: num(a.proposal_id),
    },
  });
  return { saved: true };
}

const teamInput = z
  .object({
    id: idText,
    personId: idText,
    projectId: idText,
    roleId: idText,
    start: date,
    end: date,
  })
  .strict();
/** WRITES: a team member (legacy prepareTeamPayload). */
export async function saveTeamMember(id: string, raw: unknown) {
  const input = teamInput.parse(raw);
  const gates = await projectGates(id);
  const existing = teamOf(gates.context.raw).find((m) => m.id === input.id);
  if (input.id ? !gates.edit || !existing?.editable : !gates.addTeam)
    throw new AppError("FORBIDDEN", "This team member cannot be changed.", 403);
  inAward(gates.context, input.start, input.end);
  await requiredCheck(input, {
    personId: "projectTeam-staff-name",
    projectId: "project",
    roleId: "projectTeam-project-roles",
    start: "projectTeam-effective-start-date",
    end: "projectTeam-effective-end-date",
  });
  const choices = await projectChoices();
  const projects = projectsOf(gates.context.raw);
  if (
    !offered(choices.staff, input.personId) ||
    !offered(choices.roles, input.roleId) ||
    (input.projectId !== "" && !projects.some((p) => p.id === input.projectId))
  )
    throw new AppError("BAD_REQUEST", "A chosen value is not offered.", 400);
  await awards.saveTeamMember({
    body: {
      TEAM_MEMBER_ID: num(input.id),
      PERSON_ID: num(input.personId),
      PROJECT_ID: num(input.projectId),
      PROJECT_ROLE_ID: num(input.roleId),
      EFFECTIVE_START_DATE: input.start || null,
      EFFECTIVE_END_DATE: input.end || null,
      ERP_TEAM_MEMBER_ID: existing?.erpId || null,
    },
  });
  return { saved: true };
}

const money = z.number().finite();
const globalInput = z
  .object({ sponsor: money.min(0), institution: money, total: money.min(0) })
  .strict();
/** WRITES: the award's funder / institution split across its lines (legacy globalProjectCostAction save). */
export async function saveGlobalCosts(id: string, raw: unknown) {
  const input = globalInput.parse(raw);
  const gates = await projectGates(id);
  if (!gates.editGlobal)
    throw new AppError(
      "FORBIDDEN",
      "The award's costs cannot be changed.",
      403,
    );
  if (input.institution > input.total)
    throw new AppError(
      "BAD_REQUEST",
      "The institution cost cannot exceed the total.",
      400,
    );
  await awards.saveCostLine({
    body: {
      FILTER_AWARD_ID: gates.context.award.award_id,
      SponsorContribution: input.sponsor,
      InstituitionContribution: input.institution,
      TotalCost: input.total,
    },
  });
  return { saved: true };
}

/** The line a cost write names, found in the award's own lines (never trusted from the browser). */
function lineOf(context: AwardRecordContext, lineId: number) {
  const line = costLinesOf(context.raw).find((l) => l.id === lineId);
  if (!line)
    throw new AppError("BAD_REQUEST", "The cost line was not found.", 404);
  return line;
}

/** A cost line's periods (getAwardProjectCostItems) and its cost category's items, for the cost dialog. */
export async function costDialog(id: string, q: URLSearchParams) {
  const gates = await projectGates(id);
  const type = z
    .string()
    .regex(/^[A-Z0-9_]{1,40}$/)
    .safeParse(q.get("type"));
  const lineId = Number(q.get("line"));
  const line =
    Number.isSafeInteger(lineId) && lineId > 0
      ? lineOf(gates.context, lineId)
      : null;
  const [categoryItems, periods] = await Promise.all([
    type.success
      ? awards.costCategoryItems({ type: type.data }).then(
          (raw) =>
            items(
              z.object({
                cost_category_item_id: z.coerce.number(),
                cost_category_description: z.string().nullish(),
                gl_nominal_lkp_code: z.string().nullish(),
              }),
            ).parse(raw).items,
        )
      : [],
    line && line.costing_group_id !== null
      ? awards
          .costItems({
            awardId: gates.context.award.award_id,
            projectId: line.project_id,
            groupId: line.costing_group_id,
          })
          .then(
            (raw) =>
              items(
                z.object({
                  id: z.coerce.number(),
                  cost_start_date: z.string().nullish(),
                  cost_end_date: z.string().nullish(),
                  unit_type: z.string().nullish(),
                  quantity: z.coerce.number().nullish(),
                  project_hours: z.coerce.number().nullish(),
                  project_months: z.coerce.number().nullish(),
                  sponsor_contribution: z.coerce.number().nullish(),
                  instituition_contribution: z.coerce.number().nullish(),
                  total_cost: z.coerce.number().nullish(),
                }),
              ).parse(raw).items,
          )
      : [],
  ]);
  return {
    categoryItems: categoryItems.map((c) => ({
      value: String(c.cost_category_item_id),
      label: c.cost_category_description ?? String(c.cost_category_item_id),
      glNominal: c.gl_nominal_lkp_code ?? "",
    })),
    periods: periods.map((p) => ({
      id: String(p.id),
      start: day(p.cost_start_date),
      end: day(p.cost_end_date),
      unitType: str(p.unit_type),
      quantity: p.quantity ?? null,
      hours: p.project_hours ?? null,
      months: p.project_months ?? null,
      sponsor: p.sponsor_contribution ?? 0,
      institution: p.instituition_contribution ?? 0,
      total: p.total_cost ?? 0,
    })),
  };
}

const optionalNumber = z.number().finite().nullable();
const lineInput = z
  .object({
    level: z.enum(["LINE", "SECTION", "CATEGORY"]),
    /** The line edited (or the group's first line); null adds a line. */
    lineId: z.number().int().positive().nullable(),
    projectId: idText,
    section: z.string().max(40),
    category: z.string().max(40),
    itemId: idText,
    personId: idText,
    roleId: idText,
    unitType: z.string().max(40),
    units: optionalNumber,
    hours: optionalNumber,
    months: optionalNumber,
    description: text,
    glNominal: z.string().max(40),
    start: date,
    end: date,
    sponsor: money.min(0),
    institution: money,
    total: money.min(0),
  })
  .strict();
/**
 * WRITES: a cost line (LINE: AwardPrjCostItem, legacy prepareCostItempayload without ID) or a section's or category's
 * split (AwardPrjCostLine). Legacy defect fixed: a changed GL nominal is sent (legacy kept the first one).
 */
export async function saveCost(id: string, raw: unknown) {
  const input = lineInput.parse(raw);
  const gates = await projectGates(id);
  const context = gates.context;
  const line = input.lineId === null ? null : lineOf(context, input.lineId);
  if (
    line
      ? !gates.edit || !line.is_editable
      : !gates.addCost || input.level !== "LINE"
  )
    throw new AppError("FORBIDDEN", "This cost cannot be changed.", 403);
  if (input.institution > input.total)
    throw new AppError(
      "BAD_REQUEST",
      "The institution contribution cannot exceed the total.",
      400,
    );
  const project = projectsOf(context.raw).find(
    (p) => p.id === (line ? String(line.project_id) : input.projectId),
  );
  if (!project)
    throw new AppError(
      "BAD_REQUEST",
      "Choose one of the award's projects.",
      400,
    );
  if (input.level !== "LINE") {
    await awards.saveCostLine({
      body: {
        AwardProjectLinkId: line!.award_project_link_id ?? num(project.linkId),
        ProjectID: line!.project_id,
        SponsorContribution: input.sponsor,
        InstituitionContribution: input.institution,
        TotalCost: input.total,
        CostStartDate: line!.cost_start_date || null,
        CostEndDate: line!.cost_end_date || null,
        UnitType: line!.unit_type || null,
        costing_group_id: null,
        FUNDING_SECTION_LKP_CODE: line!.funding_section_lkp_code,
        ...(input.level === "CATEGORY"
          ? { COST_CATEGORY_TYPE: line!.cost_category_type_lkp_code }
          : {}),
      },
    });
    return { saved: true };
  }
  inAward(context, input.start, input.end);
  const choices = await projectChoices();
  if (
    !offered(choices.sections, input.section) ||
    !offered(choices.categories, input.category) ||
    !offered(choices.everyone, input.personId) ||
    !offered(choices.roles, input.roleId) ||
    !offered(choices.unitTypes, input.unitType) ||
    !offered(choices.glNominals, input.glNominal)
  )
    throw new AppError("BAD_REQUEST", "A chosen value is not offered.", 400);
  const person = choices.everyone.find((p) => p.value === input.personId);
  await awards.saveCostItem({
    body: {
      AwardProjectLinkId: line?.award_project_link_id ?? num(project.linkId),
      unit_type: input.unitType || null,
      units: input.units,
      project_months: input.months,
      project_hours: input.hours,
      ProjectID: Number(project.id),
      ItemDescription: input.description || person?.label || null,
      CostCategoryItemID: num(input.itemId),
      GLNominalCode: input.glNominal || null,
      PersonID: num(input.personId),
      ProjectRoleID: num(input.roleId),
      CostStartDate: input.start || null,
      CostEndDate: input.end || null,
      SponsorContribution: input.sponsor,
      InstituitionContribution: input.institution,
      TotalCost: input.total,
      funding_section_lkp_code: input.section || null,
      costing_group_id: line?.costing_group_id ?? null,
    },
  });
  return { saved: true };
}

const periodInput = z
  .object({
    lineId: z.number().int().positive(),
    /** The period item edited; null adds one. */
    itemId: z.number().int().positive().nullable(),
    start: date,
    end: date,
    unitType: z.string().max(40),
    quantity: optionalNumber,
    hours: optionalNumber,
    months: optionalNumber,
    sponsor: money.min(0),
    institution: money.min(0),
    total: money.min(0),
  })
  .strict();
/** WRITES: one period of a cost line (legacy saveCostRow, LINE). Legacy defect fixed: hours and months are sent. */
export async function saveCostPeriod(id: string, raw: unknown) {
  const input = periodInput.parse(raw);
  const gates = await projectGates(id);
  const line = lineOf(gates.context, input.lineId);
  if (
    !gates.edit ||
    !line.is_editable ||
    (input.itemId === null && !gates.addCost)
  )
    throw new AppError("FORBIDDEN", "This cost cannot be changed.", 403);
  // A period sits inside its line's dates (legacy getPeriodDateBound over the line).
  inAward(
    gates.context,
    input.start,
    input.end,
    line.cost_start_date || day(gates.context.award.award_start_date),
    line.cost_end_date || day(gates.context.award.award_end_date),
  );
  if (input.institution > input.total || input.sponsor > input.total)
    throw new AppError(
      "BAD_REQUEST",
      "A contribution cannot exceed the total.",
      400,
    );
  await awards.saveCostItem({
    body: {
      ...(input.itemId === null ? {} : { ID: input.itemId }),
      AwardProjectLinkId: line.award_project_link_id,
      ProjectID: line.project_id,
      SponsorContribution: input.sponsor,
      InstituitionContribution: input.institution,
      TotalCost: input.total,
      CostStartDate: input.start || null,
      CostEndDate: input.end || null,
      UnitType: input.unitType || null,
      Units: input.quantity,
      project_hours: input.hours,
      project_months: input.months,
      costing_group_id: line.costing_group_id,
    },
  });
  return { saved: true };
}

const removeInput = z
  .object({
    lineId: z.number().int().positive(),
    /** A period item; absent deletes the whole line (its costing group). */
    itemId: z.number().int().positive().optional(),
  })
  .strict();
/** WRITES: deletes a cost line (legacy deleteRow, the whole costing group) or one of its periods. */
export async function deleteCost(id: string, raw: unknown) {
  const input = removeInput.parse(raw);
  const gates = await projectGates(id);
  const line = lineOf(gates.context, input.lineId);
  if (!gates.remove || !line.is_editable)
    throw new AppError("FORBIDDEN", "This cost cannot be deleted.", 403);
  if (input.itemId !== undefined)
    await awards.deleteCost({ itemId: input.itemId });
  else if (line.costing_group_id !== null)
    await awards.deleteCost({ groupId: line.costing_group_id });
  else await awards.deleteCost({ itemId: line.id });
  return { deleted: true };
}

/** WRITES: copies a cost line from its first item (legacy cloneButtonActionChain). */
export async function cloneCost(id: string, raw: unknown) {
  const input = z
    .object({ lineId: z.number().int().positive() })
    .strict()
    .parse(raw);
  const gates = await projectGates(id);
  const line = lineOf(gates.context, input.lineId);
  if (!gates.edit || !line.is_editable)
    throw new AppError("FORBIDDEN", "This cost cannot be copied.", 403);
  await awards.copyCostItem({ itemId: line.id });
  return { cloned: true };
}
