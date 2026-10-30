import "server-only";
import { cache } from "react";
import { z } from "zod";
import { proposals } from "@/server/oracle/api";
import { AppError } from "@/lib/errors";
import type { RecordIdentity } from "@/features/modules/proposals/record";
import { proposalContext, proposalPage } from "./record";

const amount = z.union([z.number(), z.string()]).nullish();
const costRow = z.object({
  proposal_id: z.number().int().positive(),
  proposal_number: z.string(),
  collab_id: z.union([z.number(), z.string()]).nullish(),
  collab_name: z.string().nullish(),
  sub_proposal_type: z.string().nullish(),
  costing_header_id: z.union([z.number(), z.string()]).nullish(),
  funding_header: z.union([z.number(), z.string()]).nullish(),
  funding_header_description: z.string().nullish(),
  cost_category_lkp_code: z.string().nullish(),
  cost_category_type_value: z.string().nullish(),
  staff_name: z.string().nullish(),
  project_role: z.string().nullish(),
  fte: amount,
  avg_fte: amount,
  project_hours: amount,
  project_months: amount,
  unindex_cost: amount,
  fec_cost: amount,
  cost_year_splits: z
    .array(
      z.object({
        period_label: z.string(),
        unindexed_cost: amount,
        indexed_cost: amount,
      }),
    )
    .nullish(),
});
const response = z.object({ items: z.array(costRow) });
const versionResponse = z.object({
  items: z.array(
    z.object({
      proposal_period_version_id: z.coerce.number().int().positive(),
      version: z.string(),
    }),
  ),
});
type CostRow = z.infer<typeof costRow>;
type YearSplit = {
  period: string;
  unindexed: string | number;
  indexed: string | number;
};

function yearSplits(rows: CostRow[]): YearSplit[] {
  const periods = new Map<string, YearSplit>();
  for (const row of rows)
    for (const split of row.cost_year_splits ?? []) {
      const current = periods.get(split.period_label);
      periods.set(split.period_label, {
        period: split.period_label,
        unindexed: sumCost([current?.unindexed, split.unindexed_cost]),
        indexed: sumCost([current?.indexed, split.indexed_cost]),
      });
    }
  return [...periods.values()];
}

export function sumCost(values: (string | number | null | undefined)[]) {
  let total = 0;
  for (const value of values) {
    if (value === null || value === undefined || value === "") continue;
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return String(value);
    total += parsed;
  }
  return total;
}

export function mapBudget(raw: unknown, proposalId: string) {
  const parsed = response.safeParse(raw);
  if (!parsed.success)
    throw new AppError(
      "CONTRACT",
      "Oracle returned an invalid Proposal Budget.",
    );
  const rows = parsed.data.items;
  if (rows.some((row) => String(row.proposal_id) !== proposalId))
    throw new AppError(
      "FORBIDDEN",
      "A Budget line is outside this Proposal scope.",
      403,
    );
  const projects = new Map<string, CostRow[]>();
  for (const row of rows) {
    const key = `${row.proposal_id}:${row.collab_id ?? "primary"}`;
    const project = projects.get(key) ?? [];
    project.push(row);
    projects.set(key, project);
  }
  return {
    ...mapLines(rows),
    projects: [...projects].map(([key, projectRows]) => ({
      id: key,
      reference: projectRows[0].proposal_number,
      name:
        projectRows[0].collab_name ||
        projectRows[0].sub_proposal_type ||
        "Primary",
      ...mapLines(projectRows),
    })),
  };
}

function mapLines(rows: CostRow[]) {
  const funding = new Map<
    string,
    {
      id: string;
      name: string;
      categories: Map<
        string,
        { id: string; code: string; name: string; rows: CostRow[] }
      >;
    }
  >();
  for (const row of rows) {
    const fundingId = String(row.funding_header ?? "unassigned");
    let group = funding.get(fundingId);
    if (!group) {
      group = {
        id: fundingId,
        name: row.funding_header_description || "Funding",
        categories: new Map(),
      };
      funding.set(fundingId, group);
    }
    const categoryId = row.cost_category_lkp_code || "other";
    let category = group.categories.get(categoryId);
    if (!category) {
      category = {
        id: categoryId,
        code: row.cost_category_lkp_code || "",
        name: row.cost_category_type_value || categoryId,
        rows: [],
      };
      group.categories.set(categoryId, category);
    }
    category.rows.push(row);
  }
  return {
    groups: [...funding.values()].map((group) => ({
      id: group.id,
      name: group.name,
      categories: [...group.categories.values()]
        .sort((a, b) => Number(b.code === "STAFF") - Number(a.code === "STAFF"))
        .map((category) => ({
          id: category.id,
          code: category.code,
          name: category.name,
          rows: category.rows.map((row, index) => ({
            id: String(row.costing_header_id ?? `${category.id}-${index}`),
            name: row.staff_name || "Cost item",
            role: row.project_role || "",
            fte: row.fte ?? "",
            averageFte: row.avg_fte ?? "",
            hours:
              row.project_hours === null ||
              row.project_hours === undefined ||
              row.project_hours === ""
                ? 0
                : row.project_hours,
            months: row.project_months ?? "",
            unindexed: row.unindex_cost ?? "",
            total: row.fec_cost ?? "",
            yearSplits: yearSplits([row]),
          })),
          unindexed: sumCost(category.rows.map((row) => row.unindex_cost)),
          total: sumCost(category.rows.map((row) => row.fec_cost)),
          yearSplits: yearSplits(category.rows),
        })),
      unindexed: sumCost(
        [...group.categories.values()].flatMap((category) =>
          category.rows.map((row) => row.unindex_cost),
        ),
      ),
      total: sumCost(
        [...group.categories.values()].flatMap((category) =>
          category.rows.map((row) => row.fec_cost),
        ),
      ),
      yearSplits: yearSplits(
        [...group.categories.values()].flatMap((category) => category.rows),
      ),
    })),
    unindexed: sumCost(rows.map((row) => row.unindex_cost)),
    total: sumCost(rows.map((row) => row.fec_cost)),
    yearSplits: yearSplits(rows),
  };
}

export function staffLine(
  budget: ReturnType<typeof mapBudget>,
  costHeaderId: number,
) {
  const line = budget.groups
    .flatMap((group) => group.categories)
    .filter((category) => category.code === "STAFF")
    .flatMap((category) => category.rows)
    .find((row) => row.id === String(costHeaderId));
  if (!line)
    throw new AppError(
      "FORBIDDEN",
      "Staff cost is outside this Proposal.",
      403,
    );
  return line;
}

export const budgetVersions = cache(
  async (type: RecordIdentity["type"], id: string) => {
    await proposalContext(type, id);
    const raw = await proposals.budgetVersions({ proposalId: id });
    const parsed = versionResponse.safeParse(raw);
    if (!parsed.success)
      throw new AppError(
        "CONTRACT",
        "Oracle returned an invalid Proposal Budget version list.",
      );
    return parsed.data.items.map((item) => ({
      id: item.proposal_period_version_id,
      label: item.version,
    }));
  },
);

export async function proposalBudget(
  type: RecordIdentity["type"],
  id: string,
  previewVersionId?: number,
) {
  const context = await proposalPage(type, id, "proposals-budget");
  if (previewVersionId !== undefined) {
    const choices = await budgetVersions(type, id);
    if (!choices.some((choice) => choice.id === previewVersionId))
      throw new AppError("BAD_REQUEST", "Invalid Budget version.", 400);
  }
  const versionId = previewVersionId ?? context.summary.budgetVersionId;
  if (versionId === null)
    return {
      ...mapBudget({ items: [] }, id),
      bundle: context.bundle,
      reference: context.summary.reference,
      canReadStaff: context.access.get("proposals-budget-staff")?.read === true,
      actions: budgetActions(context),
      versionId: null,
    };
  const raw = await proposals.costSummary({ proposalId: id, versionId });
  return {
    ...mapBudget(raw, id),
    bundle: context.bundle,
    reference: context.summary.reference,
    canReadStaff: context.access.get("proposals-budget-staff")?.read === true,
    actions: budgetActions(context),
    versionId,
  };
}

function budgetActions(context: Awaited<ReturnType<typeof proposalPage>>) {
  const budgetPageId = context.pageIds.get("proposals-budget");
  const editable =
    context.summary.statusCode === "DRFT" &&
    context.access.get("proposals-budget")?.edit === true &&
    (budgetPageId == null ||
      !context.summary.lockedPageIds.includes(budgetPageId));
  return {
    editable,
    staff: context.access.get("proposals-budget-staff")?.read === true,
    student: context.access.get("proposals-budget-student")?.read === true,
    poolTech: context.access.get("proposals-budget-pool-tech")?.read === true,
    nonStaff: context.access.get("proposals-budget-non-staff")?.read === true,
    researchPartner:
      context.access.get("proposals-budget-collab")?.read === true,
    staffEdit: context.access.get("proposals-budget-staff")?.edit === true,
    studentEdit: context.access.get("proposals-budget-student")?.edit === true,
    poolTechEdit:
      context.access.get("proposals-budget-pool-tech")?.edit === true,
    nonStaffEdit:
      context.access.get("proposals-budget-non-staff")?.edit === true,
    researchPartnerEdit:
      context.access.get("proposals-budget-collab")?.edit === true,
  };
}

const staffHeaderResponse = z.object({
  cost_header: z.object({
    costing_header_id: z.coerce.number().int().positive(),
    item_description: z.string().nullish(),
    org_unit_name: z.string().nullish(),
    employee_number: z.union([z.string(), z.number()]).nullish(),
    school: z.string().nullish(),
    probation_end_date: z.string().nullish(),
    increment_month: z.string().nullish(),
    funding_section_header_lkp_code: z.string().nullish(),
    inflation_rate: amount,
    cost_category_item_lkp_code: z.string().nullish(),
    salary_model_lkp_code: z.string().nullish(),
    person_id: z.number().int().positive().nullish(),
    org_unit_id: z.number().int().positive().nullish(),
  }),
  person_master_view_details: z
    .object({
      full_name: z.string().nullish(),
      employee_number: z.union([z.string(), z.number()]).nullish(),
      org_unit_name: z.string().nullish(),
      hr_fte: amount,
      person_id: z.number().int().positive().nullish(),
      org_unit_id: z.number().int().positive().nullish(),
      probation_end_date: z.string().nullish(),
      increment_month: z.string().nullish(),
    })
    .nullish(),
});
const staffLinesResponse = z.object({
  items: z.array(
    z.object({
      costing_line_id: z.coerce.number().int().positive(),
      costing_header_id: z.coerce.number().int().positive(),
      start_date: z.string().nullish(),
      end_date: z.string().nullish(),
      fte: amount,
      units: amount,
      unit_cost: amount,
      fec_total: amount,
    }),
  ),
});

export async function proposalStaffCost(
  type: RecordIdentity["type"],
  id: string,
  costHeaderId: number,
  previewVersionId?: number,
) {
  const context = await proposalPage(type, id, "proposals-budget-staff");
  const budget = await proposalBudget(type, id, previewVersionId);
  const line = staffLine(budget, costHeaderId);
  const [headerRaw, linesRaw] = await Promise.all([
    proposals.costHeaderDetails({ costHeaderId: String(costHeaderId) }),
    proposals.costingLines({ costHeaderId: String(costHeaderId) }),
  ]);
  const header = staffHeaderResponse.safeParse(headerRaw);
  const lines = staffLinesResponse.safeParse(linesRaw);
  if (!header.success || !lines.success)
    throw new AppError(
      "CONTRACT",
      "Oracle returned invalid Staff costing details.",
    );
  if (
    header.data.cost_header.costing_header_id !== costHeaderId ||
    lines.data.items.some((item) => item.costing_header_id !== costHeaderId)
  )
    throw new AppError(
      "FORBIDDEN",
      "Staff cost is outside this Proposal.",
      403,
    );
  const person = header.data.person_master_view_details;
  const cost = header.data.cost_header;
  const canViewSensitive =
    context.access.get("prop-staff-sensitive-data")?.read === true;
  const fundingSection = budget.groups.find((group) =>
    group.categories.some((category) =>
      category.rows.some((row) => row.id === String(costHeaderId)),
    ),
  );
  return {
    reference: budget.reference,
    costModel:
      context.summary.detailColumns
        .flat()
        .find((field) => field.key === "detail-cost-model")?.value ?? "",
    personId: person?.person_id ?? cost.person_id ?? null,
    orgUnitId: person?.org_unit_id ?? cost.org_unit_id ?? null,
    name: cost.item_description || person?.full_name || line.name,
    employeeNumber: String(
      cost.employee_number ?? person?.employee_number ?? "",
    ),
    orgUnit: cost.org_unit_name || person?.org_unit_name || "",
    faculty: cost.school || "",
    probationEndDate:
      cost.probation_end_date || person?.probation_end_date || "",
    firstIncrement: cost.increment_month || person?.increment_month || "",
    projectRole: line.role || cost.cost_category_item_lkp_code || "",
    fundingSection:
      fundingSection?.name || cost.funding_section_header_lkp_code || "",
    salaryModel: cost.salary_model_lkp_code || "",
    hrFte: person?.hr_fte ?? "",
    overrideInflation: cost.inflation_rate != null,
    lines: lines.data.items.map((item) => ({
      id: item.costing_line_id,
      startDate: item.start_date || "",
      endDate: item.end_date || "",
      fte: item.fte ?? "",
      units: item.units ?? "",
      unitCost: canViewSensitive ? (item.unit_cost ?? "") : null,
      total: canViewSensitive ? (item.fec_total ?? "") : null,
    })),
  };
}

const contactResponse = z.object({
  full_name: z.string().nullish(),
  employee_number: z.union([z.string(), z.number()]).nullish(),
  email_address: z.string().nullish(),
  org_unit_name: z.string().nullish(),
  position: z.string().nullish(),
  school: z.string().nullish(),
  address_line: z.string().nullish(),
});

export async function proposalStaffContact(
  type: RecordIdentity["type"],
  id: string,
  costHeaderId: number,
  previewVersionId?: number,
) {
  const cost = await proposalStaffCost(
    type,
    id,
    costHeaderId,
    previewVersionId,
  );
  if (!cost.personId)
    throw new AppError(
      "BUSINESS",
      "Staff contact details are unavailable.",
      404,
    );
  const raw = await proposals.contactDetails({
    recordType: "PI",
    personId: String(cost.personId),
    departmentId: String(cost.orgUnitId ?? 0),
  });
  const parsed = contactResponse.safeParse(raw);
  if (!parsed.success)
    throw new AppError(
      "CONTRACT",
      "Oracle returned invalid Staff contact details.",
    );
  const person = parsed.data;
  return {
    fullName: person.full_name || cost.name,
    employeeNumber: String(person.employee_number ?? cost.employeeNumber),
    email: person.email_address || "",
    orgUnit: person.org_unit_name || "",
    position: person.position || "",
    school: person.school || "",
    address: person.address_line || "",
  };
}
