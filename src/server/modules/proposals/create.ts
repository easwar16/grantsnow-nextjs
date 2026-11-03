import "server-only";
import { z } from "zod";
import { AppError } from "@/lib/errors";
import { authenticate } from "@/server/identity/session/service";
import { dashboardRoles } from "@/server/platform/configuration/service";
import { formattingConfiguration } from "@/server/platform/configuration/formatting";
import { lookups, people, proposals } from "@/server/oracle/api";
import { serverFunctions } from "@/server/functions";

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
    sponsorId: z.number().int().positive(),
  })
  .strict();

async function access(type: z.infer<typeof kind>) {
  const { user } = await authenticate();
  serverFunctions.permissions.requireModule(user, "PROPOSALS");
  const roles = await dashboardRoles();
  const page =
    type === "PROPOSAL" ? "create-proposal" : "create-outline-proposal";
  if (!serverFunctions.permissions.pageAccess(roles, page).read)
    throw new AppError(
      "FORBIDDEN",
      "Proposal creation access has not been granted.",
      403,
    );
  return user;
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
  const user = await access(valid);
  const [codesRaw, peopleRaw, sponsorsRaw, costRaw, categoriesRaw] =
    await Promise.all([
      lookups.codes({ types: "ACTIVITY_TYPE,PROPOSAL_STAGE,PROPOSAL_TYPE" }),
      people.inOrg({ orgId: user.organizationId }),
      lookups.sponsors(),
      proposals.costModels(),
      proposals.categories(),
    ]);
  const codes = codeRows.parse(codesRaw).items;
  const choices = (key: string) =>
    codes
      .filter((row) => row.lookup_type_code === key)
      .map((row) => ({
        value: row.lookup_code,
        label:
          row.lookup_code_value || row.lookup_code_descr || row.lookup_code,
      }));
  return {
    pi: piRows
      .parse(peopleRaw)
      .items.filter((row) => row.is_pi_flag === "true")
      .map((row) => ({
        value: String(row.person_id),
        label: row.full_name,
        detail: row.org_unit_name ?? "",
      })),
    sponsors: sponsorRows.parse(sponsorsRaw).items.map((row) => ({
      value: String(row.sponsor_party_id),
      label: row.party_name,
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
  };
}

export async function createProposal(raw: unknown) {
  const input = inputSchema.parse(raw);
  const user = await access(input.type);
  if (input.startDate > input.endDate)
    throw new AppError("BAD_REQUEST", "Proposal dates are invalid.", 400);
  const [choices, personRaw, format] = await Promise.all([
    proposalCreateChoices(input.type),
    people.inOrg({ orgId: user.organizationId }),
    formattingConfiguration(),
  ]);
  const pi = piRows
    .parse(personRaw)
    .items.find(
      (row) => row.person_id === input.piPersonId && row.is_pi_flag === "true",
    );
  if (
    !pi ||
    !choices.sponsors.some((row) => Number(row.value) === input.sponsorId) ||
    !choices.costModels.some((row) => Number(row.value) === input.costModel) ||
    !choices.activityTypes.some((row) => row.value === input.activityType) ||
    !choices.stages.some((row) => row.value === input.proposalStage) ||
    !choices.proposalTypes.some((row) => row.value === input.proposalType) ||
    (input.category !== "" &&
      !choices.categories.some((row) => row.value === input.category))
  )
    throw new AppError("BAD_REQUEST", "Invalid Proposal selection.", 400);
  const body = {
    proposals: {
      activity_type: input.activityType,
      cost_model: input.costModel,
      costing_type: "PROP",
      currency_code: format.currency ?? "GBP",
      deadline_type_lkp_code: null,
      enforce_deadline_y_n: "Y",
      start_date: input.startDate,
      end_date: input.endDate,
      new_pi_flag: null,
      main_proposal_id: null,
      prop_change_ver_flag: false,
      proposal_status: "DRFT",
      proposal_title: input.title,
      proposal_description: input.description,
      collaborators: [],
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
      ],
      proposal_sponsors: [
        {
          prop_sponsors_rltn_id: null,
          sponsor_party_id: input.sponsorId,
          prop_sponsors_rltn_descr: "",
          sponsor_type: "PRM",
          sponsor_priority: 1,
        },
      ],
      created_by: Number(user.personId),
      tags: null,
      submission_deadline_date: null,
      proposal_type_lkp_code: input.proposalType,
      proposal_type: input.type,
      sub_proposal_id: null,
      category: input.category || null,
      proposal_stage: input.proposalStage,
      opportunity_title: null,
      opportunity_url: null,
      is_confidential: input.confidential,
      retain_flag: null,
      assigned_to: null,
      assigned_to_name: null,
      proposal_deadlines: [],
    },
  };
  const result = z
    .object({ proposal: z.number().int().positive() })
    .parse(await proposals.saveSummary({ body }));
  return { id: result.proposal, type: input.type };
}
