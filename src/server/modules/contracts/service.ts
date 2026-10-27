import "server-only";
import { cache } from "react";
import { z } from "zod";
import { authenticate } from "@/server/identity/session/service";
import {
  finalizedOf,
  objectAccessOf,
  requireModule,
} from "@/server/platform/permissions";
import { contracts, eoi, lookups, roles } from "@/server/oracle/api";
import { orNull, recordRoleRows } from "@/server/record/shared";
import { statusChoices } from "@/server/platform/configuration/choices";
import { containsClause } from "@/server/oracle/where";
import { AppError } from "@/lib/errors";
import {
  label,
  resourceVisible,
  resources,
} from "@/server/platform/configuration/resources";
import {
  contractId,
  type ContractQuery,
} from "@/features/modules/contracts/schema";
import { contractListingChoices } from "@/server/modules/contracts/lookups";
import {
  dashboardRoles,
  organizations,
} from "@/server/platform/configuration/service";
import type {
  ContractDetail,
  ContractPage,
  ContractRow,
} from "@/features/modules/contracts/types";
import type { HistoryHost } from "@/server/record/objects/history";
import type { DelegationHost } from "@/server/record/objects/delegations";

export const CONTRACT_MODULE = "CONTRACT";
/** The record's pages (legacy contracts pagesList), each a tab and a comments/audit page. */
export const CONTRACT_PAGES = [
  "contracts-summary",
  "contracts-workflow",
  "contracts-signers",
  "contracts-history",
  "contracts-delegation",
];

const optional = z.union([z.string(), z.number()]).nullish();
const pageNames = z.object({
  items: z.array(z.object({ page_name: z.string() })),
});
const lockRows = z.object({
  items: z.array(z.object({ id: z.number(), page_id: z.number() })),
});
/**
 * The user's rights on one contract (user_roles), fail closed as every record host's, with the finalize state the
 * Workflow and Signers tabs open on.
 */
export const contractRecordContext = cache(async (id: string) => {
  const validId = contractId.parse(id);
  const { user, session } = await authenticate();
  requireModule(user, "CONTRACTS");
  const [rows, finalizable, locks] = await Promise.all([
    roles
      .record({ objectType: CONTRACT_MODULE, objectId: validId })
      .then((raw) => recordRoleRows.parse(raw).items),
    orNull(
      eoi
        .finalizablePages({ objectType: CONTRACT_MODULE, objectId: validId })
        .then((raw) =>
          pageNames.parse(raw).items.map((p) => p.page_name.toLowerCase()),
        ),
    ),
    orNull(
      eoi
        .lockedModules({ module: CONTRACT_MODULE, recordId: validId })
        .then((raw) => lockRows.parse(raw).items),
    ),
  ]);
  const access = objectAccessOf(rows);
  return {
    id: validId,
    session,
    user,
    access,
    finalizable,
    finalized: finalizedOf(access.pages, locks ?? []),
  };
});
export type ContractRecordContext = Awaited<
  ReturnType<typeof contractRecordContext>
>;
/**
 * Legacy getTabs for Workflow and Signers: past draft and rework, or with every finalizable page finalized. An
 * unreadable finalize state keeps them closed.
 */
export function routeOpen(context: ContractRecordContext, statusCode: string) {
  if (!["DRFT", "REWORK"].includes(statusCode)) return true;
  const { finalizable, finalized } = context;
  return (
    finalizable !== null && finalizable.every((page) => finalized.has(page))
  );
}
function requirePage(context: ContractRecordContext, page: string) {
  if (context.access.roles.get(page)?.read !== true)
    throw new AppError(
      "FORBIDDEN",
      "You do not have access to this page.",
      403,
    );
}
/** VBCS grants the listing action through the DASHBOARD user_roles response. */
export async function canCreateContract() {
  const { user } = await authenticate();
  requireModule(user, "CONTRACTS");
  const roles = await dashboardRoles();
  const grants = roles.filter((role) => role.page_name === "create-contract");
  return grants.length > 0 && grants.every((role) => role.read_access === "Y");
}
const row = z.object({
  contract_id: z.number().int().positive(),
  contract_number: z.string(),
  contract_title: z.string(),
  status: z.string().nullish(),
  status_code: z.string().nullish(),
  status_lkp_code: z.string().nullish(),
  contract_type_name: z.string().nullish(),
  contract_type_desc: z.string().nullish(),
  contract_type: z.string().nullish(),
  contract_level: z.string().nullish(),
  contract_level_desc: z.string().nullish(),
  object_ref_id: optional,
  object_number: z.string().nullish(),
  contract_start_date: z.string().nullish(),
  contract_end_date: z.string().nullish(),
  creation_date: z.string().nullish(),
  last_update_date: z.string().nullish(),
  deadline_date: z.string().nullish(),
  org_unit_name: z.string().nullish(),
  org_id: optional,
  assigned_to_name: z.string().nullish(),
  created_by_name: z.string().nullish(),
  created_by: optional,
  last_updated_by_name: z.string().nullish(),
  uses_standard_templ: z.string().nullish(),
  template_id: optional,
  legal_id: optional,
  contract_deadlines: z
    .array(
      z.object({
        deadline_type: z.string().nullish(),
        deadline_type_desc: z.string().nullish(),
        deadline_description: z.string().nullish(),
        deadline_date: z.string().nullish(),
        reminder_days: optional,
      }),
    )
    .nullish(),
});
const list = z.object({
  items: z.array(row),
  offset: z.number().int().nonnegative().optional(),
  total_count: z.number().int().nonnegative().optional(),
  totalResults: z.number().int().nonnegative().optional(),
  hasMore: z.boolean().optional(),
});
/** The listing's status tabs: the configured CONTRACT_STATUS codes with "All" first (legacy getLookupADP). */
export const contractStatusChoices = cache(async () =>
  statusChoices(
    await lookups.codes({ types: "CONTRACT_STATUS" }),
    "CONTRACT_STATUS",
  ),
);
/**
 * The configured status names. Some DEV rows carry a status code with no name, which legacy showed as an empty pill;
 * the name falls back to the configured one, and an unreadable lookup names nothing.
 */
async function statusNames(): Promise<Record<string, string>> {
  const choices = await orNull(contractStatusChoices());
  return Object.fromEntries((choices ?? []).map((c) => [c.value, c.label]));
}
function display(
  r: z.infer<typeof row>,
  names: Record<string, string>,
): ContractRow {
  const statusCode = r.status_lkp_code || r.status_code || "";
  return {
    id: String(r.contract_id),
    number: r.contract_number,
    title: r.contract_title,
    status: r.status || names[statusCode] || "",
    statusCode,
    type: r.contract_type_name || "",
    level: r.contract_level_desc || r.contract_level || "",
    reference:
      r.object_number ||
      (r.object_ref_id == null ? "" : String(r.object_ref_id)),
    start: r.contract_start_date || "",
    end: r.contract_end_date || "",
    created: r.creation_date || "",
    updated: r.last_update_date || "",
    deadline: r.deadline_date || "",
    organization: r.org_unit_name || "",
    assignedTo: r.assigned_to_name || "",
  };
}
const literal = (value: string) => `'${value.replaceAll("'", "''")}'`;
/** Legacy getAllContracts uses the services/transforms.js p_where_clause grammar. */
export function contractOracleQuery(q: ContractQuery) {
  const parts: string[] = [];
  if (q.number.trim())
    parts.push(containsClause('"contract_number"', q.number.trim()));
  if (q.title.trim())
    parts.push(containsClause('"contract_title"', q.title.trim()));
  if (q.referenceNumber.trim())
    parts.push(containsClause('"object_number"', q.referenceNumber.trim()));
  if (q.contractType) parts.push(`"contract_type"=${literal(q.contractType)}`);
  if (q.orgUnit) parts.push(`"org_id"=${literal(q.orgUnit)}`);
  if (q.from)
    parts.push(`"contract_start_date"=${literal(`${q.from} 00:00:00`)}`);
  if (q.to) parts.push(`"contract_end_date"=${literal(`${q.to} 00:00:00`)}`);
  const params = new URLSearchParams({
    p_offset: String((q.page - 1) * 10),
    p_limit: "10",
  });
  if (parts.length) params.set("p_where_clause", `(${parts.join(" AND ")})`);
  if (q.sort) {
    params.set("p_order_by", `"${q.sort}"`);
    params.set("p_sort_order", q.direction);
  }
  return params;
}
export function mapContracts(
  raw: unknown,
  q: ContractQuery,
  names: Record<string, string> = {},
): ContractPage {
  const parsed = list.safeParse(raw);
  if (!parsed.success)
    throw new AppError(
      "CONTRACT",
      "Oracle returned an invalid Contracts list.",
    );
  const offset = (q.page - 1) * 10;
  if (parsed.data.offset !== undefined && parsed.data.offset !== offset)
    throw new AppError(
      "CONTRACT",
      "Oracle returned a different Contracts page.",
    );
  const rows = parsed.data.items.map((r) => display(r, names));
  if (new Set(rows.map((r) => r.id)).size !== rows.length)
    throw new AppError("CONTRACT", "Oracle returned duplicate contracts.");
  const total = parsed.data.total_count ?? parsed.data.totalResults;
  return {
    rows,
    offset,
    total,
    query: q,
    hasMore:
      total === undefined
        ? (parsed.data.hasMore ?? rows.length === 10)
        : offset + rows.length < total,
  };
}
export async function listContracts(q: ContractQuery) {
  const { user } = await authenticate();
  requireModule(user, "CONTRACTS");
  if (q.sort || q.contractType || q.orgUnit) {
    const choices = await contractListingChoices();
    if (
      (q.sort && !choices.sorts.some((choice) => choice.value === q.sort)) ||
      (q.contractType &&
        !choices.types.some((choice) => choice.value === q.contractType)) ||
      (q.orgUnit && !choices.orgs.some((choice) => choice.value === q.orgUnit))
    )
      throw new AppError("BAD_REQUEST", "Invalid contract filter choice.", 400);
  }
  const [raw, names] = await Promise.all([
    contracts.list({
      status: q.status,
      level: q.level,
      query: Object.fromEntries(contractOracleQuery(q)),
    }),
    statusNames(),
  ]);
  return mapContracts(raw, q, names);
}
export const loadContract = cache(
  async (id: string): Promise<ContractDetail> => {
    const context = await contractRecordContext(id);
    requirePage(context, "contracts-summary");
    const [raw, names, orgs] = await Promise.all([
      contracts.byId({ id: context.id }),
      statusNames(),
      organizations(),
    ]);
    const parsed = row.safeParse(raw);
    if (!parsed.success)
      throw new AppError(
        "CONTRACT",
        "Oracle returned an invalid Contract Summary.",
      );
    if (String(parsed.data.contract_id) !== context.id)
      throw new AppError(
        "FORBIDDEN",
        "The returned contract does not match the requested record.",
        403,
      );
    const orgId = parsed.data.org_id;
    if (
      orgId == null ||
      !String(orgId) ||
      !orgs.some((org) => org.id === String(orgId))
    )
      throw new AppError(
        "FORBIDDEN",
        "This Contract is outside your organization scope.",
        403,
      );
    const result = display(parsed.data, names);
    if (!result.type && parsed.data.contract_type) {
      const choices = await contractListingChoices();
      result.type =
        choices.types
          .find((choice) => choice.value === parsed.data.contract_type)
          ?.label.replace(/\bcontract\b/i, "Contract") || "";
    }
    const rb = await resources();
    const field = (
      key: string,
      fallback: string,
      value: string,
      kind: ContractDetail["fields"][number]["kind"] = "text",
    ) =>
      value && resourceVisible(rb, "contract", "labels", key)
        ? [
            {
              key,
              label: label(rb, "contract", "labels", key, fallback),
              value,
              kind,
            },
          ]
        : [];
    return {
      ...result,
      document: {
        typeCode: parsed.data.contract_type || "",
        levelCode: parsed.data.contract_level || "",
        templateId:
          parsed.data.template_id == null
            ? ""
            : String(parsed.data.template_id),
        legalId:
          parsed.data.legal_id == null ? "" : String(parsed.data.legal_id),
      },
      createdBy: parsed.data.created_by_name || "",
      createdById:
        parsed.data.created_by == null ? "" : String(parsed.data.created_by),
      updatedBy: parsed.data.last_updated_by_name || "",
      deadlines: (parsed.data.contract_deadlines ?? []).map((deadline) => ({
        type: deadline.deadline_type_desc || deadline.deadline_type || "",
        description: deadline.deadline_description || "",
        date: deadline.deadline_date || "",
        reminderDays:
          deadline.reminder_days == null ? "" : String(deadline.reminder_days),
      })),
      usesStandardTemplate:
        parsed.data.uses_standard_templ === "Y"
          ? true
          : parsed.data.uses_standard_templ === "N"
            ? false
            : null,
      // Legacy contracts-new-contract-page header, in its order; each needs a value and its visible RB key.
      fields: [
        ...field(
          "contract-type",
          "Contract Type",
          parsed.data.contract_type_desc || result.type,
        ),
        ...field("contract-title", "Contract Title", result.title),
        ...field("contractStatus", "Contract Status", result.status, "status"),
        ...field(
          "contract-relation-type",
          "Contract Relation Type",
          parsed.data.contract_level_desc || result.level,
        ),
        ...field(
          "summary-relation-item",
          "Relation Item",
          parsed.data.object_number || result.reference,
        ),
        ...field("summary-org-unit", "Org Unit", result.organization),
        ...field("summary-assigned-to", "Assigned To", result.assignedTo),
        ...field("contract-start-date", "Start Date", result.start, "date"),
        ...field("contract-end-date", "End Date", result.end, "date"),
        ...field(
          "contract-deadline-date",
          "Deadline Date",
          result.deadline,
          "date",
        ),
        ...field(
          "contract-created-by",
          "Created by",
          parsed.data.created_by_name || "",
          "creator",
        ),
        ...field(
          "contract-lastUpdatedBy",
          "Last Updated by",
          parsed.data.last_updated_by_name || "",
        ),
      ],
    };
  },
);
/** A tab's scope: its read grant and the summary record it belongs to. */
export async function contractTab(id: string, page: string) {
  const context = await contractRecordContext(id);
  requirePage(context, page);
  const contract = await loadContract(context.id);
  if (
    ["contracts-workflow", "contracts-signers"].includes(page) &&
    !routeOpen(context, contract.statusCode)
  )
    throw new AppError(
      "FORBIDDEN",
      "This page opens once the Contract is finalized.",
      403,
    );
  return { context, contract };
}

const versionRows = z.object({
  items: z.array(
    z.object({
      contract_id: z.number(),
      object_str_ref: z.string().nullish(),
      active_version_flag: z.string().nullish(),
      creation_date: z.string().nullish(),
    }),
  ),
});
/** VBCS's Contract Version selector reads the active version from this ORDS list; RB-gated as legacy. */
export async function contractActiveVersion(id: string) {
  const contract = await loadContract(id);
  const rb = await resources();
  if (!resourceVisible(rb, "contract", "labels", "contract-version"))
    return null;
  const versions = versionRows.parse(
    await contracts.versions({ id: contract.id }),
  ).items;
  if (versions.some((version) => String(version.contract_id) !== contract.id))
    throw new AppError(
      "FORBIDDEN",
      "Oracle returned another Contract's versions.",
      403,
    );
  const active = versions.find(
    (version) => version.active_version_flag === "Y",
  );
  return active
    ? {
        label: label(
          rb,
          "contract",
          "labels",
          "contract-version",
          "Contract Version",
        ),
        name: active.object_str_ref || "",
        created: active.creation_date || "",
      }
    : null;
}

/** The tabs the record shows (legacy getTabs): each needs its page's read; Workflow and Signers also `routeOpen`. */
export async function contractVisibleTabs(id: string) {
  const [context, contract, rb] = await Promise.all([
    contractRecordContext(id),
    loadContract(id),
    resources(),
  ]);
  const read = (page: string) => context.access.roles.get(page)?.read === true;
  const open = routeOpen(context, contract.statusCode);
  return {
    workflow: read("contracts-workflow") && open,
    history: read("contracts-history"),
    delegation: read("contracts-delegation"),
    signers: read("contracts-signers") && open,
    labels: Object.fromEntries(
      CONTRACT_PAGES.map((key) => [
        key,
        label(rb, "contract", "page-name", key, key),
      ]),
    ),
  };
}

/** Contract parameters for the shared object-history fragment. */
export async function contractHistoryHost(id: string): Promise<HistoryHost> {
  const { context, contract } = await contractTab(id, "contracts-history");
  const edit = (page: string) => context.access.roles.get(page)?.edit === true;
  return {
    token: context.session.token,
    user: context.user,
    objectType: CONTRACT_MODULE,
    objectId: context.id,
    objectNumber: contract.number,
    approvalType: CONTRACT_MODULE,
    bundle: "contract",
    statusLookup: "CONTRACT_STATUS",
    statusCode: contract.statusCode,
    rights: {
      addStatus: edit("contract-add-status"),
      abandon: edit("contract-history-abandon-button"),
    },
    keys: {
      title: ["page-titles", "contracts-history"],
      status: ["table-headers", "history-contractStatus"],
      approvalTitle: ["header-labels", "history-page-approval-history"],
      approvalName: ["labels", "full-name"],
      approvalStatus: ["labels", "status"],
      approvalStage: ["labels", "stage"],
      approvalComments: ["labels", "user-comments"],
      approvalTransaction: ["labels", "transaction-no"],
      approvalUpdated: ["labels", "last-updated-date"],
      approvalNoData: ["helper-texts", "no-data"],
      statusLabel: ["labels", "history-contractStatus"],
      cancel: ["button-labels", "history-cancel"],
      save: ["button-labels", "history-save"],
      commentPlaceholder: ["placeholders", "history-comments"],
    },
  };
}

/** Contract parameters for the shared object-delegations fragment. */
export async function contractDelegationHost(
  id: string,
): Promise<DelegationHost> {
  const { context } = await contractTab(id, "contracts-delegation");
  const rights = context.access.roles.get("contracts-delegation");
  return {
    token: context.session.token,
    user: context.user,
    objectType: CONTRACT_MODULE,
    objectId: context.id,
    bundle: "contract",
    defaultPage: "contracts-summary",
    rights: { edit: rights?.edit === true, delete: rights?.delete === true },
  };
}

const signerRows = z.object({
  items: z.array(
    z.object({
      contract_id: z.union([z.string(), z.number()]).nullish(),
      signer_name: z.string(),
      signer_email: z.string(),
      user_type: z.string().nullish(),
      sentdatetime: z.string().nullish(),
      delivereddatetime: z.string().nullish(),
      signeddatetime: z.string().nullish(),
      status: z.string().nullish(),
    }),
  ),
});
/** The Signers tab, gated by the contract's own status (never the browser's). */
export async function contractSigners(id: string) {
  const { contract } = await contractTab(id, "contracts-signers");
  const items = signerRows.parse(
    await contracts.signers({ id: contract.id }),
  ).items;
  if (
    items.some(
      (item) =>
        item.contract_id != null && String(item.contract_id) !== contract.id,
    )
  )
    throw new AppError(
      "FORBIDDEN",
      "Oracle returned another Contract's signers.",
      403,
    );
  return items.map((item) => ({
    name: item.signer_name,
    email: item.signer_email,
    type: item.user_type || "",
    sent: item.sentdatetime || "",
    delivered: item.delivereddatetime || "",
    signed: item.signeddatetime || "",
    status: item.status || "",
  }));
}
