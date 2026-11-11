import "server-only";
import { z } from "zod";
import { AppError } from "@/lib/errors";
import { eoi, ethics, roles } from "@/server/oracle/api";
import { ethicsListView } from "./listing";
import { organizations } from "@/server/platform/configuration/service";
import { serverFunctions } from "@/server/functions";
import { authenticate } from "@/server/identity/session/service";
import type { HistoryHost } from "@/server/record/objects/history";
import { linkedObjects } from "@/server/record/linked/linked";
import { ethicsEditableStatus } from "./status";

const accessType = z.enum([
  "EA_ACCESS",
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
    z.object({ page_id: z.coerce.number().int().positive().nullish(), page_name: z.string(), read_access: z.string().nullable(), edit_access: z.string().nullish() }),
  ),
});
const setup = z.object({
  setup_flow_id: z.coerce.number().int().positive(),
  application_number: z.string(),
  setup_description: z.string().nullish(),
  status: z.string().nullish(),
  status_lkp_code: z.string().nullish(),
  has_rework: z.string().nullish(),
  org_unit_id: z.coerce.number().int().positive(),
  org_unit_name: z.string().nullish(),
  ethics_type: z.string().nullish(),
  ethics_type_lkp_code: z.string().nullish(),
  ethics_form_type: z.string().nullish(),
  risk_desc: z.string().nullish(),
  deadline_date: z.string().nullish(),
  expiry_date: z.string().nullish(),
  created_by: z.coerce.number().nullish(),
  reviewer: z.array(z.object({ id: z.coerce.number().int() })).nullish(),
  reference_objects: z.array(z.object({
    obj_ref_id: z.coerce.number().int().positive(),
    obj_ref_type: z.string(),
    obj_reference_number: z.string().nullish(),
    reln_id: z.coerce.number().nullish(),
  })).nullish(),
  sections: z
    .array(
      z.object({ setup_id: z.coerce.number(), section_id: z.coerce.number() }),
    )
    .default([]),
  stakeholders: z
    .array(
      z.object({
        id: z.coerce.number(),
        p_id: z.coerce.number().int().positive().nullish(),
        org_unit_name: z.string().nullish(),
        resp_status: z.string().nullish(),
        resp_status_code: z.string().nullish(),
        answered: z.string().nullish(),
      }),
    )
    .default([]),
});

/** The same access-specific list as VBCS scopes this setup before the record read. */
export async function ethicsRecord(id: string, requestedAccess?: string) {
  const recordId = z.coerce.number().int().positive().parse(id);
  const view = await ethicsListView();
  const requested = requestedAccess === undefined ? undefined : accessType.safeParse(requestedAccess);
  if (requested && !requested.success)
    throw new AppError("BAD_REQUEST", "Unknown Ethics access view.", 400);
  const accesses = requested?.success
    ? [requested.data]
    : view.tabs.map((tab) => tab.value);
  if (!accesses.length || (requested?.success && !view.tabs.some((tab) => tab.value === requested.data)))
    throw new AppError(
      "FORBIDDEN",
      "Ethics record access has not been granted.",
      403,
    );
  let access: z.infer<typeof accessType> | undefined;
  for (const candidate of accesses) {
    const scoped = listEnvelope.parse(await ethics.applications({
      accessType: candidate,
      query: {
        p_where_clause: `("setup_flow_id"=${recordId})`,
        p_offset: "0",
        p_limit: "1",
      },
    }));
    if (scoped.items.some((item) => item.setup_flow_id === recordId)) {
      access = candidate;
      break;
    }
  }
  if (!access)
    throw new AppError(
      "FORBIDDEN",
      "Ethics application not found or access denied.",
      403,
    );
  const [rawSetup, rawRoles] = await Promise.all([
    ethics.setup({ id: String(recordId) }),
    roles.record({ objectType: "ETHICS", objectId: String(recordId) }),
  ]);
  const data = setup.parse(rawSetup);
  const rights = roleEnvelope.parse(rawRoles).items;
  const pages = ["ethics-general-overview", "ethics-responses", "ethics-attachments", "ethics-approvals", "ethics-history"] as const;
  const tabs = pages.filter((page) =>
    serverFunctions.permissions.pageAccess(rights, page).read &&
    (page !== "ethics-general-overview" || data.status_lkp_code === "DRFT" || access === "EA_ACCESS"),
  );
  if (!tabs.length)
    throw new AppError(
      "FORBIDDEN",
      "Ethics record access has not been granted.",
      403,
    );
  if (data.setup_flow_id !== recordId)
    throw new AppError(
      "CONTRACT",
      "Oracle returned a different Ethics application.",
    );
  serverFunctions.permissions.scopeOrganization(
    String(data.org_unit_id),
    await organizations(),
  );
  return {
    id: String(data.setup_flow_id),
    creatorPersonId: data.created_by == null ? null : String(data.created_by),
    access,
    number: data.application_number,
    title: data.setup_description ?? "",
    status: data.status ?? "",
    statusCode: data.status_lkp_code ?? "",
    hasRework: data.has_rework ?? "Y",
    org: data.org_unit_name ?? "",
    ethicsType: data.ethics_type ?? "",
    ethicsTypeCode: data.ethics_type_lkp_code ?? "",
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
      personId: person.p_id == null ? null : String(person.p_id),
      org: person.org_unit_name ?? "",
      status: person.resp_status ?? "",
      statusCode: person.resp_status_code ?? "",
      answered: person.answered === "Y",
    })),
    reviewers: (data.reviewer ?? []).map((person) => String(person.id)),
    references: (data.reference_objects ?? []).map((reference) => ({
      id: String(reference.obj_ref_id),
      type: reference.obj_ref_type,
      number: reference.obj_reference_number ?? "",
      relationId: reference.reln_id == null ? null : String(reference.reln_id),
    })),
    tabs,
    pageIds: Object.fromEntries(rights.flatMap((row) => row.page_id ? [[row.page_name, row.page_id]] : [])),
    rights: Object.fromEntries(rights.map((row) => [row.page_name, {
      read: row.read_access === "Y",
      edit: row.edit_access === "Y",
    }])),
  };
}

/** VBCS selects the signed-in participant first; administrators fall back to the first. */
export function ethicsStakeholder(
  record: EthicsRecord,
  personId: string,
  requestedId?: string,
) {
  const own = record.respondents.find((person) => person.personId === personId);
  if (record.access === "RESPONDENT_ACCESS" && !own)
    throw new AppError("FORBIDDEN", "Ethics participant access has not been granted.", 403);
  if (requestedId !== undefined) {
    const selected = record.respondents.find((person) => person.id === requestedId);
    if (!selected)
      throw new AppError("FORBIDDEN", "Ethics participant access has not been granted.", 403);
    return selected;
  }
  return own ?? record.respondents[0];
}

export async function ethicsLinks(id: string, access?: string) {
  const record = await ethicsRecord(id, access);
  return linkedObjects(
    { module: "ETHICS", id: Number(record.id) },
    { bundle: "ethics", key: "no-linked-data-found", fallback: "No Linked Data Found" },
  );
}

/** The response editor follows the source's own-participant, draft, role and unlocked-page gates. */
export async function ethicsResponseEditable(
  record: EthicsRecord,
  stakeholder: NonNullable<ReturnType<typeof ethicsStakeholder>>,
  personId: string,
) {
  if (record.access !== "RESPONDENT_ACCESS" ||
      stakeholder.personId !== personId ||
      record.rights["ethics-responses"]?.edit !== true)
    return false;
  if (!(await ethicsEditableStatus(stakeholder.statusCode).catch(() => false))) return false;
  const pageId = record.pageIds["ethics-responses"];
  if (!pageId) return false;
  try {
    const lock = z.object({ status: z.string() }).parse(await eoi.lockStatus({
      recordId: stakeholder.id,
      pageId,
      module: "ETHICS",
    }));
    return lock.status === "UNLOCK";
  } catch {
    return false;
  }
}

export async function ethicsHistoryHost(id: string, participant?: string): Promise<HistoryHost> {
  const [record, { session, user }] = await Promise.all([
    ethicsRecord(id),
    authenticate(),
  ]);
  if (!record.tabs.includes("ethics-history"))
    throw new AppError("FORBIDDEN", "Ethics History access has not been granted.", 403);
  const stakeholder = ethicsStakeholder(record, user.personId, participant);
  if (!stakeholder)
    throw new AppError("CONTRACT", "Ethics History has no stakeholder record.");
  const first = record.respondents[0];
  return {
    token: session.token,
    user,
    objectType: "ETHICS",
    objectId: first.id,
    objectNumber: stakeholder.id,
    approvalType: "ETHICS",
    bundle: "ethics",
    statusLookup: "ETHICS_STATUS",
    statusCode: record.statusCode,
    rights: {
      addStatus: record.rights["ethics-add-status"]?.edit === true,
      abandon: record.rights["ethics-history-abandon-button"]?.edit === true,
    },
    keys: {
      title: ["labels", "ethics-status-history"],
      status: ["table-headers", "history-application-status"],
      approvalTitle: ["header-labels", "history-page-approval-history"],
      statusLabel: ["labels", "ethics-status"],
      cancel: ["button-labels", "history-add-status-cancel"],
      save: ["button-labels", "history-save"],
    },
  };
}

export type EthicsRecord = Awaited<ReturnType<typeof ethicsRecord>>;
