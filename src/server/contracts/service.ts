import "server-only";
import { cache } from "react";
import { z } from "zod";
import { authenticate } from "@/server/identity/session/service";
import { requireModule, requireRead } from "@/server/platform/permissions";
import { contractRead } from "@/server/oracle/api/contracts";
import { AppError } from "@/lib/errors";
import {
  label,
  resourceVisible,
  resources,
} from "@/server/platform/configuration/resources";
import { contractId, type ContractQuery } from "@/features/contracts/schema";
import {
  contractAssignees,
  contractListingChoices,
} from "@/server/contracts/lookups";
import {
  dashboardRoles,
  organizations,
} from "@/server/platform/configuration/service";
import { sanitizeHtml } from "@/server/platform/sanitize";
import { mapApprovalGraph } from "@/server/record/approvals/graph";
import type {
  ContractDetail,
  ContractPage,
  ContractRow,
} from "@/features/contracts/types";
import type { HistoryHost } from "@/server/record/objects/history";
import type { DelegationHost } from "@/server/record/objects/delegations";

const optional = z.union([z.string(), z.number()]).nullish();
const contractRoleRows = cache(async (id: string) => {
  const validId = contractId.parse(id);
  const { user, session } = await authenticate();
  requireModule(user, "CONTRACTS");
  const roles = z
    .object({
      items: z.array(
        z.object({
          page_name: z.string(),
          read_access: z.string().nullish(),
          edit_access: z.string().nullish(),
          delete_access: z.string().nullish(),
        }),
      ),
    })
    .parse(
      await contractRead("getSecurityUser_roles", {
        token: session.token,
        p_obj_type: "CONTRACT",
        p_obj_id: validId,
      }),
    );
  return {
    id: validId,
    token: session.token,
    items: roles.items.map((role) => ({
      page_name: role.page_name,
      read_access: role.read_access ?? null,
      edit_access: role.edit_access ?? null,
      delete_access: role.delete_access ?? null,
    })),
  };
});
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
function display(r: z.infer<typeof row>): ContractRow {
  const statusCode = r.status_lkp_code || r.status_code || "";
  const statusNames: Record<string, string> = {
    DRFT: "Draft",
    AIA: "Awaiting Internal Approval",
    IA: "Internally Approved",
    REJ: "Rejected",
    REWORK: "Sent for Rework",
    SUB: "Submitted for Signing",
    SIGNED: "Signed",
    WITHDRAWN: "Withdrawn",
  };
  return {
    id: String(r.contract_id),
    number: r.contract_number,
    title: r.contract_title,
    status: r.status || statusNames[statusCode] || "",
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
    parts.push(
      `LOWER("contract_number") LIKE LOWER(${literal(`%${q.number.trim()}%`)})`,
    );
  if (q.title.trim())
    parts.push(
      `LOWER("contract_title") LIKE LOWER(${literal(`%${q.title.trim()}%`)})`,
    );
  if (q.referenceNumber.trim())
    parts.push(
      `LOWER("object_number") LIKE LOWER(${literal(`%${q.referenceNumber.trim()}%`)})`,
    );
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
export function mapContracts(raw: unknown, q: ContractQuery): ContractPage {
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
  const rows = parsed.data.items.map(display);
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
export async function listContracts(q: ContractQuery, signal?: AbortSignal) {
  const { user, session } = await authenticate();
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
  return mapContracts(
    await contractRead(
      "getGetAllContracts",
      {
        token: session.token,
        p_status: q.status,
        p_level: q.level,
      },
      contractOracleQuery(q),
      signal,
    ),
    q,
  );
}
export const loadContract = cache(
  async (id: string): Promise<ContractDetail> => {
    const validId = contractId.parse(id);
    const roles = await contractRoleRows(validId);
    requireRead(roles.items, "contracts-summary");
    const parsed = row.safeParse(
      await contractRead(
        "getContractsContract_id",
        { token: roles.token },
        undefined,
        undefined,
        { contract_id: validId },
      ),
    );
    if (!parsed.success)
      throw new AppError(
        "CONTRACT",
        "Oracle returned an invalid Contract Summary.",
      );
    if (String(parsed.data.contract_id) !== validId)
      throw new AppError(
        "FORBIDDEN",
        "The returned contract does not match the requested record.",
        403,
      );
    const orgId = parsed.data.org_id;
    if (
      orgId == null ||
      !String(orgId) ||
      !(await organizations()).some((org) => org.id === String(orgId))
    )
      throw new AppError(
        "FORBIDDEN",
        "This Contract is outside your organization scope.",
        403,
      );
    const result = display(parsed.data);
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
      kind: "date" | "text" = "text",
    ) =>
      value && resourceVisible(rb, "contract", "labels", key)
        ? [
            {
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
      fields: [
        ...field(
          "contract-type",
          "Contract Type",
          parsed.data.contract_type_desc || result.type,
        ),
        ...field("contract-title", "Contract Title", result.title),
        ...field("contractStatus", "Contract Status", result.status),
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
          "contract-created-by",
          "Created by",
          parsed.data.created_by_name || "",
        ),
        ...field(
          "contract-lastUpdatedBy",
          "Last Updated by",
          parsed.data.last_updated_by_name || "",
        ),
        ...field(
          "contract-deadline-date",
          "Deadline Date",
          result.deadline,
          "date",
        ),
      ],
    };
  },
);

export async function requireContractTab(
  id: string,
  page:
    | "contracts-history"
    | "contracts-delegation"
    | "contracts-workflow"
    | "contracts-signers",
) {
  const roles = await contractRoleRows(id);
  requireRead(roles.items, page);
  const contract = await loadContract(roles.id);
  return {
    token: roles.token,
    id: roles.id,
    number: contract.number,
    statusCode: contract.statusCode,
  };
}

/** VBCS's Contract Version selector reads the active version from this ORDS list. */
export async function contractActiveVersion(id: string) {
  await loadContract(id);
  const scope = await contractRoleRows(id);
  const raw = await contractRead("getContractsGetContractVersions", {
    token: scope.token,
    contract_id: scope.id,
  });
  const versions = z
    .object({
      items: z.array(
        z.object({
          contract_id: z.number(),
          object_str_ref: z.string().nullish(),
          active_version_flag: z.string().nullish(),
          creation_date: z.string().nullish(),
        }),
      ),
    })
    .parse(raw).items;
  if (versions.some((version) => String(version.contract_id) !== scope.id))
    throw new AppError(
      "FORBIDDEN",
      "Oracle returned another Contract's versions.",
      403,
    );
  const active = versions.find(
    (version) => version.active_version_flag === "Y",
  );
  return active
    ? { name: active.object_str_ref || "", created: active.creation_date || "" }
    : null;
}

export async function contractVisibleTabs(id: string) {
  await loadContract(id);
  const roles = await contractRoleRows(id);
  const rb = await resources();
  const grant = (page: string) => {
    const matches = roles.items.filter((item) => item.page_name === page);
    return (
      matches.length > 0 && matches.every((item) => item.read_access === "Y")
    );
  };
  return {
    workflow: grant("contracts-workflow"),
    history: grant("contracts-history"),
    delegation: grant("contracts-delegation"),
    signers: grant("contracts-signers"),
    labels: Object.fromEntries(
      [
        "contracts-summary",
        "contracts-workflow",
        "contracts-signers",
        "contracts-history",
        "contracts-delegation",
      ].map((key) => [key, label(rb, "contract", "page-name", key, key)]),
    ),
  };
}

/** Contract parameters for the same object-history fragment used by EOI. */
export async function contractHistoryHost(id: string): Promise<HistoryHost> {
  const scope = await requireContractTab(id, "contracts-history");
  const { user } = await authenticate();
  const roles = (await contractRoleRows(id)).items;
  const edit = (page: string) => {
    const matches = roles.filter((role) => role.page_name === page);
    return (
      matches.length > 0 && matches.every((role) => role.edit_access === "Y")
    );
  };
  return {
    token: scope.token,
    user,
    objectType: "CONTRACT",
    objectId: scope.id,
    objectNumber: scope.number,
    approvalType: "CONTRACT",
    bundle: "contract",
    statusLookup: "CONTRACT_STATUS",
    statusCode: scope.statusCode,
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

/** Contract parameters for the same object-delegations fragment used by EOI. */
export async function contractDelegationHost(
  id: string,
): Promise<DelegationHost> {
  const scope = await requireContractTab(id, "contracts-delegation");
  const { user } = await authenticate();
  const roles = (await contractRoleRows(id)).items.filter(
    (role) => role.page_name === "contracts-delegation",
  );
  return {
    token: scope.token,
    user,
    objectType: "CONTRACT",
    objectId: scope.id,
    bundle: "contract",
    defaultPage: "contracts-summary",
    rights: {
      edit: roles.length > 0 && roles.every((role) => role.edit_access === "Y"),
      delete:
        roles.length > 0 && roles.every((role) => role.delete_access === "Y"),
    },
  };
}

/** The shared VBCS approval-workflow fragment uses this existing ORDS route. */
async function contractWorkflowScope(
  id: string,
  number: string,
  statusCode: string,
) {
  if (["DRFT", "REWORK"].includes(statusCode))
    throw new AppError(
      "FORBIDDEN",
      "Workflow is unavailable until the Contract is finalized.",
      403,
    );
  const scope = await requireContractTab(id, "contracts-workflow");
  if (number !== scope.number)
    throw new AppError("BAD_REQUEST", "Invalid Contract number.", 400);
  if (["DRFT", "REWORK"].includes(scope.statusCode))
    throw new AppError(
      "FORBIDDEN",
      "Workflow is unavailable until the Contract is finalized.",
      403,
    );
  return scope;
}

export async function contractWorkflow(
  id: string,
  number: string,
  statusCode: string,
) {
  const scope = await contractWorkflowScope(id, number, statusCode);
  const raw = await contractRead(
    "getApproval_setupApproval_stages",
    { token: scope.token },
    new URLSearchParams({ doc_num: number, doc_type: "CONTRACT" }),
  );
  const stages = z
    .object({
      items: z.array(
        z.object({
          approval_number: z.union([z.string(), z.number()]).nullish(),
          level_id: z.number(),
          level_name: z.string().nullish(),
          level_desc: z.string().nullish(),
          status: z.string().nullish(),
          approval_type: z.string().nullish(),
          approval_group_type: z.string().nullish(),
          no_of_approval_req: z.number().nullish(),
          remarks: z.string().nullish(),
        }),
      ),
    })
    .parse(raw).items;
  if (
    stages.some(
      (stage) =>
        stage.approval_number != null &&
        String(stage.approval_number) !== number,
    )
  )
    throw new AppError(
      "FORBIDDEN",
      "Oracle returned another Contract's approval route.",
      403,
    );
  return stages
    .sort((a, b) => a.level_id - b.level_id)
    .map((stage) => ({
      id: stage.level_id,
      name: stage.level_name || "",
      description: stage.level_desc || "",
      status: stage.status || "",
      type: stage.approval_type || "",
      groupType: stage.approval_group_type || "",
      required: stage.no_of_approval_req ?? null,
      remarks: stage.remarks ? sanitizeHtml(stage.remarks) : "",
    }));
}

/** The VBCS fragment renders this nested ORDS response with Treant. */
export async function contractWorkflowGraph(
  id: string,
  number: string,
  statusCode: string,
) {
  const scope = await contractWorkflowScope(id, number, statusCode);
  const raw = await contractRead(
    "getApproval_setupApproval_stages_graph",
    { token: scope.token },
    new URLSearchParams({ doc_num: number, doc_type: "CONTRACT" }),
  );
  return mapApprovalGraph(raw, number);
}

/** The VBCS "View approvers" dialog reads this stage-scoped ORDS operation. */
export async function contractStageUsers(
  id: string,
  number: string,
  stageId: number,
) {
  const stages = await contractWorkflow(
    id,
    number,
    (await loadContract(id)).statusCode,
  );
  if (!stages.some((stage) => stage.id === stageId))
    throw new AppError("BAD_REQUEST", "Invalid approval stage.", 400);
  const scope = await requireContractTab(id, "contracts-workflow");
  const raw = await contractRead("getApproval_setupGet_stage_users", {
    token: scope.token,
    p_approval_number: number,
    stage_id: String(stageId),
    doc_type: "CONTRACT",
  });
  const rows = z
    .object({
      items: z.array(
        z.object({
          stage_id: z.number(),
          name: z.string().nullish(),
          user_name: z.string().nullish(),
          status: z.string().nullish(),
        }),
      ),
    })
    .parse(raw).items;
  if (rows.some((row) => row.stage_id !== stageId))
    throw new AppError(
      "FORBIDDEN",
      "Oracle returned another approval stage's users.",
      403,
    );
  return rows.map((row) => ({
    name: row.name || "",
    email: row.user_name || "",
    status: row.status || "",
  }));
}

export async function contractSigners(id: string, statusCode: string) {
  if (["DRFT", "REWORK"].includes(statusCode))
    throw new AppError(
      "FORBIDDEN",
      "The Signers tab is unavailable for this Contract status.",
      403,
    );
  const scope = await requireContractTab(id, "contracts-signers");
  if (["DRFT", "REWORK"].includes(scope.statusCode))
    throw new AppError(
      "FORBIDDEN",
      "The Signers tab is unavailable for this Contract status.",
      403,
    );
  const raw = await contractRead("getContractsSignerDetails", {
    token: scope.token,
    contract_id: scope.id,
  });
  const result = z
    .object({
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
    })
    .parse(raw);
  if (
    result.items.some(
      (item) =>
        item.contract_id != null && String(item.contract_id) !== scope.id,
    )
  )
    throw new AppError(
      "FORBIDDEN",
      "Oracle returned another Contract's signers.",
      403,
    );
  return result.items.map((item) => ({
    name: item.signer_name,
    email: item.signer_email,
    type: item.user_type || "",
    sent: item.sentdatetime || "",
    delivered: item.delivereddatetime || "",
    signed: item.signeddatetime || "",
    status: item.status || "",
  }));
}

export async function contractDelegations(id: string) {
  const scope = await requireContractTab(id, "contracts-delegation");
  const [raw, people] = await Promise.all([
    contractRead("getProposalDelegationsProposal_id", {
      token: scope.token,
      object_id: scope.id,
      object_type: "CONTRACT",
    }),
    contractAssignees(),
  ]);
  const personNames = new Map(
    people.map((person) => [person.value, person.label]),
  );
  const data = z
    .object({
      items: z.array(
        z.object({
          pid: z.number(),
          page_name: z.string().nullish(),
          page_desc: z.string().nullish(),
          read_access: z.string().nullish(),
          edit_access: z.string().nullish(),
          delete_access: z.string().nullish(),
          start_date: z.string().nullish(),
          end_date: z.string().nullish(),
        }),
      ),
    })
    .parse(raw);
  return data.items.map((item) => ({
    personId: String(item.pid),
    personName: personNames.get(String(item.pid)) || String(item.pid),
    page: item.page_desc || item.page_name || "",
    read: item.read_access === "Y",
    edit: item.edit_access === "Y",
    delete: item.delete_access === "Y",
    start: item.start_date || "",
    end: item.end_date || "",
  }));
}

export async function contractHistory(id: string, number: string) {
  const scope = await requireContractTab(id, "contracts-history");
  if (number !== scope.number)
    throw new AppError("BAD_REQUEST", "Invalid Contract number.", 400);
  const [statusRaw, approvalRaw] = await Promise.all([
    contractRead("getSharedObjectStatus", {
      token: scope.token,
      p_obj_type: "CONTRACT",
      p_obj_id: scope.id,
    }),
    contractRead("getPre_awardGetApprovalHistory", {
      token: scope.token,
      transaction_number: number,
      approval_type: "CONTRACT",
    }),
  ]);
  const status = z
    .object({
      items: z.array(
        z.object({
          object_id: z.number().optional(),
          object_status: z.string().nullish(),
          object_status_lkp_code: z.string().nullish(),
          status_process_mode: z.string().nullish(),
          comments: z.string().nullish(),
          created_by_name: z.string().nullish(),
          creation_date: z.string().nullish(),
        }),
      ),
    })
    .parse(statusRaw).items;
  if (
    status.some(
      (item) =>
        item.object_id !== undefined && String(item.object_id) !== scope.id,
    )
  )
    throw new AppError(
      "FORBIDDEN",
      "Oracle returned another Contract's status history.",
      403,
    );
  const approval = z
    .object({
      items: z.array(
        z.object({
          transaction_number: z.string().nullish(),
          status: z.string().nullish(),
          full_name: z.string().nullish(),
          user_comments: z.string().nullish(),
          creation_date: z.string().nullish(),
          last_update_date: z.string().nullish(),
          stage_desc: z.string().nullish(),
        }),
      ),
    })
    .parse(approvalRaw).items;
  if (
    approval.some(
      (item) => item.transaction_number && item.transaction_number !== number,
    )
  )
    throw new AppError(
      "FORBIDDEN",
      "Oracle returned another Contract's approval history.",
      403,
    );
  return {
    status: status.map((item) => ({
      status: item.object_status || item.object_status_lkp_code || "",
      mode: item.status_process_mode || "",
      comments: item.comments || "",
      user: item.created_by_name || "",
      date: item.creation_date || "",
    })),
    approval: approval.map((item) => ({
      status: item.status || "",
      user: item.full_name || "",
      comments: item.user_comments || "",
      stage: item.stage_desc || "",
      date: item.last_update_date || item.creation_date || "",
    })),
  };
}

/** The shared workflow fragment shows approval history under the Workflow grant. */
export async function contractApprovalHistory(id: string, number: string) {
  const scope = await requireContractTab(id, "contracts-workflow");
  if (number !== scope.number)
    throw new AppError("BAD_REQUEST", "Invalid Contract number.", 400);
  const raw = await contractRead("getPre_awardGetApprovalHistory", {
    token: scope.token,
    transaction_number: number,
    approval_type: "CONTRACT",
  });
  const rows = z
    .object({
      items: z.array(
        z.object({
          transaction_number: z.string().nullish(),
          status: z.string().nullish(),
          full_name: z.string().nullish(),
          level_name: z.string().nullish(),
          stage_desc: z.string().nullish(),
          user_comments: z.string().nullish(),
          last_update_date: z.string().nullish(),
          creation_date: z.string().nullish(),
        }),
      ),
    })
    .parse(raw).items;
  if (
    rows.some(
      (row) => row.transaction_number && row.transaction_number !== number,
    )
  )
    throw new AppError(
      "FORBIDDEN",
      "Oracle returned another Contract's approval history.",
      403,
    );
  return rows.map((row) => ({
    user: row.full_name || "",
    status: row.status || "",
    stage: row.stage_desc || "",
    levelName: row.level_name || "",
    comments: row.user_comments || "",
    date: row.last_update_date || row.creation_date || "",
    created: row.creation_date || row.last_update_date || "",
  }));
}

/** The legacy object-comments drawer reads /shared/comments/ with the contracts flow name. */
export async function contractComments(id: string) {
  const scope = await loadContract(id);
  const roles = await contractRoleRows(scope.id);
  const raw = await contractRead(
    "getProposalComments",
    { token: roles.token },
    new URLSearchParams({ object_id: scope.id, module: "contracts" }),
  );
  const items = z
    .object({
      items: z.array(
        z.object({
          comment_id: z.number(),
          object_id: z.union([z.string(), z.number()]),
          comments: z.string().nullish(),
          full_name: z.string().nullish(),
          creation_date: z.string().nullish(),
        }),
      ),
    })
    .parse(raw).items;
  if (items.some((item) => String(item.object_id) !== scope.id))
    throw new AppError(
      "FORBIDDEN",
      "Oracle returned another Contract's comments.",
      403,
    );
  return items.map((item) => ({
    id: item.comment_id,
    html: sanitizeHtml(item.comments || ""),
    author: item.full_name || "",
    date: item.creation_date || "",
  }));
}

const auditEvents = [
  "",
  "INSERTED",
  "UPDATED",
  "NEW VERSION CREATED",
  "DELETED",
] as const;
export type ContractAuditEvent = (typeof auditEvents)[number];
export function parseContractAuditEvent(
  value: string | undefined,
): ContractAuditEvent {
  if (value !== undefined && !auditEvents.includes(value as ContractAuditEvent))
    throw new AppError("BAD_REQUEST", "Invalid Contract audit filter.", 400);
  return (value || "") as ContractAuditEvent;
}
/** The VBCS Audit Trail drawer calls the existing getObjectAudits operation. */
export async function contractAudits(id: string, event: ContractAuditEvent) {
  const scope = await loadContract(id);
  const roles = await contractRoleRows(scope.id);
  const raw = await contractRead("getSharedGetObjectAudits2", {
    token: roles.token,
    p_obj_id: scope.id,
    p_obj_type: "CONTRACT",
    p_page_name: "contracts",
    p_event: event,
  });
  const items = z
    .object({
      items: z.array(
        z.object({
          object_id: z.union([z.string(), z.number()]),
          object_type: z.string().nullish(),
          event: z.string(),
          name: z.string().nullish(),
          date_time: z.string().nullish(),
          field_values: z
            .array(
              z.object({
                field_name: z.string(),
                field_value: z.union([z.string(), z.number()]).nullish(),
                old_value: z.union([z.string(), z.number()]).nullish(),
              }),
            )
            .nullish(),
        }),
      ),
    })
    .parse(raw).items;
  if (
    items.some(
      (item) =>
        String(item.object_id) !== scope.id ||
        (item.object_type && item.object_type !== "CONTRACT"),
    )
  )
    throw new AppError(
      "FORBIDDEN",
      "Oracle returned another Contract's audit trail.",
      403,
    );
  return items.map((item, index) => ({
    id: index,
    event: item.event,
    name: item.name || "",
    date: item.date_time || "",
    fields: (item.field_values || []).map((field) => ({
      name: field.field_name,
      value: field.field_value == null ? "" : String(field.field_value),
      oldValue: field.old_value == null ? "" : String(field.old_value),
    })),
  }));
}
