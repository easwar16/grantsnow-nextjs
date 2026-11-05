import "server-only";
import { z } from "zod";
import { AppError } from "@/lib/errors";
import { authenticate } from "@/server/identity/session/service";
import { dashboardRoles } from "@/server/platform/configuration/service";
import { formattingConfiguration } from "@/server/platform/configuration/formatting";
import { resources } from "@/server/platform/configuration/resources";
import {
  eoi,
  lookups,
  opportunities,
  people,
  proposals,
  roles as recordRoles,
} from "@/server/oracle/api";
import { serverFunctions } from "@/server/functions";
import { recordRoleRows } from "@/server/record/shared";
import { constants } from "@/lib/constants";
import { eoiConvertSource } from "@/server/modules/opportunities/record";
import { sponsorDeadlines } from "@/server/modules/opportunities/payloads";
import { proposalBundle } from "@/server/modules/proposals/record";

const kind = z.enum(["PROPOSAL", "OUTLINE_PROPOSAL"]);
const inputSchema = z
  .object({
    type: kind,
    title: z.string().trim().min(1).max(500),
    description: z.string().max(4000),
    piPersonId: z.number().int().positive(),
    activityType: z.string().min(1).max(30),
    proposalStage: z.string().min(1).max(30),
    proposalType: z.string().min(1).max(30),
    category: z.string().max(100),
    startDate: z.iso.date(),
    endDate: z.iso.date(),
    costModel: z.number().int().positive(),
    confidential: z.enum(["Y", "N"]),
    sponsors: z
      .array(
        z.object({
          relationId: z.null(),
          partyId: z.number().int().positive(),
          roleCode: z.string().regex(/^[A-Z0-9_]{1,30}$/),
          priority: z.number().int().positive().max(999),
        }),
      )
      .min(1)
      .max(5),
    deadlines: z
      .array(
        z.object({
          id: z.null(),
          type: z.string().regex(/^[A-Z0-9_]{1,30}$/),
          date: z.iso.date().nullable(),
          description: z.string().max(1000),
        }),
      )
      .max(100),
    tags: z.string().max(1000),
    assignedTo: z.number().int().positive().nullable(),
    opportunityTitle: z.string().max(500),
    opportunityUrl: z.string().max(2048),
    collaboratorFlag: z.enum(["Y", "N"]).optional(),
    collaborators: z.array(z.object({
      relationId: z.null(), collaboratorId: z.number().int().positive(),
      roleCode: z.union([z.literal(""), z.string().regex(/^[A-Z0-9_]{1,30}$/)]),
      description: z.string().max(1000), costingEnabled: z.boolean(),
    })).max(100).optional(),
    subprojectFlag: z.enum(["Y", "N"]).optional(),
    subprojects: z.array(z.object({
      relationId: z.null(), personId: z.number().int().positive(),
      employeeNumber: z.string().max(50), orgUnitId: z.number().int().positive(),
      typeCode: z.string().regex(/^[A-Z0-9_]{1,30}$/), excludePricing: z.boolean(),
    })).max(100).optional(),
    attributes: z.record(z.string().regex(/^attribute_(?:[1-9]|1\d|20)$/), z.union([z.string(), z.number(), z.array(z.string()), z.null()])).optional(),
    sourceRequestId: z.number().int().positive().optional(),
  })
  .strict();

export async function proposalCreateAccess(type: z.infer<typeof kind>) {
  const { user } = await authenticate();
  serverFunctions.permissions.requireModule(user, "PROPOSALS");
  const [roles, objectRoles] = await Promise.all([
    dashboardRoles(),
    recordRoles.record({ objectType: type }),
  ]);
  const page =
    type === "PROPOSAL" ? "create-proposal" : "create-outline-proposal";
  if (!serverFunctions.permissions.pageAccess(roles, page).read)
    throw new AppError(
      "FORBIDDEN",
      "Proposal creation access has not been granted.",
      403,
    );
  const summary = serverFunctions.permissions.objectAccessOf(
    recordRoleRows.parse(objectRoles).items,
  );
  if (summary.roles.get("proposals-summary")?.read !== true)
    throw new AppError(
      "FORBIDDEN",
      "Proposal Summary access has not been granted.",
      403,
    );
  return {
    ...user,
    canChangePi: summary.roles.get("proposals-edit-pi")?.edit === true,
  };
}

const approvedAoiRows = z.object({
  items: z.array(
    z.object({
      request_id: z.coerce.number().int().positive(),
      request_number: z.string().nullish(),
      status_lkp_code: z.string(),
      status: z.string().nullish(),
      opp_heading: z.string().nullish(),
      logo: z.string().nullish(),
      funders: z.string().nullish(),
      full_name: z.string().nullish(),
      org_unit_name: z.string().nullish(),
      creation_date: z.string().nullish(),
    }),
  ),
  totalcount: z.coerce.number().int().nonnegative().optional(),
  total_count: z.coerce.number().int().nonnegative().optional(),
  hasMore: z.union([z.boolean(), z.enum(["true", "false"])]).optional(),
});

/** The VBCS outline picker reads only internally approved AOI requests. */
export async function approvedAois(offset: number) {
  await proposalCreateAccess("OUTLINE_PROPOSAL");
  if (!Number.isSafeInteger(offset) || offset < 0)
    throw new AppError("BAD_REQUEST", "Invalid AOI page.", 400);
  const body = approvedAoiRows.parse(
    await eoi.list({
      module: "OPPORTUNITIES-EOI",
      query: {
        p_offset: String(offset),
        p_limit: String(constants.paging.eoi),
        p_where_clause: "(\"status_lkp_code\"='IA')",
      },
    }),
  );
  if (body.items.some((row) => row.status_lkp_code !== "IA"))
    throw new AppError("CONTRACT", "Oracle returned an unapproved AOI.");
  return {
    rows: body.items.map((row) => ({
      id: String(row.request_id),
      number: row.request_number ?? "",
      status: row.status ?? "Internally Approved",
      title: row.opp_heading ?? "",
      logo: row.logo ?? "",
      funders: row.funders ?? "",
      creator: row.full_name ?? "",
      department: row.org_unit_name ?? "",
      created: row.creation_date ?? "",
    })),
    total: body.totalcount ?? body.total_count ?? null,
    hasMore:
      body.hasMore === undefined
        ? body.items.length >= constants.paging.eoi
        : body.hasMore === true || body.hasMore === "true",
  };
}

/** Resolve the selected request through the existing AOI record and convert permission checks. */
export async function approvedAoiSource(id: string) {
  await proposalCreateAccess("OUTLINE_PROPOSAL");
  const source = await eoiConvertSource(id, "OUTLINE_PROPOSAL");
  return { opportunityId: String(source.opportunityId) };
}

const sourceOpportunity = z.object({
  items: z.array(
    z.object({
      opportunities_id: z.number().int().positive(),
      opp_heading: z.string(),
      activity_type: z.string().nullish(),
      funders: z.string().nullish(),
      deadline_date: z.string().nullish(),
      closing_date: z.string().nullish(),
      call: z.string().nullish(),
      programme: z.string().nullish(),
    }),
  ),
});

async function resolveAoi(id: number) {
  const source = await eoiConvertSource(String(id), "OUTLINE_PROPOSAL");
  const opportunity = sourceOpportunity
    .parse(await opportunities.byId(source.opportunityId))
    .items.find((row) => row.opportunities_id === source.opportunityId);
  if (!opportunity)
    throw new AppError(
      "BAD_REQUEST",
      "The AOI opportunity was not found.",
      404,
    );
  return { source, opportunity };
}

export async function approvedAoiPrefill(id: number) {
  await proposalCreateAccess("OUTLINE_PROPOSAL");
  const { opportunity } = await resolveAoi(id);
  return {
    title: opportunity.opp_heading,
    description: opportunity.opp_heading,
    activityType: opportunity.activity_type ?? "",
    firstFunder: opportunity.funders?.split(",")[0]?.trim() ?? "",
  };
}

const codeRows = z.object({
  items: z.array(
    z.object({
      lookup_type_code: z.string(),
      lookup_code: z.string(),
      lookup_code_value: z.string().nullish(),
      lookup_code_descr: z.string().nullish(),
    }),
  ),
});
const piRows = z.object({
  items: z.array(
    z.object({
      person_id: z.number().int().positive(),
      full_name: z.string(),
      employee_number: z.union([z.string(), z.number()]).nullish(),
      org_unit_id: z.number().int().positive(),
      org_unit_name: z.string().nullish(),
      is_pi_flag: z.string().nullish(),
    }),
  ),
});
const sponsorRows = z.object({
  items: z.array(
    z.object({
      sponsor_party_id: z.number().int().positive(),
      party_name: z.string(),
      sponsor_type: z.string().nullish(),
    }),
  ),
});
const sponsorTypeRows = z.object({
  items: z.array(
    z.object({
      sponsor_type_code: z.string(),
      sponsor_type_name: z.string(),
    }),
  ),
});
const costRows = z.object({
  items: z.array(
    z.object({
      costmodel_id: z.number().int().positive(),
      costmodel_name: z.string(),
    }),
  ),
});

export async function proposalCreateChoices(type: string) {
  const valid = kind.parse(type);
  const user = await proposalCreateAccess(valid);
  const [
    codesRaw,
    peopleRaw,
    sponsorsRaw,
    sponsorTypesRaw,
    costRaw,
    categoriesRaw,
    allPeople,
    collaboratorsRaw,
    rb,
  ] = await Promise.all([
    lookups.codes({
      types:
        "ACTIVITY_TYPE,PROPOSAL_STAGE,PROPOSAL_TYPE,SPONSOR_TYPE_FLAG,DEADLINE_TYPE,SUB_PROPOSAL_TYPE,COLLABORATOR_ROLE_TYPE_FLAG",
    }),
    people.inOrg({ orgId: user.organizationId }),
    lookups.sponsors(),
    lookups.sponsorTypes(),
    proposals.costModels(),
    proposals.categories(),
    people.all(),
    lookups.collaborators(),
    resources(),
  ]);
  const bundle = proposalBundle(rb, valid);
  const codes = codeRows.parse(codesRaw).items;
  const persons = piRows.parse(peopleRaw).items;
  const choices = (key: string) =>
    codes
      .filter((row) => row.lookup_type_code === key)
      .map((row) => ({
        value: row.lookup_code,
        label:
          row.lookup_code_value || row.lookup_code_descr || row.lookup_code,
      }));
  return {
    pi: persons
      .filter((row) => row.is_pi_flag === "true")
      .map((row) => ({
        value: String(row.person_id),
        label: row.full_name,
        detail: row.org_unit_name ?? "",
        employeeNumber: String(row.employee_number ?? ""),
        orgUnitId: row.org_unit_id,
        orgUnitName: row.org_unit_name ?? "",
      })),
    sponsors: sponsorRows.parse(sponsorsRaw).items.map((row) => ({
      value: String(row.sponsor_party_id),
      label: row.party_name,
      type: row.sponsor_type ?? "",
    })),
    sponsorTypes: sponsorTypeRows.parse(sponsorTypesRaw).items.map((row) => ({
      value: row.sponsor_type_code,
      label: row.sponsor_type_name,
    })),
    sponsorRoles: choices("SPONSOR_TYPE_FLAG"),
    deadlineTypes: choices("DEADLINE_TYPE"),
    assignees: persons.map((row) => ({
      value: String(row.person_id),
      label: row.full_name,
    })),
    costModels: costRows.parse(costRaw).items.map((row) => ({
      value: String(row.costmodel_id),
      label: row.costmodel_name,
    })),
    activityTypes: choices("ACTIVITY_TYPE"),
    stages: choices("PROPOSAL_STAGE"),
    proposalTypes: choices("PROPOSAL_TYPE"),
    categories: z
      .object({ items: z.array(z.object({ category: z.string().nullish() })) })
      .parse(categoriesRaw)
      .items.flatMap((row) =>
        row.category ? [{ value: row.category, label: row.category }] : [],
      ),
    currentPersonId: user.personId,
    canChangePi: user.canChangePi,
    createButtonLabel: serverFunctions.resources.label(
      rb, bundle, "button-labels",
      valid === "PROPOSAL" ? "create-new-proposal" : "create-outline-proposal",
      valid === "PROPOSAL" ? "Create new Grant App" : "Create Outline Proposal",
    ),
    successMessage: serverFunctions.resources.label(
      rb, bundle, "success-msg", "created",
      valid === "PROPOSAL" ? "Proposal created successfully" : "OP created successfully",
    ),
    subproposalTypes: choices("SUB_PROPOSAL_TYPE").filter((row) => row.value !== "RES_PARTNER"),
    collaboratorRoles: choices("COLLABORATOR_ROLE_TYPE_FLAG"),
    collaborators: z.object({ items: z.array(z.object({ id: z.number().int().positive(), collaborator_name: z.string(), country_code: z.string().nullish(), vat_code: z.string().nullish() })) }).parse(collaboratorsRaw).items.map((row) => ({ id: row.id, name: row.collaborator_name, countryCode: row.country_code ?? "", vatCode: row.vat_code ?? "" })),
    subprojectPeople: allPeople.flatMap((row) => row.full_name && row.org_unit_id ? [{ personId: row.person_id, employeeNumber: String(row.employee_number ?? ""), name: row.full_name, orgUnitId: row.org_unit_id, orgUnitName: row.org_unit_name ?? "" }] : []),
  };
}

export async function createProposal(raw: unknown) {
  const input = inputSchema.parse(raw);
  const user = await proposalCreateAccess(input.type);
  if (input.startDate > input.endDate)
    throw new AppError("BAD_REQUEST", "Proposal dates are invalid.", 400);
  const [choices, personRaw, format, aoi] = await Promise.all([
    proposalCreateChoices(input.type),
    people.inOrg({ orgId: user.organizationId }),
    formattingConfiguration(),
    input.sourceRequestId === undefined
      ? Promise.resolve(null)
      : resolveAoi(input.sourceRequestId),
  ]);
  if (aoi && input.type !== "OUTLINE_PROPOSAL")
    throw new AppError(
      "BAD_REQUEST",
      "AOI source requires an outline proposal.",
      400,
    );
  const pi = piRows
    .parse(personRaw)
    .items.find(
      (row) => row.person_id === input.piPersonId && row.is_pi_flag === "true",
    );
  if (!user.canChangePi && String(input.piPersonId) !== user.personId)
    throw new AppError("FORBIDDEN", "Changing PI is not permitted.", 403);
  if (
    !pi ||
    !choices.costModels.some((row) => Number(row.value) === input.costModel) ||
    !choices.activityTypes.some((row) => row.value === input.activityType) ||
    !choices.stages.some((row) => row.value === input.proposalStage) ||
    !choices.proposalTypes.some((row) => row.value === input.proposalType) ||
    (input.category !== "" &&
      !choices.categories.some((row) => row.value === input.category))
  )
    throw new AppError("BAD_REQUEST", "Invalid Proposal selection.", 400);
  const sponsorIds = new Set(choices.sponsors.map((row) => Number(row.value)));
  const sponsorRoles = new Set(choices.sponsorRoles.map((row) => row.value));
  const deadlineTypes = new Set(choices.deadlineTypes.map((row) => row.value));
  if (
    input.sponsors.filter((row) => row.roleCode === "PRM").length !== 1 ||
    input.sponsors.some(
      (row) => !sponsorIds.has(row.partyId) || !sponsorRoles.has(row.roleCode),
    ) ||
    new Set(input.sponsors.map((row) => row.partyId)).size !==
      input.sponsors.length ||
    input.sponsors.filter((row) => row.roleCode.startsWith("BIL")).length > 1 ||
    input.deadlines.some(
      (row) =>
        !deadlineTypes.has(row.type) || (row.type !== "NONE" && !row.date),
    ) ||
    (input.assignedTo !== null &&
      !choices.assignees.some((row) => Number(row.value) === input.assignedTo))
  )
    throw new AppError("BAD_REQUEST", "Invalid Proposal details.", 400);
  const collaborators = input.collaborators ?? [];
  const subprojects = input.subprojects ?? [];
  if (
    (input.collaboratorFlag === "Y") !== (collaborators.length > 0) ||
    (input.subprojectFlag === "Y") !== (subprojects.length > 0) ||
    new Set(collaborators.map((row) => row.collaboratorId)).size !== collaborators.length ||
    new Set(subprojects.map((row) => `${row.personId}:${row.orgUnitId}`)).size !== subprojects.length ||
    collaborators.some((row) => !choices.collaborators.some((candidate) => candidate.id === row.collaboratorId) || (row.roleCode !== "" && !choices.collaboratorRoles.some((role) => role.value === row.roleCode))) ||
    subprojects.some((row) => row.personId === pi.person_id || !choices.subprojectPeople.some((person) => person.personId === row.personId && person.orgUnitId === row.orgUnitId && person.employeeNumber === row.employeeNumber) || !choices.subproposalTypes.some((option) => option.value === row.typeCode))
  ) throw new AppError("BAD_REQUEST", "Invalid Proposal partner details.", 400);
  if (input.attributes) {
    const { loadAttributes } = await import("@/server/record/attributes/service");
    const { attributeErrors } = await import("@/features/record/attributes/model");
    const view = await loadAttributes({ host: "proposals-summary" });
    if (!view.visible && Object.keys(input.attributes).length > 0)
      throw new AppError("BAD_REQUEST", "Attributes are unavailable.", 400);
    if (view.visible) {
      const fields = view.fields;
      if (Object.entries(input.attributes).some(([key, value]) => !fields.some((field) => field.name === key && (!field.readOnly || value === null))) || Object.keys(attributeErrors(fields, input.attributes, true)).length > 0)
        throw new AppError("BAD_REQUEST", "Invalid attribute values.", 400);
    }
  }
  const body = {
    proposals: {
      activity_type: input.activityType,
      cost_model: input.costModel,
      costing_type: "PROP",
      currency_code: format.currency ?? "GBP",
      deadline_type_lkp_code: null,
      enforce_deadline_y_n: aoi
        ? aoi.opportunity.closing_date
          ? "Y"
          : "N"
        : "Y",
      start_date: input.startDate,
      end_date: input.endDate,
      new_pi_flag: null,
      main_proposal_id: null,
      prop_change_ver_flag: false,
      proposal_status: "DRFT",
      proposal_title: input.title,
      proposal_description: input.description,
      collaborators: collaborators.map((row) => ({
        prop_collab_rltn_id: null, collaborator_id: row.collaboratorId,
        collab_type_flag_lkp_code: row.roleCode || null,
        prop_collab_rltn_descr: row.description,
        costing_enabled: row.costingEnabled ? "Y" : "N",
      })),
      proposal_departments: [
        {
          collaborator_id: null,
          collaborator_name: null,
          exclude_pricing: "N",
          sub_proposal_type: null,
          sub_proposal_id: null,
          person_id: pi.person_id,
          employee_number: pi.employee_number ?? null,
          prop_deptmt_rltn_id: null,
          org_unit_id: pi.org_unit_id,
          investigator_type: "PI",
          version_id: null,
          version_number: null,
          version_description: null,
          version_retain_costing: null,
        },
        ...subprojects.map((row) => ({
          collaborator_id: null, collaborator_name: null,
          exclude_pricing: row.excludePricing ? "Y" : "N",
          sub_proposal_type: row.typeCode, sub_proposal_id: null,
          person_id: row.personId, employee_number: row.employeeNumber,
          prop_deptmt_rltn_id: null, org_unit_id: row.orgUnitId,
          investigator_type: "SCO-I", version_id: null,
          version_number: null, version_description: null,
          version_retain_costing: null,
        })),
      ],
      proposal_sponsors: input.sponsors.map((row) => ({
        prop_sponsors_rltn_id: row.relationId,
        sponsor_party_id: row.partyId,
        prop_sponsors_rltn_descr: "",
        sponsor_type: row.roleCode,
        sponsor_priority: row.priority,
      })),
      created_by: Number(user.personId),
      tags: input.tags || null,
      submission_deadline_date: null,
      proposal_type_lkp_code: input.proposalType,
      proposal_type: input.type,
      sub_proposal_id: null,
      category: input.category || null,
      proposal_stage: input.proposalStage,
      opportunity_title: input.opportunityTitle || null,
      opportunity_url: input.opportunityUrl || null,
      is_confidential: input.confidential,
      retain_flag: null,
      assigned_to: input.assignedTo,
      assigned_to_name:
        choices.assignees.find((row) => Number(row.value) === input.assignedTo)
          ?.label ?? null,
      proposal_deadlines: [
        ...(aoi
          ? sponsorDeadlines(
              aoi.opportunity.deadline_date || aoi.opportunity.closing_date,
            )
          : []),
        ...input.deadlines.map((row) => ({
          deadline_id: row.id,
          deadline_date: row.date,
          deadline_type: row.type,
          deadline_description: row.description,
        })),
      ],
      ...input.attributes,
      ...(aoi
        ? {
            converted_from_opp_id: aoi.source.opportunityId,
            request_id: input.sourceRequestId,
            attribute_1: aoi.opportunity.call ?? null,
            attribute_2: aoi.opportunity.programme ?? null,
          }
        : {}),
    },
  };
  const result = z
    .object({ proposal: z.number().int().positive() })
    .parse(await proposals.saveSummary({ body }));
  return { id: result.proposal, type: input.type };
}
