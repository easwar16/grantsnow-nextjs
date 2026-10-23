import type { ApprovalRow } from "@/features/objects/types";
/** Display models of the shared approval workflow (legacy `approval-workflow` fragment); built on the server. */
export type ApprovalVerdict = "Approved" | "Rejected" | "Rework";
/** `post_approval` `action_done`: the route-level actions plus an approver's verdict. */
export type ApprovalAction = "Submitted" | "Withdrawn" | ApprovalVerdict;
export interface ApprovalStage {
  /** `stage_id`. */
  id: string;
  name: string;
  description: string;
  /** Sanitised review guidance (8343); null when none is configured. */
  helpText: string | null;
  role: string | null;
  actionType: string;
  required: string;
  status: string;
  /** Peer-review stages show no status badge and list reviewers, not approvers. */
  review: boolean;
  /** Sanitised remarks HTML; null when none. */
  remarks: string | null;
  pendingDays: number | null;
  /** The approvers link (every stage but the System one). */
  approvers: boolean;
  /** Delete: a manually added stage that has not been acted on, while the record is editable. */
  canDelete: boolean;
  /** Approve / Reject / Rework: the backend says this user is the stage's current approver. */
  canAct: boolean;
}
export interface StageUser {
  /** `user_name` (the approver's email), the row key and the remove / reassign identity. */
  id: string;
  name: string;
  status: string;
}
export interface StageUsers {
  users: StageUser[];
  /** "Automatic System Step": nothing on the stage may be changed by hand. */
  system: boolean;
  gates: { add: boolean; change: boolean; remove: boolean };
}
export interface Choice {
  value: string;
  label: string;
}
export interface PersonChoice extends Choice {
  unit: string;
}
export interface AddStageSetup {
  actionTypes: Choice[];
  groupTypes: Choice[];
  fields: {
    deadlineDays: boolean;
    remarks: boolean;
    helpText: boolean;
  };
  required: {
    position: boolean;
    name: boolean;
    description: boolean;
    actionType: boolean;
    count: boolean;
    deadlineDays: boolean;
    remarks: boolean;
    helpText: boolean;
  };
}
export type WorkflowTextKey =
  | "route"
  | "addStage"
  | "stageName"
  | "helpText"
  | "role"
  | "actionType"
  | "count"
  | "status"
  | "remarks"
  | "pendingSince"
  | "viewApprovers"
  | "viewReviewers"
  | "approve"
  | "reject"
  | "rework"
  | "delete"
  | "noData"
  | "generate"
  | "submit"
  | "withdraw"
  | "history"
  | "historyName"
  | "historyStatus"
  | "historyStage"
  | "historyComments"
  | "historyUpdated"
  | "submitTitle"
  | "withdrawTitle"
  | "actionTitle"
  | "comments"
  | "cancel"
  | "send"
  | "confirmTitle"
  | "confirmReject"
  | "deleteTitle"
  | "deleteMessage"
  | "deleteConfirm"
  | "approversTitle"
  | "addApprover"
  | "newApprover"
  | "changeApprover"
  | "save"
  | "removeApprover"
  | "userName"
  | "userEmail"
  | "userStatus"
  | "addStageTitle"
  | "position"
  | "name"
  | "description"
  | "groupType"
  | "group"
  | "deadlineDays"
  | "stageRemarks"
  | "stageHelp"
  | "select"
  | "addStageCancel"
  | "addStageSubmit"
  | "success"
  | "stageAdded";
export interface WorkflowView {
  texts: Record<WorkflowTextKey, string>;
  stages: ApprovalStage[];
  history: { rows: ApprovalRow[] } | { error: string };
  gates: {
    /** Generate Approval Route: no route yet on an editable record. */
    generate: boolean;
    submit: boolean;
    withdraw: boolean;
    addStage: boolean;
  };
}
