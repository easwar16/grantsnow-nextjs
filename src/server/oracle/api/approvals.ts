import "server-only";
import { z } from "zod";
import { read, write } from "../client";
import { figureOperations } from "./home";
import { TTL } from "../cache";

/**
 * A document's approval route (approval_setup): its stages and their users, the approval history, the approver
 * groups, and the route's writes. Every write may move the document's status, and so its rights: each drops the
 * record roles held for the session.
 */
const text = z.string().nullish();
const num = z.union([z.number(), z.string()]).nullish();
const stageRows = z.object({
  items: z.array(
    z.object({
      stage_id: z.coerce.number().int().positive(),
      approval_number: num,
      level_name: text,
      level_desc: text,
      help_text: text,
      approval_group: text,
      approval_group_name: text,
      approval_type: text,
      no_of_approval_req: num,
      status: text,
      remarks: text,
      pending_approval_days: z.number().nullish(),
      stage_type: text,
      approve_button_flag: text,
    }),
  ),
});
export type StageRow = z.infer<typeof stageRows>["items"][number];
type Doc = { docNum: string; docType: string };
/** The route's stages (approval_stages). */
export const stages = read<Doc, StageRow[]>({
  op: "getApproval_setupApproval_stages",
  query: (p) => ({ doc_num: p.docNum, doc_type: p.docType }),
  parse: (b) => stageRows.parse(b).items,
});
const userRows = z.object({
  items: z.array(z.object({ user_name: z.string(), name: text, status: text })),
});
export type StageUserRow = z.infer<typeof userRows>["items"][number];
/** One stage's approvers (get_stage_users). */
export const stageUsers = read<Doc & { stageId: number }, StageUserRow[]>({
  op: "getApproval_setupGet_stage_users",
  headers: (p) => ({
    p_approval_number: p.docNum,
    stage_id: p.stageId,
    doc_type: p.docType,
  }),
  parse: (b) => userRows.parse(b).items,
});
const historyRows = z.object({
  items: z.array(
    z.object({
      approval_history_id: num,
      full_name: text,
      status: text,
      stage_desc: text,
      user_comments: z.unknown().optional(),
      last_update_date: text,
    }),
  ),
});
export type HistoryRow = z.infer<typeof historyRows>["items"][number];
/** A document's approval history (getApprovalHistory), by its transaction number and approval type. */
export const history = read<
  { transaction: string; approvalType: string },
  HistoryRow[]
>({
  op: "getPre_awardGetApprovalHistory",
  headers: (p) => ({
    transaction_number: p.transaction,
    approval_type: p.approvalType,
  }),
  parse: (b) => historyRows.parse(b).items,
});
const groupRows = z.object({
  items: z.array(
    z.object({ approver_id: z.coerce.string(), approver_desc: text }),
  ),
});
/** The groups of one approver type (getApprovers). */
export const groups = read<
  { type: string },
  z.infer<typeof groupRows>["items"][number][]
>({
  op: "getApproval_groupApproval_group_m",
  ttl: TTL.config,
  headers: (p) => ({ approver_type: p.type }),
  parse: (b) => groupRows.parse(b).items,
});

// An approval action changes the record's status and roles, and what Home's queues and counts show.
const roles = [
  "getSecurityUser_roles",
  "getDynamicFormsGetRequestDetails",
  ...figureOperations,
] as const;
/** WRITES: submit, withdraw or a verdict (post_approval); `body` is built by the route rules. */
export const act = write<{ body: unknown }>({
  op: "postApproval_setupPost_approval",
  body: (p) => p.body,
  invalidates: roles,
});
/** WRITES: generates the route (generate_stages, a GET that inserts). */
export const generate = write<Doc & { actionBy: string }>({
  op: "getApproval_setupGenerate_stages",
  query: (p) => ({
    doc_num: p.docNum,
    doc_type: p.docType,
    action_by: p.actionBy,
  }),
  invalidates: roles,
});
/** WRITES: a new stage (add_stage); `body` is built by the route rules. */
export const addStage = write<{ docType: string; body: unknown }>({
  op: "postApproval_setupAdd_stage",
  identity: ["legal_id", "org_id"],
  body: (p) => p.body,
  query: (p) => ({ doc_type: p.docType }),
  invalidates: roles,
});
/** WRITES: deletes a stage. */
export const deleteStage = write<{ approvalNumber: string; stageId: number }>({
  op: "deleteApproval_setupApproval_stages",
  headers: (p) => ({
    approval_number: p.approvalNumber,
    approval_stage_id: p.stageId,
  }),
  invalidates: roles,
});
/** WRITES: adds an approver (by email) to a stage. */
export const addApprover = write<Doc & { stageId: number; email: string }>({
  op: "postApproval_setupApproval_stages_users",
  headers: (p) => ({ p_new_appr: p.email, p_stage_id: p.stageId }),
  query: (p) => ({ doc_type: p.docType, doc_num: p.docNum }),
  invalidates: roles,
});
/** WRITES: hands a pending approver's place to another person (reassign_stage). */
export const reassign = write<{
  stageId: number;
  current: string;
  email: string;
}>({
  op: "postApproval_setupReassign_stage",
  headers: (p) => ({
    p_current_appr: p.current,
    p_new_appr: p.email,
    p_stage_id: p.stageId,
  }),
  invalidates: roles,
});
/** WRITES: removes an approver from a stage. */
export const removeApprover = write<Doc & { stageId: number; user: string }>({
  op: "deleteApproval_setupApproval_stages_users",
  headers: (p) => ({ p_appr: p.user, p_stage_id: p.stageId }),
  query: (p) => ({ doc_num: p.docNum, doc_type: p.docType }),
  invalidates: roles,
});
