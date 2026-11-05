import "server-only";
import { z } from "zod";
import { AppError } from "@/lib/errors";
import { proposals, dynamicForm, lookups } from "@/server/oracle/api";
import { mapForms } from "@/server/record/dynamic-form/forms";
import { serverFunctions } from "@/server/functions";
import { costingScope, quickCostOptions } from "./quick-cost";

const kind = z.enum(["staff", "student", "pool-tech"]);
export type StaffKind = z.infer<typeof kind>;
const items = z.object({ items: z.array(z.record(z.string(), z.unknown())) });
const value = (x: unknown) =>
  typeof x === "string" || typeof x === "number" ? String(x) : "";
const isoDate = (x: unknown) => {
  const text = value(x);
  return /^\d{4}-\d{2}-\d{2}(?:T|$)/.test(text) ? text.slice(0, 10) : "";
};
const option = (row: Record<string, unknown>, code: string, label: string) => ({
  value: value(row[code]),
  label: value(row[label]) || value(row[code]),
});

export async function staffEntryOptions(
  type: string,
  id: string,
  inputKind: string,
) {
  const selected = kind.parse(inputKind);
  const [{ context, data }, base] = await Promise.all([
    costingScope(type, id, selected),
    quickCostOptions(type, id, selected),
  ]);
  const costModel = String(data.cost_model);
  const [salaryRaw, defaultSectionRaw, formsRaw, orgRaw, unitRaw] = await Promise.all([
    proposals.salaryModels({
      costModel,
      costType:
        selected === "staff"
          ? "STAFF"
          : selected === "student"
            ? "STUD"
            : "POOL_TECH",
    }),
    selected === "staff"
      ? Promise.resolve(null)
      : proposals.roleFundingSection({
          costModel,
          role: selected === "student" ? "STUD" : "POOL_TECH",
        }),
    dynamicForm.costForms({ proposalId: id, proposalType: type }),
    lookups.orgUnits({}),
    lookups.codes({ types: "STAFF_UNIT_TYPE" }),
  ]);
  const salaries = items
    .parse(salaryRaw)
    .items.map((row) => option(row, "lookup_code", "lookup_code_descr"))
    .filter((item) => item.value);
  const sectionRows = defaultSectionRaw
    ? items.parse(defaultSectionRaw).items
    : [];
  const orgRows = items
    .parse(orgRaw)
    .items.map((row) =>
      Object.fromEntries(
        Object.entries(row).map(([key, entry]) => [key.toLowerCase(), entry]),
      ),
    );
  const normalizedOrgUnits = serverFunctions.organizations.orgUnitRows(orgRaw);
  const forms = mapForms(formsRaw);
  return {
    ...base,
    kind: selected,
    costModel,
    costModelName:
      context.summary.detailColumns
        .flat()
        .find((field) => field.key === "detail-cost-model")?.value || costModel,
    proposalStartDate: value(data.proposal_start_date),
    proposalEndDate: value(data.proposal_end_date),
    salaryModels: salaries,
    canEditBaseline:
      context.access.get("prop-staff-hdr-sal-data")?.edit === true,
    unitTypes: items.parse(unitRaw).items
      .map((row) => option(row, "lookup_code", "lookup_code_descr"))
      .filter((item) => item.value),
    orgUnits: normalizedOrgUnits.map((row) => ({
      value: row.id,
      label: row.name,
      faculty: value(
        orgRows.find((org) => value(org.org_unit_id) === row.id)?.phro_name,
      ),
    })),
    defaultSection: value(sectionRows[0]?.fund_hdr_code),
    defaultRole:
      selected === "student"
        ? "STUD"
        : selected === "pool-tech"
          ? "POOL_TECH"
          : "",
    defaultSalaryModel:
      selected === "student"
        ? "STI"
        : selected === "pool-tech"
          ? "POOL_TECH"
          : "",
    additionalFields: forms.flatMap((form) =>
      form.sections.flatMap((section) =>
        section.fields
          .filter((field) => field.isVisible === "Y")
          .map((field) => ({
            formId: form.formId,
            sectionId: section.sectionId,
            fieldId: field.fieldId,
            sectionName: section.sectionName,
            label: field.description,
            required: field.isRequired === "Y",
            type: field.fieldType,
            defaultValue: field.defaultValue ?? "",
            options: (field.options ?? []).map((entry) => ({
              value: String(entry.optionId),
              label: entry.optionValue,
            })),
          })),
      ),
    ),
  };
}

const personResponse = z.object({
  Employee_Details: z.array(z.record(z.string(), z.unknown())).min(1),
});
export async function staffEntryPerson(
  type: string,
  id: string,
  personId: number,
) {
  if (!Number.isSafeInteger(personId) || personId <= 0)
    throw new AppError("BAD_REQUEST", "Invalid staff person.", 400);
  const options = await staffEntryOptions(type, id, "staff");
  const person = options.people.find((item) => item.value === String(personId));
  if (!person || !person.orgUnitId)
    throw new AppError(
      "FORBIDDEN",
      "This person is unavailable for costing.",
      403,
    );
  const raw = await proposals.costingPersonDetails({
    proposalId: id,
    personId,
    orgUnitId: person.orgUnitId,
  });
  const parsed = personResponse.safeParse(raw);
  if (!parsed.success)
    throw new AppError(
      "CONTRACT",
      `Oracle staff details are incomplete at ${parsed.error.issues.map((issue) => issue.path.join(".")).join(", ")}.`,
    );
  const detail = parsed.data.Employee_Details[0];
  if (Number(detail.PERSON_ID) !== personId)
    throw new AppError("CONTRACT", "Oracle returned another staff person.");
  return {
    personId,
    name: value(detail.FULL_NAME),
    employeeNumber: value(detail.EMPLOYEE_NUMBER),
    orgUnitId: Number(detail.ORG_UNIT_ID) || person.orgUnitId,
    orgUnitName: value(detail.ORG_UNIT_NAME) || person.orgUnitName,
    faculty: value(detail.FACULTY_NAME),
    probationEndDate: isoDate(detail.PROBATION_END_DATE),
    firstIncrement: value(detail.INCREMENT_MONTH),
    projectRole: value(detail.PROJECT_ROLE_LKP_CODE),
    fundingSection: value(detail.FUNDING_SECTION_HEADER_LKP_CODE),
    salaryModel: value(detail.SALARY_MODEL_LKP_CODE),
    hrFte: value(detail.HR_FTE),
  };
}

const availabilityResponse = z.object({
  items: z.array(
    z.object({
      proposal_number: z.string(),
      cost_start_date: z.string(),
      cost_end_date: z.string(),
      fte: z.coerce.number(),
    }),
  ),
});

export async function staffEntryAvailability(
  type: string,
  id: string,
  personId: number,
) {
  const person = await staffEntryPerson(type, id, personId);
  const { data } = await costingScope(type, id, "staff");
  const startDate = isoDate(data.proposal_start_date);
  const endDate = isoDate(data.proposal_end_date);
  if (!startDate || !endDate)
    throw new AppError("CONTRACT", "Proposal dates are unavailable.");
  const raw = await proposals.staffTimeReport({
    employeeNumber: person.employeeNumber,
    startDate,
    endDate,
  });
  const parsed = availabilityResponse.safeParse(raw);
  if (!parsed.success)
    throw new AppError("CONTRACT", "Staff availability data is incomplete.");
  return {
    startDate,
    endDate,
    items: parsed.data.items
      .map((item) => ({
        proposalNumber: item.proposal_number,
        startDate: isoDate(item.cost_start_date),
        endDate: isoDate(item.cost_end_date),
        fte: item.fte,
      }))
      .filter((item) => item.startDate && item.endDate),
  };
}

const headerInput = z.object({
  kind,
  versionId: z.number().int().positive(),
  personId: z.number().int().positive().nullable(),
  name: z.string().trim().min(1).max(200),
  employeeNumber: z.string().max(100),
  orgUnitId: z.number().int().positive().nullable(),
  projectRole: z.string().min(1).max(100),
  fundingSection: z.string().min(1).max(100),
  salaryModel: z.string().min(1).max(100),
  probationEndDate: z.string().max(40),
  firstIncrement: z.string().max(40),
  hrFte: z.number().nonnegative().nullable(),
  studentNumber: z.string().max(100),
  overrideInflation: z.boolean(),
  inflationRate: z.number().nonnegative().nullable(),
  additionalAnswers: z.record(z.string(), z.string().max(4000)),
});

const created = z.object({
  costing_line_json: z.array(
    z.object({
      costing_header_id: z.coerce.number().int().positive(),
      costing_line_id: z.coerce.number().int().positive(),
      start_date: z.string().nullish(),
      end_date: z.string().nullish(),
      unit_type: z.string().nullish(),
      units: z.union([z.number(), z.string()]).nullish(),
      baseline_cost: z.union([z.number(), z.string()]).nullish(),
      unindex_cost: z.union([z.number(), z.string()]).nullish(),
      fec_cost: z.union([z.number(), z.string()]).nullish(),
    }),
  ),
});

const lineInput = z.object({
  id: z.number().int().positive(),
  startDate: z.iso.date(),
  endDate: z.iso.date(),
  unitType: z.string().max(100),
  units: z.number().min(0).max(1000),
  baseline: z.number().min(0).nullable(),
});
const saveInput = z.object({
  kind,
  versionId: z.number().int().positive(),
  costHeaderId: z.number().int().positive(),
  lines: z.array(lineInput).min(1).max(100),
});

export async function saveStaffCostLines(type: string, id: string, input: unknown) {
  const body = saveInput.parse(input);
  const options = await staffEntryOptions(type, id, body.kind);
  if (options.versionId !== body.versionId)
    throw new AppError("BAD_REQUEST", "The active budget version changed. Reload this page.", 400);
  const raw = await proposals.costingLines({ costHeaderId: String(body.costHeaderId) });
  const rows = items.parse(raw).items;
  if (rows.length !== body.lines.length || rows.some((row) =>
    Number(row.costing_header_id) !== body.costHeaderId ||
    Number(row.proposal_id) !== Number(id) ||
    !body.lines.some((line) => line.id === Number(row.costing_line_id))
  ))
    throw new AppError("FORBIDDEN", "Staff cost lines are outside this Proposal or have changed. Reload this page.", 403);
  const allowedUnits = new Set(options.unitTypes.map((item) => item.value));
  const proposed = body.lines.map((line) => {
    const original = rows.find((row) => Number(row.costing_line_id) === line.id)!;
    if (line.startDate > line.endDate ||
      (options.proposalStartDate && line.startDate < options.proposalStartDate.slice(0, 10)) ||
      (options.proposalEndDate && line.endDate > options.proposalEndDate.slice(0, 10)))
      throw new AppError("BAD_REQUEST", "Cost line dates must be within the Proposal period.", 400);
    if (line.unitType && !allowedUnits.has(line.unitType))
      throw new AppError("BAD_REQUEST", "Select a valid Staff unit.", 400);
    if (line.baseline !== null &&
      (!options.canEditBaseline || original.salary_model !== "F"))
      throw new AppError("FORBIDDEN", "Baseline cost cannot be edited.", 403);
    return {
      costing_line_id: line.id,
      costing_header_id: body.costHeaderId,
      proposal_id: Number(id),
      costmodel_id: original.costmodel_id,
      cost_type: original.cost_type,
      salary_model: original.salary_model,
      funding_section_hdr: original.funding_section_hdr,
      cost_category_type: original.cost_category_type,
      cost_category_item: original.cost_category_item,
      currency_code: original.currency_code,
      exchange_rate: original.exchange_rate,
      proposal_start_date: options.proposalStartDate.slice(0, 10),
      proposal_end_date: options.proposalEndDate.slice(0, 10),
      start_date: line.startDate,
      end_date: line.endDate,
      fte: original.fte,
      hr_fte: original.hr_fte,
      years: original.years,
      baseline_cost: line.baseline ?? original.baseline_cost,
      unit_cost: original.unit_cost,
      unit_type: line.unitType || null,
      units: line.units,
      unindex_cost: original.unindex_cost,
    };
  });
  const calculation = z.object({
    cost_summary: z.array(z.object({
      line_id: z.coerce.number().int().positive(),
      fec_total: z.coerce.number().nonnegative(),
      unindex_cost: z.coerce.number().nonnegative(),
    })),
  });
  const calculated = [];
  for (const row of proposed) {
    const result = calculation.parse(await proposals.calculateStaffLine({ row }));
    const total = result.cost_summary.find((item) => item.line_id === row.costing_line_id);
    if (!total) throw new AppError("CONTRACT", "Oracle returned no calculation for a Staff cost line.");
    calculated.push({ ...row, fec_total: total.fec_total, unindex_cost: total.unindex_cost });
  }
  await proposals.saveCostingLines({ rows: calculated });
  return { saved: true };
}

export async function createStaffCostHeader(
  type: string,
  id: string,
  input: unknown,
) {
  const body = headerInput.parse(input);
  const options = await staffEntryOptions(type, id, body.kind);
  if (options.versionId !== body.versionId)
    throw new AppError(
      "BAD_REQUEST",
      "The active budget version changed. Reload this page.",
      400,
    );
  if (!options.sections.some((entry) => entry.value === body.fundingSection))
    throw new AppError(
      "BAD_REQUEST",
      "Select a valid Costing HDR section.",
      400,
    );
  if (!options.roles.some((entry) => entry.value === body.projectRole))
    throw new AppError("BAD_REQUEST", "Select a valid project role.", 400);
  if (!options.salaryModels.some((entry) => entry.value === body.salaryModel))
    throw new AppError("BAD_REQUEST", "Select a valid Salary Model.", 400);
  if (
    (body.kind === "student" && body.projectRole !== "STUD") ||
    (body.kind === "pool-tech" && body.projectRole !== "POOL_TECH")
  )
    throw new AppError("BAD_REQUEST", "Invalid project role.", 400);
  for (const field of options.additionalFields) {
    const answer =
      body.additionalAnswers[String(field.fieldId)] ?? field.defaultValue;
    if (field.required && !answer.trim())
      throw new AppError("BAD_REQUEST", `${field.label} is required.`, 400);
  }
  let person;
  if (body.kind === "staff") {
    if (!body.personId)
      throw new AppError("BAD_REQUEST", "Select a staff person.", 400);
    person = await staffEntryPerson(type, id, body.personId);
  }
  const { data } = await costingScope(type, id, body.kind, body.versionId);
  const result = created.parse(
    await proposals.insertCostingHeader({
      deleteOldLines: true,
      body: {
        APP_COST_MODEL: data.cost_model,
        COST_CATEGORY_LKP_CODE: "STAFF",
        COST_CATEGORY_ITEM_LKP_CODE: body.projectRole,
        PROJECT_ROLE_LKP_CODE: body.projectRole,
        FUNDING_SECTION_HEADER_LKP_CODE: body.fundingSection,
        SALARY_MODEL_LKP_CODE: body.salaryModel,
        EMPLOYEE_NUMBER:
          person?.employeeNumber ??
          (body.kind === "student" ? body.studentNumber || "0" : "0"),
        ITEM_DESCRIPTION: person?.name ?? body.name,
        PERSON_ID: person?.personId ?? null,
        ORG_UNIT_ID: body.orgUnitId ?? person?.orgUnitId ?? null,
        PROBATION_END_DATE: body.probationEndDate || null,
        INCREMENT_MONTH: body.firstIncrement || null,
        HR_FTE: body.hrFte,
        INFLATION_RATE: body.overrideInflation ? body.inflationRate : null,
        START_DATE: data.proposal_start_date,
        END_DATE: data.proposal_end_date,
        PROPOSAL_ID: Number(id),
        PROPOSAL_PERIOD_VERSION_ID: body.versionId,
        SAL_MODEL_FIELDS: {},
        INDIRECT_COST_FIELDS: {},
      },
    }),
  );
  const first = result.costing_line_json[0];
  if (!first)
    throw new AppError("CONTRACT", "Oracle returned no Staff cost lines.");
  if (
    result.costing_line_json.some(
      (line) => line.costing_header_id !== first.costing_header_id,
    )
  )
    throw new AppError("CONTRACT", "Oracle returned mixed Staff cost headers.");
  if (options.additionalFields.length > 0) {
    const byForm = new Map<
      number,
      { sectionId: number; fields: { field_id: number; value: string }[] }[]
    >();
    for (const field of options.additionalFields) {
      const answer =
        body.additionalAnswers[String(field.fieldId)] ?? field.defaultValue;
      let sections = byForm.get(field.formId);
      if (!sections) {
        sections = [];
        byForm.set(field.formId, sections);
      }
      let section = sections.find(
        (entry) => entry.sectionId === field.sectionId,
      );
      if (!section) {
        section = { sectionId: field.sectionId, fields: [] };
        sections.push(section);
      }
      section.fields.push({ field_id: field.fieldId, value: answer });
    }
    for (const [formId, sections] of byForm) {
      await dynamicForm.save({
        formId,
        objectId: String(first.costing_header_id),
        slot: "PROPOSALS-BUDGET-STAFF",
        body: [
          {
            form_id: formId,
            sections: sections.map((section) => ({
              section_id: section.sectionId,
              fields: section.fields,
            })),
          },
        ],
      });
    }
  }
  return {
    costHeaderId: first.costing_header_id,
    lines: result.costing_line_json.map((line) => ({
      id: line.costing_line_id,
      startDate: line.start_date || "",
      endDate: line.end_date || "",
      unitType: line.unit_type || "PROJ_FTE",
      units: value(line.units),
      baseline: value(line.baseline_cost),
      unindexed: value(line.unindex_cost),
      total: value(line.fec_cost),
    })),
  };
}
