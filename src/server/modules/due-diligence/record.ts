import "server-only";
import { z } from "zod";
import { authenticate } from "@/server/identity/session/service";
import type { HistoryHost } from "@/server/record/objects/history";
import { linkedObjects } from "@/server/record/linked/linked";
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
    z.object({
      page_name: z.string(),
      read_access: z.string().nullable(),
      edit_access: z.string().nullish(),
    }),
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
  const requested = requestedAccess
    ? accessType.safeParse(requestedAccess)
    : null;
  if (requested && !requested.success)
    throw new AppError("FORBIDDEN", "Invalid Due Diligence access view.", 403);
  const available = requested
    ? view.tabs.filter((tab) => tab.value === requested.data)
    : view.tabs;
  if (!available.length)
    throw new AppError(
      "FORBIDDEN",
      "Due Diligence record access has not been granted.",
      403,
    );
  const scoped = await Promise.all(
    available.map(async (tab) => {
      const body = listEnvelope.parse(
        await dueDiligence.applications({
          accessType: tab.value,
          query: {
            p_where_clause: `("setup_flow_id"=${recordId})`,
            p_offset: "0",
            p_limit: "1",
          },
        }),
      );
      return body.items.some((item) => item.setup_flow_id === recordId)
        ? tab.value
        : null;
    }),
  );
  const access = scoped.find((item) => item !== null);
  if (!access)
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
  const pages = [
    "duediligence-general-overview",
    "duediligence-responses",
    "duediligence-attachments",
    "duediligence-approvals",
    "duediligence-history",
  ] as const;
  const tabs = pages.filter(
    (page) =>
      serverFunctions.permissions.pageAccess(rights, page).read &&
      (page !== "duediligence-general-overview" ||
        data.status_lkp_code === "DRFT" ||
        access === "DDA_ACCESS"),
  );
  if (!tabs.length)
    throw new AppError(
      "FORBIDDEN",
      "Due Diligence record access has not been granted.",
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
    tabs,
    rights: Object.fromEntries(
      rights.map((row) => [
        row.page_name,
        { read: row.read_access === "Y", edit: row.edit_access === "Y" },
      ]),
    ),
  };
}

/** The VBCS History fragment uses the first stakeholder for status rows. */
export async function dueDiligenceHistoryHost(
  id: string,
): Promise<HistoryHost> {
  const [record, { session, user }] = await Promise.all([
    dueDiligenceRecord(id),
    authenticate(),
  ]);
  if (!record.tabs.includes("duediligence-history"))
    throw new AppError(
      "FORBIDDEN",
      "Due Diligence History access has not been granted.",
      403,
    );
  const stakeholder = record.respondents[0];
  if (!stakeholder)
    throw new AppError(
      "CONTRACT",
      "Due Diligence History has no stakeholder record.",
    );
  return {
    token: session.token,
    user,
    objectType: "DUE_DILIGENCE",
    objectId: stakeholder.id,
    objectNumber: stakeholder.id,
    approvalType: "DUE_DILIGENCE",
    bundle: "due_diligence",
    statusLookup: "DUE_DILIGENCE_STATUS",
    statusCode: record.statusCode,
    rights: {
      addStatus: record.rights["due-diligence-add-status"]?.edit === true,
      abandon:
        record.rights["due-diligence-history-abandon-button"]?.edit === true,
    },
    keys: {
      title: ["header-labels", "due-diligence-status-history"],
      status: ["table-headers", "history-application-status"],
      comments: ["table-headers", "hitory-comments"],
      approvalTitle: ["header-labels", "history-page-approval-history"],
      statusLabel: ["labels", "due-diligence-status"],
      commentPlaceholder: ["placeholders", "history-comments"],
      cancel: ["button-labels", "history-cancel"],
      save: ["button-labels", "history-save"],
    },
  };
}

/** Listing Linked action: scope the DD record before reading shared object links. */
export async function dueDiligenceLinks(id: string, access?: string) {
  const record = await dueDiligenceRecord(id, access);
  return linkedObjects(
    { module: "DUE_DILIGENCE", id: Number(record.id) },
    {
      bundle: "due_diligence",
      key: "no-linked-data-found",
      fallback: "No Linked Data Found",
    },
  );
}
export type DueDiligenceRecord = Awaited<ReturnType<typeof dueDiligenceRecord>>;
