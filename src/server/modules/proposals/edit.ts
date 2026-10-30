import { serverFunctions } from "@/server/functions";
import "server-only";
import { z } from "zod";
import { AppError } from "@/lib/errors";
import { proposals, lookups, people } from "@/server/oracle/api";
import { resources } from "@/server/platform/configuration/resources";
import { recordIdentity } from "@/features/modules/proposals/record";
import { proposalPage } from "./record";
import { loadAttributes } from "@/server/record/attributes/service";
import {
  attributeErrors,
  type AttributeField,
} from "@/features/record/attributes/model";

const text = z.string().max(4000);
const editInput = z
  .object({
    title: text.trim().min(1).max(500).optional(),
    description: text.optional(),
    tags: z.string().max(1000).optional(),
    opportunityTitle: z.string().max(500).optional(),
    opportunityUrl: z.string().max(2048).optional(),
    activityType: z.string().max(30).optional(),
    proposalStage: z.string().max(30).optional(),
    proposalType: z.string().max(30).optional(),
    category: z.string().max(100).optional(),
    confidential: z.enum(["Y", "N"]).optional(),
    assignedTo: z.number().int().positive().nullable().optional(),
    piPersonId: z.number().int().positive().optional(),
    startDate: z.iso.date().optional(),
    endDate: z.iso.date().optional(),
    costModel: z.number().int().positive().optional(),
    version: z
      .object({
        newVersion: z.boolean(),
        description: z.string().max(500),
        retainCosting: z.enum(["RETAIN", "NO_RETAIN"]).nullable(),
      })
      .optional(),
    attributes: z
      .record(
        z.string().regex(/^attribute_(?:[1-9]|1\d|20)$/),
        z.union([z.string(), z.number(), z.array(z.string()), z.null()]),
      )
      .optional(),
    deadlines: z
      .array(
        z.object({
          id: z.number().int().positive().nullable(),
          type: z.string().regex(/^[A-Z0-9_]{1,30}$/),
          date: z.iso.date().nullable(),
          description: z.string().max(1000),
        }),
      )
      .max(100)
      .optional(),
    sponsors: z
      .array(
        z.object({
          relationId: z.number().int().positive().nullable(),
          partyId: z.number().int().positive(),
          roleCode: z.string().regex(/^[A-Z0-9_]{1,30}$/),
          priority: z.number().int().positive().max(999),
        }),
      )
      .max(100)
      .optional(),
    collaborators: z
      .array(
        z.object({
          relationId: z.number().int().positive().nullable(),
          collaboratorId: z.number().int().positive(),
          roleCode: z.union([
            z.literal(""),
            z.string().regex(/^[A-Z0-9_]{1,30}$/),
          ]),
          description: z.string().max(1000),
          costingEnabled: z.boolean(),
        }),
      )
      .max(100)
      .optional(),
    subprojects: z
      .array(
        z.object({
          relationId: z.number().int().positive().nullable(),
          personId: z.number().int().positive(),
          orgUnitId: z.number().int().positive(),
          employeeNumber: z.string().max(50),
          typeCode: z.string().regex(/^[A-Z0-9_]{1,30}$/),
          excludePricing: z.boolean(),
        }),
      )
      .max(100)
      .optional(),
    collaboratorFlag: z.enum(["Y", "N"]).optional(),
    subprojectFlag: z.enum(["Y", "N"]).optional(),
  })
  .strict();

const maybeText = z.string().nullish();
const maybeNumber = z.number().int().nullish();
const rawProposal = z
  .object({
    proposal_id: z.number().int().positive(),
    proposal_type: z.string(),
    proposal_status: z.string(),
    proposal_start_date: z.string(),
    proposal_end_date: z.string(),
    proposal_title: maybeText,
    proposal_description: maybeText,
    activity_type_code: maybeText,
    cost_model: z.number().int().nonnegative(),
    costing_type_code: maybeText,
    currency_code: z.string().min(1),
    deadline_type_lkp_code: maybeText,
    new_pi_flag: maybeText,
    parent_proposal_id: maybeNumber,
    sub_proposal_type_code: maybeText,
    proposal_type_code: maybeText,
    submission_deadline_date: maybeText,
    tags: maybeText,
    category: maybeText,
    proposal_stage: maybeText,
    opportunity_title: maybeText,
    opportunity_url: maybeText,
    is_confidential: maybeText,
    assigned_to: maybeNumber,
    assigned_to_name: maybeText,
    sponsors: z
      .array(
        z.object({
          prop_sponsors_rltn_id: maybeNumber,
          sponsor_party_id: z.number().int().positive(),
          sponsor_type_flag_lkp_code: z.string(),
          sponsor_priority: z.union([z.number(), z.string()]).nullish(),
        }),
      )
      .nullish(),
    departments: z
      .array(
        z.object({
          prop_deptmt_rltn_id: maybeNumber,
          person_id: z.number().int().positive(),
          employee_number: z.union([z.number(), z.string()]).nullish(),
          org_unit_id: z.number().int().positive(),
          investigator_type_lkp_code: z.string(),
          collaborator_id: maybeNumber,
          collaborator_name: maybeText,
          exclude_pricing: maybeText,
          sub_proposal_type: maybeText,
          sub_proposal_id: maybeNumber,
          proposal_period_version_id: maybeNumber,
          proposal_version_number: maybeNumber,
          version_description: maybeText,
          proposal_description: maybeText,
          proposal_title: maybeText,
          retain_flag: maybeText,
        }),
      )
      .nullish(),
    collaborators: z
      .array(
        z.object({
          prop_collab_rltn_id: maybeNumber,
          collaborator_id: z.number().int().positive(),
          prop_collab_rltn_descr: maybeText,
          costing_enabled: z.union([z.string(), z.boolean()]).nullish(),
          collaborator_name: maybeText,
          country_code: maybeText,
          vat_code: maybeText,
          collab_type_flag_lkp_code: maybeText,
        }),
      )
      .nullish(),
    proposal_deadlines: z
      .array(
        z.object({
          deadline_id: maybeNumber,
          deadline_date: maybeText,
          deadline_type: maybeText,
          deadline_description: maybeText,
        }),
      )
      .nullish(),
  })
  .catchall(z.unknown());

const date = (value: string | null | undefined) => {
  if (!value) return null;
  const day = value.slice(0, 10);
  return z.iso.date().safeParse(day).success ? day : null;
};

export async function proposalEditContext(type: string, id: string) {
  const record = recordIdentity.parse({ type, id });
  const context = await proposalPage(
    record.type,
    record.id,
    "proposals-summary",
  );
  const rb = await resources();
  const pageId = context.finalize.pageId;
  if (
    context.rights.edit !== true ||
    context.summary.statusCode !== "DRFT" ||
    pageId === null ||
    context.summary.lockedPageIds.includes(pageId) ||
    !serverFunctions.resources.resourceVisible(
      rb,
      context.bundle,
      "button-labels",
      "edit-proposal",
    )
  )
    return null;
  const lock = z
    .object({ user_id: z.union([z.number(), z.string()]).nullish() })
    .parse(
      await proposals.lockStatus({ type: record.type, id: record.id, pageId }),
    );
  return lock.user_id ? null : context;
}

export async function proposalEditValues(type: string, id: string) {
  const context = await proposalEditContext(type, id);
  if (!context)
    throw new AppError("FORBIDDEN", "Edit Proposal is unavailable.", 403);
  const raw = z
    .object({
      proposal_id: z.number().int().positive(),
      proposal_type: z.string(),
      proposal_title: maybeText,
      proposal_description: maybeText,
      departments: z
        .array(
          z.object({
            investigator_type_lkp_code: z.string(),
            proposal_title: maybeText,
            proposal_description: maybeText,
            person_id: maybeNumber,
            prop_deptmt_rltn_id: maybeNumber,
            employee_number: z.union([z.string(), z.number()]).nullish(),
            org_unit_id: maybeNumber,
            org_unit_name: maybeText,
            full_name: maybeText,
            exclude_pricing: maybeText,
            sub_proposal_type: maybeText,
          }),
        )
        .nullish(),
      parent_proposal_id: maybeNumber,
      sub_proposal_type_code: maybeText,
      tags: maybeText,
      opportunity_title: maybeText,
      opportunity_url: maybeText,
      activity_type_code: maybeText,
      proposal_stage: maybeText,
      proposal_type_code: maybeText,
      category: maybeText,
      is_confidential: maybeText,
      assigned_to: maybeNumber,
      proposal_start_date: z.string(),
      proposal_end_date: z.string(),
      cost_model: z.number().int().nonnegative(),
      proposal_deadlines: z
        .array(
          z.object({
            deadline_id: maybeNumber,
            deadline_type: maybeText,
            deadline_date: maybeText,
            deadline_description: maybeText,
          }),
        )
        .nullish(),
      sponsors: z
        .array(
          z.object({
            prop_sponsors_rltn_id: maybeNumber,
            sponsor_party_id: z.number().int().positive(),
            party_name: maybeText,
            funder_type: maybeText,
            sponsor_type_flag_lkp_code: z.string(),
            sponsor_priority: z.union([z.number(), z.string()]).nullish(),
          }),
        )
        .nullish(),
      collaborators: z
        .array(
          z.object({
            prop_collab_rltn_id: maybeNumber,
            collaborator_id: z.number().int().positive(),
            collaborator_name: maybeText,
            prop_collab_rltn_descr: maybeText,
            costing_enabled: z.union([z.string(), z.boolean()]).nullish(),
            collab_type_flag_lkp_code: maybeText,
            country_code: maybeText,
            vat_code: maybeText,
          }),
        )
        .nullish(),
    })
    .parse(await proposals.summary({ id }));
  if (String(raw.proposal_id) !== id || raw.proposal_type !== type)
    throw new AppError("FORBIDDEN", "The Proposal identity changed.", 403);
  return {
    title:
      raw.departments?.find((row) => row.investigator_type_lkp_code === "PI")
        ?.proposal_title ??
      raw.proposal_title ??
      "",
    description:
      raw.departments?.find((row) => row.investigator_type_lkp_code === "PI")
        ?.proposal_description ??
      raw.proposal_description ??
      "",
    tags: raw.tags ?? "",
    opportunityTitle: raw.opportunity_title ?? "",
    opportunityUrl: raw.opportunity_url ?? "",
    activityType: raw.activity_type_code ?? "",
    proposalStage: raw.proposal_stage ?? "",
    proposalType: raw.proposal_type_code ?? "",
    category: raw.category ?? "",
    startDate: date(raw.proposal_start_date) ?? "",
    endDate: date(raw.proposal_end_date) ?? "",
    costModel: String(raw.cost_model),
    deadlines: (raw.proposal_deadlines ?? []).map((row) => ({
      id: row.deadline_id ?? null,
      type: row.deadline_type ?? "",
      date: date(row.deadline_date),
      description: row.deadline_description ?? "",
    })),
    confidential: raw.is_confidential === "Y" ? "Y" : "N",
    assignedTo:
      raw.assigned_to === null || raw.assigned_to === undefined
        ? ""
        : String(raw.assigned_to),
    sponsors: (raw.sponsors ?? []).map((row, index) => ({
      relationId: row.prop_sponsors_rltn_id ?? null,
      partyId: row.sponsor_party_id,
      name: row.party_name ?? "",
      funderType: row.funder_type ?? "",
      roleCode: row.sponsor_type_flag_lkp_code,
      priority: Number(row.sponsor_priority ?? index + 1),
    })),
    collaborators: (raw.collaborators ?? []).map((row) => ({
      relationId: row.prop_collab_rltn_id ?? null,
      collaboratorId: row.collaborator_id,
      name: row.collaborator_name ?? "",
      roleCode: row.collab_type_flag_lkp_code ?? "",
      description: row.prop_collab_rltn_descr ?? "",
      countryCode: row.country_code ?? "",
      vatCode: row.vat_code ?? "",
      costingEnabled:
        row.costing_enabled === true || row.costing_enabled === "Y",
    })),
    subprojects: (raw.departments ?? [])
      .filter((row) => row.investigator_type_lkp_code !== "PI")
      .flatMap((row) =>
        row.person_id && row.org_unit_id
          ? [
              {
                relationId: row.prop_deptmt_rltn_id ?? null,
                personId: row.person_id,
                employeeNumber: String(row.employee_number ?? ""),
                orgUnitId: row.org_unit_id,
                name: row.full_name ?? "",
                orgUnitName: row.org_unit_name ?? "",
                typeCode: row.sub_proposal_type ?? "INTERNAL_DEPT",
                excludePricing: row.exclude_pricing === "Y",
              },
            ]
          : [],
      ),
    canDeleteSponsors: context.rights.delete,
    piPersonId:
      raw.departments?.find((row) => row.investigator_type_lkp_code === "PI")
        ?.person_id ?? null,
    canChangePi:
      context.access.get("proposals-edit-pi")?.edit === true &&
      (!raw.parent_proposal_id ||
        raw.sub_proposal_type_code === "INTERNAL_DEPT"),
  };
}

export async function proposalEditChoices(type: string, id: string) {
  const context = await proposalEditContext(type, id);
  if (!context)
    throw new AppError("FORBIDDEN", "Edit Proposal is unavailable.", 403);
  const [
    codeResponse,
    categoryResponse,
    persons,
    costResponse,
    piResponse,
    collaboratorResponse,
  ] = await Promise.all([
    lookups.codes({
      types:
        "ACTIVITY_TYPE,PROPOSAL_STAGE,PROPOSAL_TYPE,DEADLINE_TYPE,SUB_PROPOSAL_TYPE,COLLABORATOR_ROLE_TYPE_FLAG",
    }),
    proposals.categories(),
    people.all(),
    proposals.costModels(),
    context.access.get("proposals-edit-pi")?.edit === true
      ? people.inOrg({})
      : Promise.resolve({ items: [] }),
    lookups.collaborators(),
  ]);
  const codes = z
    .object({
      items: z.array(
        z.object({
          lookup_type_code: z.string(),
          lookup_code: z.string(),
          lookup_code_value: z.string().nullish(),
          lookup_code_descr: z.string().nullish(),
        }),
      ),
    })
    .parse(codeResponse).items;
  const options = (lookupType: string) =>
    codes
      .filter((row) => row.lookup_type_code === lookupType)
      .map((row) => ({
        value: row.lookup_code,
        label:
          row.lookup_code_value || row.lookup_code_descr || row.lookup_code,
      }));
  const categories = z
    .object({ items: z.array(z.object({ category: z.string().nullish() })) })
    .parse(categoryResponse)
    .items.flatMap((row) =>
      row.category ? [{ value: row.category, label: row.category }] : [],
    );
  const costModels = z
    .object({
      items: z.array(
        z.object({
          costmodel_id: z.number().int().positive(),
          costmodel_name: z.string(),
        }),
      ),
    })
    .parse(costResponse)
    .items.map((row) => ({
      value: String(row.costmodel_id),
      label: row.costmodel_name,
    }));
  const piCandidates = z
    .object({
      items: z.array(
        z.object({
          person_id: z.number().int().positive(),
          employee_number: z.union([z.string(), z.number()]).nullish(),
          full_name: z.string(),
          org_unit_id: z.number().int().positive(),
          org_unit_name: z.string(),
          is_pi_flag: z.string().nullish(),
        }),
      ),
    })
    .parse(piResponse)
    .items.filter((row) => row.is_pi_flag === "true")
    .map((row) => ({
      personId: row.person_id,
      employeeNumber: row.employee_number ?? "",
      name: row.full_name,
      orgUnitId: row.org_unit_id,
      orgUnitName: row.org_unit_name,
    }));
  return {
    activityTypes: options("ACTIVITY_TYPE"),
    stages: options("PROPOSAL_STAGE"),
    proposalTypes: options("PROPOSAL_TYPE"),
    categories,
    costModels,
    deadlineTypes: options("DEADLINE_TYPE"),
    subproposalTypes: options("SUB_PROPOSAL_TYPE").filter(
      (row) => row.value !== "RES_PARTNER",
    ),
    collaboratorRoles: options("COLLABORATOR_ROLE_TYPE_FLAG"),
    collaborators: z
      .object({
        items: z.array(
          z.object({
            id: z.number().int().positive(),
            collaborator_name: z.string(),
            country_code: maybeText,
            vat_code: maybeText,
          }),
        ),
      })
      .parse(collaboratorResponse)
      .items.map((row) => ({
        id: row.id,
        name: row.collaborator_name,
        countryCode: row.country_code ?? "",
        vatCode: row.vat_code ?? "",
      })),
    subprojectPeople: persons.flatMap((row) =>
      row.full_name && row.org_unit_id
        ? [
            {
              personId: row.person_id,
              employeeNumber: String(row.employee_number ?? ""),
              name: row.full_name,
              orgUnitId: row.org_unit_id,
              orgUnitName: row.org_unit_name ?? "",
            },
          ]
        : [],
    ),
    assignees: persons.flatMap((row) =>
      row.full_name
        ? [{ value: String(row.person_id), label: row.full_name }]
        : [],
    ),
    piCandidates,
  };
}

export async function proposalSponsorChoices(type: string, id: string) {
  if (!(await proposalEditContext(type, id)))
    throw new AppError("FORBIDDEN", "Edit Proposal is unavailable.", 403);
  const [sponsorResponse, roleResponse, typeResponse] = await Promise.all([
    lookups.sponsors(),
    lookups.codes({ types: "SPONSOR_TYPE_FLAG" }),
    lookups.sponsorTypes(),
  ]);
  const sponsors = z
    .object({
      items: z.array(
        z.object({
          sponsor_party_id: z.number().int().positive(),
          party_name: z.string(),
          sponsor_type: z.string().nullish(),
        }),
      ),
    })
    .parse(sponsorResponse).items;
  const roles = z
    .object({
      items: z.array(
        z.object({
          lookup_type_code: z.string(),
          lookup_code: z.string(),
          lookup_code_descr: z.string(),
        }),
      ),
    })
    .parse(roleResponse).items;
  const types = z
    .object({
      items: z.array(
        z.object({
          sponsor_type_code: z.string(),
          sponsor_type_name: z.string(),
        }),
      ),
    })
    .parse(typeResponse).items;
  return {
    sponsors: sponsors.map((row) => ({
      value: String(row.sponsor_party_id),
      label: row.party_name,
      type: row.sponsor_type ?? "",
    })),
    types: types.map((row) => ({
      value: row.sponsor_type_code,
      label: row.sponsor_type_name,
    })),
    roles: roles
      .filter((row) => row.lookup_type_code === "SPONSOR_TYPE_FLAG")
      .map((row) => ({ value: row.lookup_code, label: row.lookup_code_descr })),
  };
}

export function proposalEditPayload(
  rawValue: unknown,
  inputValue: unknown,
  record: {
    type: string;
    id: string;
    personId: string;
    canDeleteSponsors?: boolean;
    canChangePi?: boolean;
  },
  allowed = new Set([
    "title",
    "description",
    "tags",
    "opportunityTitle",
    "opportunityUrl",
  ]),
  sponsorChoices?: Awaited<ReturnType<typeof proposalSponsorChoices>>,
  editChoices?: Partial<Awaited<ReturnType<typeof proposalEditChoices>>>,
  attributeFields: AttributeField[] = [],
) {
  const raw = rawProposal.parse(rawValue);
  const input = editInput.parse(inputValue);
  if (
    String(raw.proposal_id) !== record.id ||
    raw.proposal_type !== record.type
  )
    throw new AppError("FORBIDDEN", "The Proposal identity changed.", 403);
  if (raw.proposal_status !== "DRFT")
    throw new AppError("FORBIDDEN", "Only Draft proposals can be edited.", 403);
  const startDate = date(raw.proposal_start_date);
  const endDate = date(raw.proposal_end_date);
  if (!startDate || !endDate || startDate > endDate)
    throw new AppError("CONTRACT", "The Proposal dates are unavailable.");
  const people = raw.departments ?? [];
  const pi = people.find(
    (person) => person.investigator_type_lkp_code === "PI",
  );
  if (!pi)
    throw new AppError(
      "CONTRACT",
      "The Proposal's Principal Investigator is unavailable.",
    );
  const nextPi =
    input.piPersonId && input.piPersonId !== pi.person_id
      ? editChoices?.piCandidates?.find(
          (candidate) => candidate.personId === input.piPersonId,
        )
      : null;
  if (
    input.piPersonId &&
    input.piPersonId !== pi.person_id &&
    (record.canChangePi !== true ||
      (raw.parent_proposal_id &&
        raw.sub_proposal_type_code !== "INTERNAL_DEPT") ||
      !nextPi)
  )
    throw new AppError("FORBIDDEN", "Changing the PI is unavailable.", 403);
  const createdBy = Number(record.personId);
  if (!Number.isSafeInteger(createdBy) || createdBy <= 0)
    throw new AppError("CONTRACT", "The current person is unavailable.");
  const attributes: Record<string, string | number | string[] | null> =
    Object.fromEntries(
      Array.from({ length: 20 }, (_, index) => `attribute_${index + 1}`)
        .filter((key) => typeof raw[key] === "string")
        .map((key) => [key, String(raw[key])]),
    );
  if (input.attributes) {
    const fieldsByName = new Map(
      attributeFields.map((field) => [field.name, field]),
    );
    if (
      Object.entries(input.attributes).some(([key, value]) => {
        const field = fieldsByName.get(key);
        return (
          !field ||
          (field.readOnly &&
            JSON.stringify(value) !== JSON.stringify(attributes[key] ?? null))
        );
      })
    )
      throw new AppError("BAD_REQUEST", "Invalid attribute changes.", 400);
    const next = { ...attributes, ...input.attributes };
    if (Object.keys(attributeErrors(attributeFields, next, true)).length > 0)
      throw new AppError("BAD_REQUEST", "Invalid attribute values.", 400);
    Object.assign(
      attributes,
      Object.fromEntries(
        Object.entries(input.attributes).filter(
          ([key]) => !fieldsByName.get(key)?.readOnly,
        ),
      ),
    );
  }
  const value = (key: keyof typeof input, current: string) =>
    allowed.has(key) ? (input[key] ?? current) : current;
  const choice = (
    key: "activityType" | "proposalStage" | "proposalType" | "category",
    current: string | null,
    options: { value: string }[] | undefined,
  ) => {
    if (!allowed.has(key) || input[key] === undefined) return current;
    if (input[key] === "" && current === null) return null;
    if (
      input[key] !== current &&
      !options?.some((option) => option.value === input[key])
    )
      throw new AppError("BAD_REQUEST", `Invalid ${key} choice.`, 400);
    return input[key];
  };
  const assignedTo =
    allowed.has("assignedTo") && input.assignedTo !== undefined
      ? input.assignedTo
      : (raw.assigned_to ?? null);
  if (
    assignedTo !== null &&
    allowed.has("assignedTo") &&
    input.assignedTo !== undefined &&
    !editChoices?.assignees?.some((item) => Number(item.value) === assignedTo)
  )
    throw new AppError("BAD_REQUEST", "Invalid assignee.", 400);
  const nextStart = allowed.has("startDate")
    ? (input.startDate ?? startDate)
    : startDate;
  const nextEnd = allowed.has("endDate") ? (input.endDate ?? endDate) : endDate;
  if (!nextStart || !nextEnd || nextStart > nextEnd)
    throw new AppError("BAD_REQUEST", "Proposal dates are invalid.", 400);
  const nextCostModel = allowed.has("costModel")
    ? (input.costModel ?? raw.cost_model)
    : raw.cost_model;
  if (
    nextCostModel !== raw.cost_model &&
    !editChoices?.costModels?.some(
      (item) => Number(item.value) === nextCostModel,
    )
  )
    throw new AppError("BAD_REQUEST", "Invalid cost model.", 400);
  const changedPeriod =
    nextStart !== startDate ||
    nextEnd !== endDate ||
    nextCostModel !== raw.cost_model;
  if (changedPeriod && !input.version)
    throw new AppError(
      "BAD_REQUEST",
      "Choose how to handle the Budget version.",
      400,
    );
  if (input.deadlines) {
    const existing = new Set(
      (raw.proposal_deadlines ?? []).map((row) => row.deadline_id),
    );
    const types = new Set(editChoices?.deadlineTypes?.map((row) => row.value));
    if (
      input.deadlines.some(
        (row) =>
          !types.has(row.type) ||
          (row.id !== null && !existing.has(row.id)) ||
          (row.type !== "NONE" && !row.date),
      )
    )
      throw new AppError("BAD_REQUEST", "Invalid deadline changes.", 400);
  }
  const sponsorRows = input.sponsors && sponsorChoices ? input.sponsors : null;
  if (sponsorRows && record.canDeleteSponsors === false) {
    const selected = new Set(sponsorRows.map((row) => row.relationId));
    if (
      (raw.sponsors ?? []).some(
        (row) =>
          row.prop_sponsors_rltn_id !== null &&
          row.prop_sponsors_rltn_id !== undefined &&
          !selected.has(row.prop_sponsors_rltn_id),
      )
    )
      throw new AppError("FORBIDDEN", "Deleting a funder is unavailable.", 403);
  }
  if (sponsorRows && sponsorChoices) {
    const parties = new Set(
      sponsorChoices.sponsors.map((item) => Number(item.value)),
    );
    const roles = new Set(sponsorChoices.roles.map((item) => item.value));
    if (
      sponsorRows.filter((row) => row.roleCode === "PRM").length !== 1 ||
      sponsorRows.some(
        (row) => !parties.has(row.partyId) || !roles.has(row.roleCode),
      ) ||
      new Set(sponsorRows.map((row) => row.partyId)).size !==
        sponsorRows.length ||
      sponsorRows.filter((row) => row.roleCode.startsWith("BIL")).length > 1 ||
      sponsorRows.some(
        (row) =>
          row.relationId !== null &&
          !raw.sponsors?.some(
            (original) =>
              original.prop_sponsors_rltn_id === row.relationId &&
              original.sponsor_party_id === row.partyId,
          ),
      )
    )
      throw new AppError("BAD_REQUEST", "Invalid funder changes.", 400);
  }
  const collaboratorRows = input.collaborators;
  if (collaboratorRows) {
    const candidates = new Set(
      editChoices?.collaborators?.map((row) => row.id),
    );
    const roles = new Set(
      editChoices?.collaboratorRoles?.map((row) => row.value),
    );
    if (
      (input.collaboratorFlag === "Y" && collaboratorRows.length === 0) ||
      (input.collaboratorFlag === "N" && collaboratorRows.length > 0) ||
      new Set(collaboratorRows.map((row) => row.collaboratorId)).size !==
        collaboratorRows.length ||
      collaboratorRows.some((row) => {
        const old = raw.collaborators?.find(
          (item) =>
            item.prop_collab_rltn_id === row.relationId &&
            item.collaborator_id === row.collaboratorId,
        );
        return (
          (row.relationId !== null && !old) ||
          (!old && !candidates.has(row.collaboratorId)) ||
          (row.roleCode !== (old?.collab_type_flag_lkp_code ?? "") &&
            row.roleCode !== "" &&
            !roles.has(row.roleCode))
        );
      }) ||
      (record.canDeleteSponsors === false &&
        (raw.collaborators ?? []).some(
          (old) =>
            !collaboratorRows.some(
              (row) =>
                row.relationId === old.prop_collab_rltn_id &&
                row.collaboratorId === old.collaborator_id,
            ),
        ))
    )
      throw new AppError(
        "BAD_REQUEST",
        "Invalid research partner changes.",
        400,
      );
  }
  const subprojectRows = input.subprojects;
  if (subprojectRows) {
    const types = new Set(
      editChoices?.subproposalTypes?.map((row) => row.value),
    );
    if (
      (input.subprojectFlag === "Y" && subprojectRows.length === 0) ||
      (input.subprojectFlag === "N" && subprojectRows.length > 0) ||
      new Set(subprojectRows.map((row) => `${row.personId}:${row.orgUnitId}`))
        .size !== subprojectRows.length ||
      subprojectRows.some((row) => {
        const old = people.find(
          (item) =>
            item.prop_deptmt_rltn_id === row.relationId &&
            item.person_id === row.personId,
        );
        return (
          row.personId === pi.person_id ||
          (row.relationId !== null && !old) ||
          (row.typeCode !== old?.sub_proposal_type &&
            !types.has(row.typeCode)) ||
          (!old &&
            !editChoices?.subprojectPeople?.some(
              (person) =>
                person.personId === row.personId &&
                person.orgUnitId === row.orgUnitId &&
                person.employeeNumber === row.employeeNumber,
            ))
        );
      }) ||
      (record.canDeleteSponsors === false &&
        people
          .filter((row) => row.investigator_type_lkp_code !== "PI")
          .some(
            (old) =>
              !subprojectRows.some(
                (row) =>
                  row.relationId === old.prop_deptmt_rltn_id &&
                  row.personId === old.person_id,
              ),
          ))
    )
      throw new AppError("BAD_REQUEST", "Invalid subproposal changes.", 400);
  }
  const nextPeople = subprojectRows
    ? [
        pi,
        ...subprojectRows.map((row) => {
          const old = people.find(
            (old) =>
              old.prop_deptmt_rltn_id === row.relationId &&
              old.person_id === row.personId,
          );
          return {
            ...old,
            prop_deptmt_rltn_id: row.relationId,
            person_id: row.personId,
            employee_number: row.employeeNumber,
            org_unit_id: row.orgUnitId,
            investigator_type_lkp_code:
              old?.investigator_type_lkp_code ?? "SCO-I",
            sub_proposal_type: row.typeCode,
            exclude_pricing: row.excludePricing ? "Y" : "N",
          };
        }),
      ]
    : people;
  return {
    proposals: {
      activity_type: choice(
        "activityType",
        raw.activity_type_code ?? null,
        editChoices?.activityTypes,
      ),
      cost_model: nextCostModel,
      costing_type: raw.costing_type_code || "PROP",
      currency_code: raw.currency_code,
      deadline_type_lkp_code: raw.deadline_type_lkp_code ?? null,
      enforce_deadline_y_n: raw.deadline_type_lkp_code === "NONE" ? "N" : "Y",
      start_date: nextStart,
      end_date: nextEnd,
      new_pi_flag: nextPi ? "Y" : (raw.new_pi_flag ?? null),
      main_proposal_id: raw.parent_proposal_id ?? Number(record.id),
      prop_change_ver_flag: changedPeriod && input.version?.newVersion === true,
      proposal_status: raw.proposal_status,
      proposal_title: value(
        "title",
        pi.proposal_title ?? raw.proposal_title ?? "",
      ),
      proposal_description: value(
        "description",
        pi.proposal_description ?? raw.proposal_description ?? "",
      ),
      collaborators: (
        collaboratorRows ??
        (raw.collaborators ?? []).map((row) => ({
          relationId: row.prop_collab_rltn_id ?? null,
          collaboratorId: row.collaborator_id,
          roleCode: row.collab_type_flag_lkp_code ?? "",
          description: row.prop_collab_rltn_descr ?? "",
          costingEnabled:
            row.costing_enabled === true || row.costing_enabled === "Y",
        }))
      ).map((row) => ({
        prop_collab_rltn_id: row.relationId,
        collaborator_id: row.collaboratorId,
        collab_type_flag_lkp_code: row.roleCode || null,
        prop_collab_rltn_descr: row.description,
        costing_enabled: row.costingEnabled ? "Y" : "N",
      })),
      proposal_departments: nextPeople.map((row) => ({
        collaborator_id: row.collaborator_id ?? null,
        collaborator_name: row.collaborator_name ?? null,
        exclude_pricing: row.exclude_pricing ?? "N",
        sub_proposal_type: row.sub_proposal_type ?? null,
        sub_proposal_id: row.sub_proposal_id ?? null,
        person_id:
          row.investigator_type_lkp_code === "PI" && nextPi
            ? nextPi.personId
            : row.person_id,
        employee_number:
          row.investigator_type_lkp_code === "PI" && nextPi
            ? nextPi.employeeNumber
            : (row.employee_number ?? null),
        prop_deptmt_rltn_id: row.prop_deptmt_rltn_id ?? null,
        org_unit_id:
          row.investigator_type_lkp_code === "PI" && nextPi
            ? nextPi.orgUnitId
            : row.org_unit_id,
        investigator_type: row.investigator_type_lkp_code,
        version_id: row.proposal_period_version_id ?? null,
        version_number: row.proposal_version_number ?? null,
        version_description: input.version?.newVersion
          ? input.version.description
          : (row.version_description ?? null),
        version_retain_costing: input.version?.newVersion
          ? input.version.retainCosting
          : (row.retain_flag ?? null),
      })),
      proposal_sponsors: (
        sponsorRows ??
        (raw.sponsors ?? []).map((row) => ({
          relationId: row.prop_sponsors_rltn_id ?? null,
          partyId: row.sponsor_party_id,
          roleCode: row.sponsor_type_flag_lkp_code,
          priority: Number(row.sponsor_priority ?? 1),
        }))
      ).map((row) => ({
        prop_sponsors_rltn_id: row.relationId,
        sponsor_party_id: row.partyId,
        prop_sponsors_rltn_descr: "",
        sponsor_type: row.roleCode,
        sponsor_priority: row.priority,
      })),
      created_by: createdBy,
      tags: value("tags", raw.tags ?? ""),
      submission_deadline_date: date(raw.submission_deadline_date),
      proposal_type_lkp_code: choice(
        "proposalType",
        raw.proposal_type_code ?? null,
        editChoices?.proposalTypes,
      ),
      proposal_type: record.type,
      sub_proposal_id: raw.parent_proposal_id ? Number(record.id) : null,
      category: choice(
        "category",
        raw.category ?? null,
        editChoices?.categories,
      ),
      proposal_stage: choice(
        "proposalStage",
        raw.proposal_stage ?? null,
        editChoices?.stages,
      ),
      opportunity_title: value("opportunityTitle", raw.opportunity_title ?? ""),
      opportunity_url: value("opportunityUrl", raw.opportunity_url ?? ""),
      is_confidential: allowed.has("confidential")
        ? (input.confidential ?? raw.is_confidential ?? "N")
        : (raw.is_confidential ?? "N"),
      ...attributes,
      retain_flag: input.version?.newVersion
        ? input.version.retainCosting
        : null,
      assigned_to: assignedTo,
      assigned_to_name:
        assignedTo === raw.assigned_to
          ? (raw.assigned_to_name ?? null)
          : (editChoices?.assignees?.find(
              (item) => Number(item.value) === assignedTo,
            )?.label ?? null),
      proposal_deadlines: (
        input.deadlines ??
        (raw.proposal_deadlines ?? []).map((row) => ({
          id: row.deadline_id ?? null,
          date: date(row.deadline_date),
          type: row.deadline_type ?? "",
          description: row.deadline_description ?? "",
        }))
      ).map((row) => ({
        deadline_id: row.id,
        deadline_date: row.date,
        deadline_type: row.type,
        deadline_description: row.description,
      })),
    },
  };
}

export async function saveProposalEdit(
  type: string,
  id: string,
  input: unknown,
) {
  const context = await proposalEditContext(type, id);
  if (!context)
    throw new AppError("FORBIDDEN", "Edit Proposal is unavailable.", 403);
  const raw = await proposals.summary({ id });
  const [sponsorChoices, editChoices] = await Promise.all([
    proposalSponsorChoices(type, id),
    proposalEditChoices(type, id),
  ]);
  const attributeView =
    type === "PROPOSAL"
      ? await loadAttributes({ host: "proposals-summary", objectId: id })
      : { visible: false as const };
  const proposalFields = new Set(
    context.summary.proposalFields.map((field) => field.key),
  );
  const opportunityFields = new Set(
    context.summary.opportunityFields.map((field) => field.key),
  );
  const allowed = new Set([
    ...(proposalFields.has("full-project-title") ? ["title"] : []),
    ...(proposalFields.has("project-description") ? ["description"] : []),
    ...(proposalFields.has("keywords") ? ["tags"] : []),
    ...(proposalFields.has("activity-type") ? ["activityType"] : []),
    ...(proposalFields.has("proposal-stage") ? ["proposalStage"] : []),
    ...(proposalFields.has("proposal-type") ? ["proposalType"] : []),
    ...(proposalFields.has("proposal-category") ? ["category"] : []),
    ...(proposalFields.has("confidential") ? ["confidential"] : []),
    ...(proposalFields.has("assigned-to") ? ["assignedTo"] : []),
    ...(proposalFields.has("start-date") ? ["startDate"] : []),
    ...(proposalFields.has("end-date") ? ["endDate"] : []),
    ...(proposalFields.has("cost-model") ? ["costModel"] : []),
    ...(opportunityFields.has("opportunity-title") ? ["opportunityTitle"] : []),
    ...(opportunityFields.has("opportunity-url") ? ["opportunityUrl"] : []),
  ]);
  const body = proposalEditPayload(
    raw,
    input,
    {
      type: context.identity.type,
      id: context.identity.id,
      personId: context.user.personId,
      canDeleteSponsors: context.rights.delete,
      canChangePi: context.access.get("proposals-edit-pi")?.edit === true,
    },
    allowed,
    sponsorChoices,
    editChoices,
    attributeView.visible ? attributeView.fields : [],
  );
  const oldCollaborators = rawProposal.parse(raw).collaborators ?? [];
  const kept = new Set(
    body.proposals.collaborators.map((row) => row.prop_collab_rltn_id),
  );
  for (const row of oldCollaborators) {
    if (row.prop_collab_rltn_id && !kept.has(row.prop_collab_rltn_id))
      await proposals.deleteCollaborator({
        relationId: row.prop_collab_rltn_id,
      });
  }
  const response = z
    .object({ proposal: z.number().int().positive() })
    .parse(await proposals.saveSummary({ body }));
  if (String(response.proposal) !== id)
    throw new AppError(
      "CONTRACT",
      "Oracle returned another Proposal identity.",
    );
  return { saved: true };
}
