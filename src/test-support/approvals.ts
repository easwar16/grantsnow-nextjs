import "server-only";
import { fixtureMode } from "@/server/platform/configuration/environment";
/**
 * Development-only approval routes for the fixture EOIs (fixture writes return `{}` and change nothing):
 * EOI_1 is a draft with a two-stage route (Submit, Add Stage, delete the added stage); EOI_2 is in approval with the
 * fixture user as the current approver (Approve / Reject / Rework, Withdraw, change or remove approvers). Any other
 * document has no route, so Generate Approval Route shows on a draft.
 */
const ROUTES: Record<string, Record<string, unknown>[]> = {
  EOI_1: [
    {
      approval_number: "9001",
      stage_id: 501,
      level_name: "Stage 1",
      level_desc: "Head of Department review",
      approval_group: "83",
      approval_group_name: "Department Approvers",
      approval_type: "Approval",
      no_of_approval_req: 1,
      status: "Pending",
      stage_type: "A",
      approve_button_flag: "N",
      help_text:
        "<p>Check the <strong>budget</strong> and the eligibility.</p>",
    },
    {
      approval_number: "9001",
      stage_id: 502,
      level_name: "Stage 2",
      level_desc: "Research Office sign-off",
      approval_group: "101",
      approval_group_name: null,
      approval_type: "Approval",
      no_of_approval_req: 1,
      status: "Pending",
      stage_type: "M",
      remarks: "Added for the funder's matched-funding rule",
      approve_button_flag: "N",
    },
  ],
  EOI_2: [
    {
      approval_number: "9002",
      stage_id: 601,
      level_name: "Stage 1",
      level_desc: "Head of Department review",
      approval_group: "83",
      approval_group_name: "Department Approvers",
      approval_type: "Approval",
      no_of_approval_req: 1,
      status: "Approved",
      stage_type: "A",
      approve_button_flag: "N",
    },
    {
      approval_number: "9002",
      stage_id: 602,
      level_name: "Stage 2",
      level_desc: "Research Office sign-off",
      approval_group: "83",
      approval_group_name: "Research Office",
      approval_type: "Approval",
      no_of_approval_req: 1,
      status: "Pending",
      stage_type: "A",
      pending_approval_days: 3,
      approver_email: "alex.morgan@example.org",
      approve_button_flag: "Y",
    },
  ],
};
const USERS: Record<string, Record<string, unknown>[]> = {
  "501": [
    {
      user_name: "sam.taylor@example.org",
      name: "Sam Taylor",
      status: "Pending",
    },
  ],
  "502": [
    {
      user_name: "alex.morgan@example.org",
      name: "Alex Morgan",
      status: "Pending",
    },
  ],
  "601": [
    {
      user_name: "sam.taylor@example.org",
      name: "Sam Taylor",
      status: "Approved",
    },
  ],
  "602": [
    {
      user_name: "alex.morgan@example.org",
      name: "Alex Morgan",
      status: "Pending",
    },
    {
      user_name: "sam.taylor@example.org",
      name: "Sam Taylor",
      status: "Pending",
    },
  ],
};
const HISTORY: Record<string, Record<string, unknown>[]> = {
  EOI_2: [
    {
      approval_history_id: 7001,
      full_name: "Alex Morgan",
      status: "Submitted",
      stage_desc: "Stage 0|Submission|NA",
      user_comments: "<p>Ready for review.</p>",
      last_update_date: "2026-10-02T10:15:00Z",
    },
    {
      approval_history_id: 7002,
      full_name: "Sam Taylor",
      status: "Approved",
      stage_desc: "Stage 1|Head of Department review|NA",
      user_comments: null,
      last_update_date: "2026-10-03T14:40:00Z",
    },
  ],
};
const CONTRACT_STAGES = [
  {
    approval_number: "C_1301",
    level_id: 701,
    level_name: "Stage 1",
    level_desc: "Contract Approval",
    approval_type: "Approval",
    approval_group_type: "Individual",
    no_of_approval_req: 1,
    status: "Approved",
    remarks: "NA",
  },
  {
    approval_number: "C_1301",
    level_id: 702,
    level_name: "Stage 2",
    level_desc: "Legal head approval",
    approval_type: "Approval",
    approval_group_type: "Individual",
    no_of_approval_req: 1,
    status: "Pending",
    remarks: "NA",
  },
];
const CONTRACT_HISTORY = [
  {
    transaction_number: "C_1301",
    full_name: "Alex Morgan",
    level_name: "Stage 1",
    status: "Approved",
    stage_desc: "Stage 1|Contract Approval|NA",
    creation_date: "2026-10-03T14:40:00Z",
    last_update_date: "2026-10-03T14:40:00Z",
  },
  {
    transaction_number: "C_1301",
    full_name: "Alex Morgan",
    level_name: "Stage 1",
    status: "Submitted",
    stage_desc: "Stage 1|Contract Approval|NA",
    creation_date: "2026-10-02T10:15:00Z",
    last_update_date: "2026-10-02T10:15:00Z",
  },
];
export function fixtureApprovals(
  op: string,
  headers: Record<string, string>,
  query?: URLSearchParams,
) {
  if (!fixtureMode())
    throw new Error(
      "Fixture approvals cannot run outside explicit development mode.",
    );
  if (op === "getApproval_setupApproval_stages")
    return {
      items:
        query?.get("doc_type") === "OPPORTUNITIES-EOI"
          ? (ROUTES[query.get("doc_num") ?? ""] ?? [])
          : query?.get("doc_type") === "CONTRACT" &&
              query.get("doc_num") === "C_1301"
            ? CONTRACT_STAGES
            : [],
    };
  if (op === "getApproval_setupApproval_stages_graph") {
    if (query?.get("doc_type") === "OPPORTUNITIES-EOI") {
      const number = query.get("doc_num") ?? "";
      const stages = ROUTES[number] ?? [];
      return {
        nodeStructure: {
          text: { name: "Approval Workflow", title: "Start" },
          children: stages.length
            ? [
                {
                  text: {
                    name: String(stages[0].level_desc ?? ""),
                    title: String(stages[0].status ?? ""),
                    contact: String(stages[0].level_name ?? ""),
                  },
                  data: { approval_number: number, status: stages[0].status },
                  children: stages.slice(1).map((stage) => ({
                    text: {
                      name: String(stage.level_desc ?? ""),
                      title: String(stage.status ?? ""),
                      contact: String(stage.level_name ?? ""),
                    },
                    data: { approval_number: number, status: stage.status },
                  })),
                },
              ]
            : [],
        },
      };
    }
    if (
      query?.get("doc_type") !== "CONTRACT" ||
      query.get("doc_num") !== "C_1301"
    )
      return { chart: {}, nodeStructure: [] };
    return {
      chart: { rootOrientation: "WEST" },
      nodeStructure: {
        text: { name: "Approval Workflow", title: "Start" },
        children: [
          {
            text: {
              name: "Contract Approval",
              title: "Alex Morgan",
              contact: "Stage 1",
            },
            data: { approval_number: "C_1301", status: "Approved" },
            children: [
              {
                text: {
                  name: "Legal head approval",
                  title: "Alex Morgan",
                  contact: "Stage 2",
                },
                data: { approval_number: "C_1301", status: "Pending" },
              },
            ],
          },
        ],
      },
    };
  }
  if (op === "getApproval_setupGet_stage_users")
    return { items: USERS[headers.stage_id] ?? [] };
  if (op === "getApproval_groupApproval_group_m")
    return {
      items:
        headers.approver_type === "GROUP"
          ? [
              { approver_id: "83", approver_desc: "Department Approvers" },
              { approver_id: "84", approver_desc: "Research Office" },
            ]
          : [],
    };
  return {
    items:
      headers.approval_type === "OPPORTUNITIES-EOI"
        ? (HISTORY[headers.transaction_number] ?? [])
        : headers.approval_type === "CONTRACT" &&
            headers.transaction_number === "C_1301"
          ? CONTRACT_HISTORY
          : [],
  };
}
