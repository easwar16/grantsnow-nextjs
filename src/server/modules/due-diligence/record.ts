import "server-only";
import { z } from "zod";
import { AppError } from "@/lib/errors";
import { dueDiligence, people, roles } from "@/server/oracle/api";
import { dueDiligenceListView } from "./listing";
import { organizations } from "@/server/platform/configuration/service";
import { serverFunctions } from "@/server/functions";

const accessType = z.enum([
  "DDA_ACCESS",
  "RESPONDENT_ACCESS",
  "APPROVER_ACCESS",
]);
const listEnvelope = z.object({
  items: z.array(
    z.object({ setup_flow_id: z.coerce.number().int().positive() }),
  ),
});
const roleEnvelope = z.object({
  items: z.array(
    z.object({ page_name: z.string(), read_access: z.string().nullable() }),
  ),
});
const setup = z.object({
  setup_flow_id: z.coerce.number().int().positive(),
  application_number: z.string(),
  setup_description: z.string().nullish(),
  status: z.string().nullish(),
  status_lkp_code: z.string().nullish(),
  org_unit_id: z.coerce.number().int().positive(),
  org_unit_name: z.string().nullish(),
  ethics_type: z.string().nullish(),
  ethics_form_type: z.string().nullish(),
  risk_desc: z.string().nullish(),
  deadline_date: z.string().nullish(),
  expiry_date: z.string().nullish(),
  created_by: z.coerce.number().nullish(),
  sections: z
    .array(
      z.object({ setup_id: z.coerce.number(), section_id: z.coerce.number() }),
    )
    .default([]),
  stakeholders: z
    .array(
      z.object({
        id: z.coerce.number(),
        resp_status: z.string().nullish(),
        answered: z.string().nullish(),
        p_id: z.coerce.number().int().positive().nullish(),
        org_unit_name: z.string().nullish(),
      }),
    )
    .default([]),
  reviewer: z.array(z.object({ id: z.coerce.number().int() })).nullish(),
});

/** The same access-specific list as VBCS scopes this setup before the record read. */
export async function dueDiligenceRecord(id: string, requestedAccess?: string) {
  const recordId = z.coerce.number().int().positive().parse(id);
  const view = await dueDiligenceListView();
  const access = accessType.safeParse(requestedAccess).success
    ? (requestedAccess as z.infer<typeof accessType>)
    : view.tabs[0]?.value;
  if (!access || !view.tabs.some((tab) => tab.value === access))
    throw new AppError(
      "FORBIDDEN",
      "Due Diligence record access has not been granted.",
      403,
    );
  const scoped = listEnvelope.parse(
    await dueDiligence.applications({
      accessType: access,
      query: {
        p_where_clause: `("setup_flow_id"=${recordId})`,
        p_offset: "0",
        p_limit: "1",
      },
    }),
  );
  if (!scoped.items.some((item) => item.setup_flow_id === recordId))
    throw new AppError(
      "FORBIDDEN",
      "Due Diligence application not found or access denied.",
      403,
    );
  const [rawSetup, rawRoles, peopleRows, supervisorRows] = await Promise.all([
    dueDiligence.setup({ id: String(recordId) }),
    roles.record({ objectType: "DUE_DILIGENCE", objectId: String(recordId) }),
    people.all(),
    dueDiligence.supervisors(),
  ]);
  const data = setup.parse(rawSetup);
  const rights = roleEnvelope.parse(rawRoles).items;
  if (
    !serverFunctions.permissions.pageAccess(
      rights,
      "duediligence-general-overview",
    ).read
  )
    throw new AppError(
      "FORBIDDEN",
      "Due Diligence overview access has not been granted.",
      403,
    );
  if (data.setup_flow_id !== recordId)
    throw new AppError(
      "CONTRACT",
      "Oracle returned a different Due Diligence application.",
    );
  serverFunctions.permissions.scopeOrganization(
    String(data.org_unit_id),
    await organizations(),
  );
  const supervisors = z
    .object({
      items: z.array(
        z.object({
          person_id: z.coerce.number().int(),
          full_name: z.string().nullish(),
        }),
      ),
    })
    .parse(supervisorRows).items;
  return {
    id: String(data.setup_flow_id),
    access,
    number: data.application_number,
    title: data.setup_description ?? "",
    status: data.status ?? "",
    statusCode: data.status_lkp_code ?? "",
    org: data.org_unit_name ?? "",
    dueDiligenceType: data.ethics_type ?? "",
    formType: data.ethics_form_type ?? "",
    risk: data.risk_desc ?? "",
    deadline: data.deadline_date ?? "",
    expiry: data.expiry_date ?? "",
    sections: data.sections.map((section) => ({
      id: String(section.setup_id),
      sectionId: String(section.section_id),
    })),
    respondents: data.stakeholders.map((person) => ({
      id: String(person.id),
      name:
        peopleRows.find((candidate) => candidate.person_id === person.p_id)
          ?.full_name ?? (person.p_id ? String(person.p_id) : ""),
      org: person.org_unit_name ?? "",
      status: person.resp_status ?? "",
      answered: person.answered === "Y",
    })),
    supervisor:
      supervisors.find((person) => person.person_id === data.reviewer?.[0]?.id)
        ?.full_name ?? "",
  };
}

export type DueDiligenceRecord = Awaited<ReturnType<typeof dueDiligenceRecord>>;
