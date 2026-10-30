import "server-only";
import moment from "moment";
import { z } from "zod";
import { AppError } from "@/lib/errors";
import { recordIdentity } from "@/features/modules/proposals/record";
import { proposals, lookups, people } from "@/server/oracle/api";
import { proposalPage } from "./record";

const kind = z.enum([
  "quick",
  "staff",
  "student",
  "pool-tech",
  "non-staff",
  "research-partner",
]);
const row = z.object({
  section: z.string().min(1).max(100),
  category: z.string().min(1).max(100),
  item: z.string().min(1).max(100),
  description: z.string().max(500),
  personId: z.number().int().positive().nullable(),
  startDate: z.iso.date(),
  endDate: z.iso.date(),
  units: z.number().positive(),
  cost: z.number().nonnegative().nullable(),
});
export const quickCostInput = z.object({
  kind,
  versionId: z.number().int().positive(),
  rows: z.array(row).min(1).max(50),
});

const list = z.object({ items: z.array(z.record(z.string(), z.unknown())) });
const summary = z.object({
  proposal_id: z.number().int().positive(),
  proposal_status: z.string(),
  proposal_period_version_id: z.number().int().positive(),
  cost_model: z.union([z.string(), z.number()]),
  proposal_start_date: z.string().nullish(),
  proposal_end_date: z.string().nullish(),
  currency_code: z.string().nullish(),
  departments: z
    .array(z.object({ org_unit_id: z.number().nullish() }))
    .nullish(),
});
const rawText = (value: unknown) =>
  typeof value === "string" || typeof value === "number" ? String(value) : "";
const isoDate = (value: string | null | undefined, fallback: string) => {
  const date = moment(
    value,
    ["YYYY-MM-DD", "DD-MMM-YYYY", "DD-MM-YYYY", "MM-DD-YYYY"],
    true,
  );
  return date.isValid() ? date.format("YYYY-MM-DD") : fallback;
};
const options = (items: Record<string, unknown>[], key: string, name: string) =>
  items.flatMap((item) => {
    const value = rawText(item[key]);
    return value ? [{ value, label: rawText(item[name]) || value }] : [];
  });

async function scope(
  type: string,
  id: string,
  action: z.infer<typeof kind>,
  versionId?: number,
) {
  const identity = recordIdentity.parse({ type, id });
  const context = await proposalPage(identity.type, id, "proposals-budget");
  const role =
    action === "quick"
      ? "quick-costing"
      : action === "research-partner"
        ? "proposals-budget-collab"
        : `proposals-budget-${action}`;
  if (context.access.get(role)?.edit !== true)
    throw new AppError("FORBIDDEN", "Budget costing is unavailable.", 403);
  const data = summary.parse(await proposals.summary({ id }));
  if (
    String(data.proposal_id) !== id ||
    data.proposal_status !== "DRFT" ||
    context.rights.edit !== true ||
    (versionId !== undefined && data.proposal_period_version_id !== versionId)
  )
    throw new AppError("FORBIDDEN", "This Budget cannot be edited.", 403);
  const budgetPageId = context.pageIds.get("proposals-budget");
  if (
    budgetPageId != null &&
    context.summary.lockedPageIds.includes(budgetPageId)
  )
    throw new AppError("FORBIDDEN", "This Budget is locked.", 403);
  return { context, data };
}

async function references(
  type: string,
  id: string,
  action: z.infer<typeof kind>,
  versionId?: number,
) {
  const { data } = await scope(type, id, action, versionId);
  const [sectionsRaw, rolesRaw, itemsRaw, categoriesRaw, peopleRaw] =
    await Promise.all([
      proposals.fundingSections({ costModel: String(data.cost_model) }),
      proposals.projectRoles({ costType: "STAFF" }),
      proposals.costItems(),
      lookups.codes({ types: "COST_CATEGORY_TYPES" }),
      people.inOrg({}),
    ]);
  const sections = list.parse(sectionsRaw).items;
  const projectRoles = list.parse(rolesRaw).items;
  const costItems = list.parse(itemsRaw).items;
  const categories = list.parse(categoriesRaw).items;
  const allPeople = list.parse(peopleRaw).items;
  const flag =
    type === "OUTLINE_PROPOSAL"
      ? "costing_allowed_op_flag"
      : "costing_allowed_prop_flag";
  const flagged = allPeople.some((person) => rawText(person[flag]) !== "");
  const eligible = allPeople.filter(
    (person) => person[flagged ? flag : "costing_allowed_flag"] === "Y",
  );
  return {
    versionId: data.proposal_period_version_id,
    sections: options(sections, "lookup_code", "lookup_code_value"),
    roles: options(projectRoles, "project_role_code", "project_role_name"),
    categories: options(
      categories.filter(
        (item) => item.lookup_type_code === "COST_CATEGORY_TYPES",
      ),
      "lookup_code",
      "lookup_code_value",
    ),
    items: costItems.map((item) => ({
      category: rawText(item.cost_category_type_lkp_code),
      value: rawText(item.cost_item_lkp_code),
      label: rawText(item.cost_item_desc),
    })),
    people: eligible.map((person) => ({
      value: rawText(person.person_id),
      label: rawText(person.full_name),
      employeeNumber: rawText(person.employee_number),
      orgUnitId: Number(person.org_unit_id) || null,
    })),
  };
}

export async function quickCostOptions(
  type: string,
  id: string,
  action: string,
) {
  return references(type, id, kind.parse(action));
}

export async function saveQuickCost(type: string, id: string, input: unknown) {
  const parsed = quickCostInput.parse(input);
  const { data } = await scope(type, id, parsed.kind, parsed.versionId);
  const choices = await references(type, id, parsed.kind, parsed.versionId);
  if (
    (parsed.kind === "non-staff" || parsed.kind === "research-partner") &&
    parsed.rows.length !== 1
  )
    throw new AppError("BAD_REQUEST", "Add one cost at a time.", 400);
  const has = (values: { value: string; label: string }[], value: string) =>
    values.some((choice) => choice.value === value);
  const rows = parsed.rows.map((entry) => {
    if (
      !has(choices.sections, entry.section) ||
      !has(choices.categories, entry.category) ||
      entry.endDate < entry.startDate
    )
      throw new AppError("BAD_REQUEST", "Invalid Quick Cost row.", 400);
    if (
      ((parsed.kind === "non-staff" || parsed.kind === "research-partner") &&
        entry.category === "STAFF") ||
      (["staff", "student", "pool-tech"].includes(parsed.kind) &&
        entry.category !== "STAFF") ||
      (parsed.kind === "student" && entry.item !== "STUD") ||
      (parsed.kind === "pool-tech" && entry.item !== "POOL_TECH")
    )
      throw new AppError("BAD_REQUEST", "Invalid cost category or role.", 400);
    if (entry.category === "STAFF") {
      const person = listPerson(entry.personId, choices.people);
      if (!has(choices.roles, entry.item))
        throw new AppError("BAD_REQUEST", "Invalid project role.", 400);
      return {
        APP_COST_MODEL: data.cost_model,
        COST_CATEGORY_ITEM_LKP_CODE: entry.item,
        COST_CATEGORY_LKP_CODE: entry.category,
        EMPLOYEE_NUMBER: person.employeeNumber,
        END_DATE: entry.endDate,
        FUNDING_SECTION_HEADER_LKP_CODE: entry.section,
        UNITS: entry.units,
        ITEM_DESCRIPTION: person.label,
        ORG_UNIT_ID: person.orgUnitId,
        PERSON_ID: Number(person.value),
        PROJECT_ROLE_LKP_CODE: entry.item,
        PROPOSAL_ID: Number(id),
        PROPOSAL_PERIOD_VERSION_ID: parsed.versionId,
        START_DATE: entry.startDate,
        SAL_MODEL_FIELDS: {},
        INDIRECT_COST_FIELDS: {},
      };
    }
    if (
      !choices.items.some(
        (item) => item.category === entry.category && item.value === entry.item,
      ) ||
      !entry.description.trim() ||
      entry.cost === null
    )
      throw new AppError("BAD_REQUEST", "Invalid nonstaff cost item.", 400);
    return {
      APP_COST_MODEL: data.cost_model,
      COST_CATEGORY_ITEM_LKP_CODE: entry.item,
      COST_CATEGORY_LKP_CODE: entry.category,
      END_DATE: entry.endDate,
      FUNDING_SECTION_HEADER_LKP_CODE: entry.section,
      INDIRECT_COST_FIELDS: {},
      ITEM_DESCRIPTION: entry.description,
      PROPOSAL_ID: Number(id),
      START_DATE: entry.startDate,
      UNITS: entry.units,
      BASELINE_COST: entry.cost,
      ORG_UNIT_ID: data.departments?.[0]?.org_unit_id ?? null,
    };
  });
  if (parsed.kind === "non-staff" || parsed.kind === "research-partner") {
    const entry = parsed.rows[0];
    const salary = parsed.kind === "research-partner" ? "COLLAB" : "NON_SAL";
    const result = z
      .object({
        costing_line_json: z.array(
          z.object({
            costing_header_id: z.coerce.number().int().positive(),
            costing_line_id: z.coerce.number().int().positive(),
            costmodel_id: z.union([z.string(), z.number()]).nullish(),
          }),
        ),
      })
      .parse(
        await proposals.insertCostingHeader({
          body: {
            START_DATE: entry.startDate,
            END_DATE: entry.endDate,
            PROPOSAL_ID: Number(id),
            EMPLOYEE_NUMBER: "na",
            APP_COST_MODEL: data.cost_model,
            SALARY_MODEL_LKP_CODE: salary,
            COST_CATEGORY_LKP_CODE: entry.category,
            COST_CATEGORY_ITEM_LKP_CODE: entry.item,
            FUNDING_SECTION_HEADER_LKP_CODE: entry.section,
            ITEM_DESCRIPTION: entry.description,
            PROPOSAL_PERIOD_VERSION_ID: parsed.versionId,
            UNITS: entry.units,
            UNIT_TYPE: "ITEM",
            UNIT_COST: entry.cost,
            CURRENCY_CODE: data.currency_code ?? "GBP",
          },
        }),
      );
    const line = result.costing_line_json[0];
    if (!line)
      throw new AppError("CONTRACT", "Oracle did not create a cost line.");
    await proposals.saveCostingLines({
      rows: [
        {
          costing_line_id: line.costing_line_id,
          costing_header_id: line.costing_header_id,
          costmodel_id: line.costmodel_id ?? data.cost_model,
          funding_section_hdr: entry.section,
          cost_category_type: entry.category,
          cost_category_item: entry.item,
          currency_code: data.currency_code ?? "GBP",
          exchange_rate: 1,
          start_date: entry.startDate,
          end_date: entry.endDate,
          proposal_id: Number(id),
          proposal_start_date: isoDate(
            data.proposal_start_date,
            entry.startDate,
          ),
          proposal_end_date: isoDate(data.proposal_end_date, entry.endDate),
          fte: null,
          units: entry.units,
          unit_cost: entry.cost,
          unit_type: "ITEM",
          baseline_cost: entry.units * (entry.cost ?? 0),
          salary_model: salary,
          cost_type:
            parsed.kind === "research-partner" ? "COLLAB" : "NON_STAFF",
        },
      ],
    });
  } else {
    await proposals.insertCostingBulk({ rows });
  }
  return { saved: true };
}

function listPerson(
  personId: number | null,
  people: {
    value: string;
    label: string;
    employeeNumber: string;
    orgUnitId: number | null;
  }[],
) {
  const person = people.find((item) => item.value === String(personId));
  if (!person)
    throw new AppError("BAD_REQUEST", "Invalid costing person.", 400);
  return person;
}
