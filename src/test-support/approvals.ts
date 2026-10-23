import "server-only";
import { fixtureMode } from "@/server/configuration/environment";
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
          : [],
    };
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
        : [],
  };
}
