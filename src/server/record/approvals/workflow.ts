import "server-only";
import { z } from "zod";
import { approvals, lookups, people } from "@/server/oracle/api";
import type { StageRow } from "@/server/oracle/api/approvals";
import {
  resources,
  type Resources,
} from "@/server/platform/configuration/resources";
import { AppError } from "@/lib/errors";
import { mapApprovalGraph } from "./graph";
import type { UserContext } from "@/shared/auth/types";
import type { ApprovalRow } from "@/features/record/objects/types";
import type {
  ApprovalTreeNode,
  AddStageSetup,
  ApprovalStage,
  Choice,
  PersonChoice,
  StageUsers,
  WorkflowTextKey,
  WorkflowHistory,
  WorkflowView,
} from "@/features/record/approvals/types";
import { serverFunctions } from "@/server/functions";

/**
 * One host of the shared approval workflow (legacy `approval-workflow` fragment, KB GrantsNow-Approvals host
 * contract). The host passes what only it knows: the route's document, its status predicates and its record rights;
 * labels and RB gates resolve here from `bundle`.
 */
export interface ApprovalHost {
  token: string;
  user: UserContext;
  /** The verified username (legacy `$application.user.username`); none refuses every action that names an actor. */
  username: string | null;
  /** The route's document: `(doc_num, doc_type)`; history is read by `approvalType`. */
  docNum: string;
  docType: string;
  approvalType: string;
  bundle: string;
  /** The host's status predicates (legacy fragment params isEditable, isInApproval, showAddStageButton…). */
  state: {
    editable: boolean;
    inApproval: boolean;
    showAddStage: boolean;
    modifyApprovers: boolean;
    withdraw: boolean;
    hasParent: boolean;
    approveStages: boolean;
  };
  /** Record roles, fail closed; `route` covers generate, submit and withdraw. */
  rights: {
    route: boolean;
    addStage: boolean;
    deleteStage: boolean;
    addApprover: boolean;
    changeApprover: boolean;
    removeApprover: boolean;
  };
  /** The lookup listing the approval group types (legacy approvalGroupLookupCode). */
  groupLookup: string;
}

const text = z.string().nullish();
const lookupRows = z.object({
  items: z.array(
    z.object({
      lookup_type_code: text,
      lookup_code: z.string(),
      lookup_code_descr: text,
    }),
  ),
});
const personRows = z.object({
  items: z.array(
    z.object({
      person_id: z.coerce.number(),
      full_name: text,
      email_address: text,
      org_unit_name: text,
    }),
  ),
});

/** Statuses after which a stage can no longer be deleted (legacy btnDelete gate). */
const SETTLED = ["Approved", "Notified", "Rework", "Rejected"];
const SYSTEM_STEP = "Automatic System Step";
const empty = (v: string | null | undefined) =>
  v === null || v === undefined || v.trim() === "";
const show = (v: string | number | null | undefined) =>
  v === null || v === undefined || v === "" ? "—" : String(v);

const KEYS: Record<WorkflowTextKey, [string, string, string]> = {
  route: ["header-labels", "approval-route", "Approval Route"],
  addStage: ["button-labels", "approvals-add-stage", "Add Stage"],
  stageName: ["labels", "stage-name", "Stage Name"],
  helpText: ["button-labels", "stage-help-text", "View review guidance"],
  role: ["labels", "approval-approver-role", "Approver Role"],
  actionType: ["labels", "approval-action-type", "Action Type"],
  count: [
    "labels",
    "approval-number-of-action-required",
    "Number of Action Required:",
  ],
  status: ["labels", "status", "Status"],
  remarks: ["labels", "approval-remarks", "Remarks"],
  pendingSince: ["labels", "pending-since", "Pending Since"],
  viewApprovers: ["labels", "view-approvers", "View approvers"],
  viewReviewers: ["labels", "view-reviewers", "View reviewers"],
  approve: ["button-labels", "approval-approve", "Approve"],
  reject: ["button-labels", "approval-reject", "Reject"],
  rework: ["button-labels", "approval-rework", "Rework"],
  delete: ["button-labels", "approval-delete", "Delete"],
  noData: ["helper-texts", "approval-no-data", "No data to display."],
  generate: [
    "button-labels",
    "approval-generate-approval-route",
    "Generate Approval Route",
  ],
  submit: [
    "button-labels",
    "approval-submit-for-approval",
    "Submit for Approval",
  ],
  withdraw: ["button-labels", "approval-withdraw", "Withdraw"],
  history: ["header-labels", "approval-history", "Approval History"],
  listView: ["labels", "approval-list-view", "List View"],
  graphView: ["labels", "approval-graph-view", "Graph View"],
  tableView: ["labels", "approval-table-view", "Table View"],
  cardView: ["labels", "approval-card-view", "Card View"],
  historyName: ["table-headers", "approvals-full-name", "Full Name"],
  historyStatus: ["table-headers", "approval-status", "Status"],
  historyStage: ["table-headers", "approval-stage", "Stage"],
  historyComments: ["table-headers", "approval-user-comments", "User Comments"],
  commentTitle: ["dialog-titles", "comments", "Comments"],
  historyUpdated: [
    "table-headers",
    "approval-last-updated-date",
    "Last Updated Date",
  ],
  submitTitle: ["dialog-titles", "submit-proposal", "Submit for Approval"],
  withdrawTitle: ["dialog-titles", "withdrawn", "Withdraw"],
  actionTitle: [
    "dialog-titles",
    "approve-reject-rework-proposal",
    "Approval Action",
  ],
  comments: ["section-header-labels", "approval-comments", "Comments"],
  cancel: ["button-labels", "approval-comments-cancel", "Cancel"],
  send: ["button-labels", "approval-comments-submit", "Submit"],
  confirmTitle: ["dialog-titles", "approval-confirm", "Confirmation"],
  confirmReject: [
    "labels",
    "approval-confirm-reject",
    "Are you sure you want to Reject?",
  ],
  deleteTitle: ["dialog-titles", "approval-delete-warning", "Delete Stage"],
  deleteMessage: [
    "warning-messages",
    "approval-permanent-delete",
    "This will permanently delete the stage. Are you sure you want to proceed?",
  ],
  deleteConfirm: ["button-labels", "approval-confirm-delete", "Confirm Delete"],
  approversTitle: [
    "dialog-titles",
    "approval-approver-information",
    "Approver Information",
  ],
  addApprover: ["labels", "approval-add-approver", "Add Approver"],
  newApprover: ["labels", "approval-new-approver", "New Approver"],
  changeApprover: ["button-labels", "approval-new-approver", "Change Approver"],
  save: ["button-labels", "approval-approver-save", "Save"],
  removeApprover: [
    "button-labels",
    "approval-approver-delete",
    "Delete Approver",
  ],
  userName: ["table-headers", "approval-name", "Name"],
  userEmail: ["table-headers", "approval-email", "Email"],
  userStatus: ["table-headers", "approval-status", "Status"],
  addStageTitle: ["dialog-titles", "approval-add-stage", "Add Stage"],
  position: ["labels", "approval-position", "Position"],
  name: ["labels", "approval-stage-name", "Stage Name"],
  description: ["labels", "approval-description", "Description"],
  groupType: ["labels", "approval-group-type", "Approval Group Type"],
  group: ["labels", "approval-action-by", "Action By"],
  deadlineDays: ["labels", "approval-deadline-days", "Deadline Days"],
  stageRemarks: ["labels", "comments", "Comments"],
  stageHelp: ["labels", "help-text", "Help Text"],
  select: ["placeholders", "select", "Select"],
  addStageCancel: ["button-labels", "approval-add-stage-cancel", "Cancel"],
  addStageSubmit: ["button-labels", "approval-add-stage-submit", "Submit"],
  // Legacy toasts these as literals (submitApprovalActionChain, submitAddStageActionChain).
  success: ["success-msg", "approval-action", "Action Performed successfully."],
  stageAdded: [
    "success-msg",
    "approval-stage-added",
    "Stage Added Succesfully",
  ],
};
export function workflowTexts(rows: Resources, bundle: string) {
  return Object.fromEntries(
    Object.entries(KEYS).map(([k, [group, key, fallback]]) => [
      k,
      serverFunctions.resources.label(rows, bundle, group, key, fallback),
    ]),
  ) as Record<WorkflowTextKey, string>;
}
const visible = (
  rows: Resources,
  host: ApprovalHost,
  group: string,
  key: string,
) => serverFunctions.resources.resourceVisible(rows, host.bundle, group, key);

const doc = (host: ApprovalHost) => ({
  docNum: host.docNum,
  docType: host.docType,
});
const readStages = (host: ApprovalHost) => approvals.stages(doc(host));
const readUsers = (host: ApprovalHost, stageId: number) =>
  approvals.stageUsers({ ...doc(host), stageId });
/** The document's approval history (getApprovalHistory); `updated` stays raw, the browser shows it in the viewer's zone. */
export async function approvalHistoryRows(
  transaction: string,
  approvalType: string,
): Promise<ApprovalRow[]> {
  const rows = await approvals.history({ transaction, approvalType });
  return rows.map((r, i) => ({
    id: `${r.approval_history_id ?? ""}:${i}`,
    name: show(r.full_name),
    status: show(r.status),
    stage: show(r.stage_desc),
    comments:
      typeof r.user_comments === "string"
        ? serverFunctions.sanitize.plainText(r.user_comments)
        : "",
    commentsHtml:
      typeof r.user_comments === "string"
        ? serverFunctions.sanitize.sanitizeHtml(r.user_comments)
        : "",
    updated: r.last_update_date ?? "",
  }));
}

/** Route-level gates (legacy fragment footer and header), all fail closed. */
export function routeGates(
  stages: StageRow[],
  host: ApprovalHost,
  rows: Resources,
): WorkflowView["gates"] {
  const { state, rights } = host,
    actor = host.username !== null,
    route = stages.length > 0,
    noRework = !stages.some((s) => s.status === "Rework");
  return {
    generate: !route && state.editable && rights.route && actor,
    submit:
      route &&
      noRework &&
      state.editable &&
      !state.hasParent &&
      rights.route &&
      actor,
    withdraw:
      route &&
      state.withdraw &&
      visible(rows, host, "button-labels", "withdraw") &&
      rights.route &&
      actor,
    addStage:
      route &&
      state.showAddStage &&
      visible(rows, host, "button-labels", "approvals-add-stage") &&
      rights.addStage,
  };
}
function stageView(s: StageRow, host: ApprovalHost): ApprovalStage {
  const status = s.status ?? "";
  return {
    id: String(s.stage_id),
    name: s.level_name ?? "",
    description: s.level_desc ?? "",
    helpText: empty(s.help_text)
      ? null
      : serverFunctions.sanitize.sanitizeHtml(s.help_text!),
    role: empty(s.approval_group_name) ? null : s.approval_group_name!,
    actionType: s.approval_type ?? "",
    required: show(s.no_of_approval_req),
    status,
    review: s.approval_type === "PEERREVIEW",
    remarks: empty(s.remarks)
      ? null
      : serverFunctions.sanitize.sanitizeHtml(s.remarks!),
    pendingDays: s.pending_approval_days ?? null,
    approvers: s.approval_group !== "System",
    canDelete:
      s.stage_type !== "A" &&
      !SETTLED.includes(status) &&
      host.state.editable &&
      host.rights.deleteStage,
    canAct:
      s.approve_button_flag === "Y" &&
      host.state.approveStages &&
      host.username !== null,
  };
}
const viewsOf = (rows: Resources, host: ApprovalHost) => ({
  graph: serverFunctions.resources.resourceVisible(
    rows,
    host.bundle,
    "labels",
    "approval-graph-view",
  ),
  cards: serverFunctions.resources.resourceVisible(
    rows,
    host.bundle,
    "labels",
    "approval-card-view",
  ),
});
/** Stages and gates for the Workflow tab; the history table reads on its own (workflowHistory). */
export async function workflowView(host: ApprovalHost): Promise<WorkflowView> {
  const [rows, stages] = await Promise.all([resources(), readStages(host)]);
  return {
    texts: workflowTexts(rows, host.bundle),
    stages: stages.map((s) => stageView(s, host)),
    views: viewsOf(rows, host),
    gates: routeGates(stages, host, rows),
  };
}
/** The route as a tree, read when Graph View is opened (legacy loads it on the tab); only where the RB shows it. */
async function routeGraph(host: ApprovalHost): Promise<ApprovalTreeNode> {
  if (!viewsOf(await resources(), host).graph)
    throw new AppError("FORBIDDEN", "Graph View is not available.", 403);
  return mapApprovalGraph(await approvals.graph(doc(host)), host.docNum);
}

/** A stage of this document's route; a stage id the route does not hold is refused. */
async function stageOf(host: ApprovalHost, raw: unknown) {
  const id = z.coerce.number().int().positive().safeParse(raw);
  const stages = id.success ? await readStages(host) : [];
  const stage = stages.find((s) => s.stage_id === id.data);
  if (!stage)
    throw new AppError("BAD_REQUEST", "That stage is not on this route.", 400);
  return { stage, stages };
}
function userGates(
  host: ApprovalHost,
  stage: StageRow,
  stages: StageRow[],
  users: { user_name: string }[],
  system: boolean,
): StageUsers["gates"] {
  const { state, rights } = host,
    open = state.editable || state.inApproval,
    pending = stage.status === "Pending";
  return {
    add:
      state.modifyApprovers &&
      !stages.some((s) => s.status === "Rework") &&
      (pending || stage.status === "Notified") &&
      rights.addApprover &&
      !system,
    change: open && pending && rights.changeApprover && !system,
    remove: open && pending && users.length > 1 && rights.removeApprover,
  };
}
async function usersOf(host: ApprovalHost, stageId: unknown) {
  const { stage, stages } = await stageOf(host, stageId);
  const users = await readUsers(host, stage.stage_id);
  const system = users.some((u) => u.name === SYSTEM_STEP);
  return {
    stage,
    users,
    gates: userGates(host, stage, stages, users, system),
    system,
  };
}
/** The approvers dialog: one stage's users and what may change on it. */
export async function stageUsers(
  host: ApprovalHost,
  stageId: unknown,
): Promise<StageUsers> {
  const { users, gates, system } = await usersOf(host, stageId);
  return {
    users: users.map((u) => ({
      id: u.user_name,
      name: u.name ?? "",
      status: u.status ?? "",
    })),
    system,
    gates,
  };
}

async function choices(type: string) {
  return lookupRows
    .parse(await lookups.codes({ types: type }))
    .items.filter((r) => r.lookup_type_code === type)
    .map((r) => ({
      value: r.lookup_code,
      label: r.lookup_code_descr || r.lookup_code,
    }));
}
/** The person directory (legacy app-level getPreAwardGetPersonListAllADP); only people with an email can approve. */
async function directory() {
  return personRows
    .parse(await people.inOrg({}))
    .items.filter((p) => !empty(p.email_address));
}
export async function approverPeople(): Promise<PersonChoice[]> {
  return (await directory()).map((p) => ({
    value: String(p.person_id),
    label: p.full_name ?? "",
    unit: p.org_unit_name ?? "",
  }));
}
/** The groups of one approval group type (getApprovers `approver_type`); the type must be a listed one. */
export async function approverGroups(
  host: ApprovalHost,
  type: unknown,
): Promise<Choice[]> {
  const types = await choices(host.groupLookup);
  if (typeof type !== "string" || !types.some((t) => t.value === type))
    throw new AppError("BAD_REQUEST", "Unknown approval group type.", 400);
  return (await approvals.groups({ type })).map((g) => ({
    value: g.approver_id,
    label: g.approver_desc ?? g.approver_id,
  }));
}
const FIELD = {
  position: "approval-position",
  name: "approval-stage-name",
  description: "approval-description",
  actionType: "approval-action-type",
  count: "approval-number-of-action-required",
  deadlineDays: "approval-deadline-days",
  remarks: "comments",
  helpText: "help-text",
} as const;
function stageFields(rows: Resources, host: ApprovalHost) {
  const req = (key: string) =>
    serverFunctions.resources.resourceRequired(
      rows,
      host.bundle,
      "labels",
      key,
      false,
    );
  return {
    fields: {
      deadlineDays: visible(rows, host, "labels", FIELD.deadlineDays),
      remarks: visible(rows, host, "labels", FIELD.remarks),
      helpText: visible(rows, host, "labels", FIELD.helpText),
    },
    required: Object.fromEntries(
      Object.entries(FIELD).map(([k, key]) => [k, req(key)]),
    ) as AddStageSetup["required"],
  };
}
/** The Add Stage dialog's choices and RB field gates; people come from `approverPeople`, shared with the approvers dialog. */
export async function addStageSetup(
  host: ApprovalHost,
): Promise<AddStageSetup> {
  const [rows, actionTypes, groupTypes] = await Promise.all([
    resources(),
    choices("APPROVAL_TYPE"),
    choices(host.groupLookup),
  ]);
  return { actionTypes, groupTypes, ...stageFields(rows, host) };
}

const id = z.string().regex(/^[1-9]\d{0,14}$/);
const words = (max: number) => z.string().trim().max(max);
const actInput = z
  .object({
    op: z.literal("act"),
    action: z.enum([
      "Submitted",
      "Withdrawn",
      "Approved",
      "Rejected",
      "Rework",
    ]),
    comments: words(4000).optional(),
    stageId: id.optional(),
  })
  .strict();
const stageInput = z
  .object({ op: z.literal("delete-stage"), stageId: id })
  .strict();
const addApproverInput = z
  .object({ op: z.literal("add-approver"), stageId: id, personId: id })
  .strict();
const changeApproverInput = z
  .object({
    op: z.literal("change-approver"),
    stageId: id,
    current: z.string().min(1).max(254),
    personId: id,
  })
  .strict();
const removeApproverInput = z
  .object({
    op: z.literal("remove-approver"),
    stageId: id,
    user: z.string().min(1).max(254),
  })
  .strict();
const count = z.number().int().min(0).max(999).nullable();
const addStageInput = z
  .object({
    op: z.literal("add-stage"),
    position: id.nullable(),
    name: words(200),
    description: words(500),
    actionType: z.string().max(60).nullable(),
    groupType: z.string().min(1).max(60),
    group: z.string().min(1).max(60),
    count,
    deadlineDays: count,
    remarks: words(4000).nullable(),
    helpText: z.string().max(20000).nullable(),
  })
  .strict();
export const workflowInput = z.discriminatedUnion("op", [
  actInput,
  z.object({ op: z.literal("generate") }).strict(),
  stageInput,
  addApproverInput,
  changeApproverInput,
  removeApproverInput,
  addStageInput,
]);
const refuse = (message: string) => new AppError("FORBIDDEN", message, 403);
const invalid = (message: string) => new AppError("BAD_REQUEST", message, 400);
function actor(host: ApprovalHost) {
  if (host.username === null)
    throw refuse("Sign in again to act on this approval route.");
  return host.username;
}
async function personEmail(host: ApprovalHost, personId: string) {
  const email = (await directory()).find(
    (p) => String(p.person_id) === personId,
  )?.email_address;
  if (!email) throw invalid("Choose a person from the list.");
  return email;
}

/** WRITES: submit, withdraw or a verdict (post_approval); the actor is the session's user, never the browser's. */
async function act(host: ApprovalHost, input: z.infer<typeof actInput>) {
  const by = actor(host);
  const stages = await readStages(host);
  const rows = await resources();
  let stageId: number | undefined;
  if (input.action === "Submitted" || input.action === "Withdrawn") {
    const gates = routeGates(stages, host, rows);
    if (!(input.action === "Submitted" ? gates.submit : gates.withdraw))
      throw refuse("This action is not available on this route.");
  } else {
    const stage = stages.find((s) => String(s.stage_id) === input.stageId);
    if (!stage || !stageView(stage, host).canAct)
      throw refuse("You are not the current approver of this stage.");
    stageId = stage.stage_id;
  }
  const comments = input.comments ?? "";
  if (
    (input.action === "Rejected" || input.action === "Rework") &&
    comments === ""
  )
    throw invalid("Comments are required to reject or send back.");
  return approvals.act({
    body: {
      action_by: by,
      action_done: input.action,
      ...(comments === "" ? {} : { comments }),
      criteria_type: "Amount",
      doc_num: host.docNum,
      doc_type: host.docType,
      ...(stageId === undefined ? {} : { stage_id: stageId }),
    },
  });
}
async function generate(host: ApprovalHost) {
  const by = actor(host);
  const [stages, rows] = await Promise.all([readStages(host), resources()]);
  if (!routeGates(stages, host, rows).generate)
    throw refuse("An approval route cannot be generated here.");
  return approvals.generate({ ...doc(host), actionBy: by });
}
async function addStage(
  host: ApprovalHost,
  input: z.infer<typeof addStageInput>,
) {
  const [stages, rows, actionTypes, groupTypes] = await Promise.all([
    readStages(host),
    resources(),
    choices("APPROVAL_TYPE"),
    choices(host.groupLookup),
  ]);
  if (!routeGates(stages, host, rows).addStage)
    throw refuse("You cannot add a stage to this route.");
  const { fields, required } = stageFields(rows, host);
  // Hidden fields are sent empty, as legacy's unrendered inputs.
  const remarks = fields.remarks ? input.remarks : null,
    helpText = fields.helpText ? input.helpText : null,
    deadline = fields.deadlineDays ? input.deadlineDays : null;
  const missing =
    (required.position && input.position === null) ||
    (required.name && input.name === "") ||
    (required.description && input.description === "") ||
    (required.actionType && input.actionType === null) ||
    (required.count && input.count === null) ||
    (fields.deadlineDays && required.deadlineDays && deadline === null) ||
    (fields.remarks && required.remarks && empty(remarks)) ||
    (fields.helpText && required.helpText && empty(helpText));
  if (missing) throw invalid("Fill in every required field.");
  if (
    input.position !== null &&
    !stages.some((s) => String(s.stage_id) === input.position)
  )
    throw invalid("That position is not on this route.");
  if (
    input.actionType !== null &&
    !actionTypes.some((t) => t.value === input.actionType)
  )
    throw invalid("Unknown action type.");
  if (!groupTypes.some((t) => t.value === input.groupType))
    throw invalid("Unknown approval group type.");
  const individual = input.groupType === "INDIVIDUAL";
  const known = individual
    ? (await directory()).some((p) => String(p.person_id) === input.group)
    : (await approverGroups(host, input.groupType)).some(
        (g) => g.value === input.group,
      );
  if (!known) throw invalid("Choose who acts on this stage from the list.");
  const { user } = host;
  return approvals.addStage({
    docType: host.docType,
    body: {
      approval_group: input.group,
      approval_group_type: input.groupType,
      approval_type: input.actionType ?? undefined,
      doc_num: host.docNum,
      lead_stage_id:
        input.position === null ? undefined : Number(input.position),
      legal_id: user.legalId === undefined ? undefined : Number(user.legalId),
      // An individual stage needs that one person (legacy fixes the count at 1).
      no_of_approval_req: individual ? 1 : (input.count ?? undefined),
      remarks: empty(remarks) ? undefined : remarks,
      stage_desc: input.description || undefined,
      stage_name: input.name || undefined,
      org_id: Number(user.organizationId),
      user_id: Number(user.personId),
      deadline_days: deadline ?? undefined,
      help_text: empty(helpText) ? undefined : helpText,
    },
  });
}
async function deleteStage(host: ApprovalHost, stageId: string) {
  const { stage } = await stageOf(host, stageId);
  if (!stageView(stage, host).canDelete || stage.approval_number == null)
    throw refuse("This stage cannot be deleted.");
  return approvals.deleteStage({
    approvalNumber: String(stage.approval_number),
    stageId: stage.stage_id,
  });
}
async function addApprover(
  host: ApprovalHost,
  input: z.infer<typeof addApproverInput>,
) {
  const { stage, users, gates } = await usersOf(host, input.stageId);
  if (!gates.add) throw refuse("You cannot add an approver to this stage.");
  const email = await personEmail(host, input.personId);
  if (users.some((u) => u.user_name === email))
    throw invalid("The approver already exists");
  return approvals.addApprover({
    ...doc(host),
    stageId: stage.stage_id,
    email,
  });
}
async function changeApprover(
  host: ApprovalHost,
  input: z.infer<typeof changeApproverInput>,
) {
  const { stage, users, gates } = await usersOf(host, input.stageId);
  const current = users.find((u) => u.user_name === input.current);
  if (!gates.change || current?.status !== "Pending")
    throw refuse("You cannot change this approver.");
  const email = await personEmail(host, input.personId);
  if (users.some((u) => u.user_name === email))
    throw invalid("The approver already exists");
  return approvals.reassign({
    stageId: stage.stage_id,
    current: current.user_name,
    email,
  });
}
async function removeApprover(
  host: ApprovalHost,
  input: z.infer<typeof removeApproverInput>,
) {
  const { stage, users, gates } = await usersOf(host, input.stageId);
  if (!gates.remove || !users.some((u) => u.user_name === input.user))
    throw refuse("You cannot remove this approver.");
  return approvals.removeApprover({
    ...doc(host),
    stageId: stage.stage_id,
    user: input.user,
  });
}
/**
 * WRITES: one change to the route, checked against a fresh read of it. Each write drops the record's held roles,
 * since its status (and so its rights) may have moved; the caller re-reads the record.
 */
export async function workflowWrite(host: ApprovalHost, raw: unknown) {
  const parsed = workflowInput.safeParse(raw);
  if (!parsed.success) throw invalid("Invalid workflow request.");
  const input = parsed.data;
  switch (input.op) {
    case "act":
      return act(host, input);
    case "generate":
      return generate(host);
    case "add-stage":
      return addStage(host, input);
    case "delete-stage":
      return deleteStage(host, input.stageId);
    case "add-approver":
      return addApprover(host, input);
    case "change-approver":
      return changeApprover(host, input);
    case "remove-approver":
      return removeApprover(host, input);
  }
}
/** The route's history, read beside the route so neither waits for the other; a failure degrades only its table. */
async function workflowHistory(host: ApprovalHost): Promise<WorkflowHistory> {
  try {
    return { rows: await approvalHistoryRows(host.docNum, host.approvalType) };
  } catch (e) {
    if (e instanceof AppError && e.status === 401) throw e;
    return { error: "Approval history could not be loaded." };
  }
}
/** The dialogs' reads: a stage's approvers, the Add Stage setup, the person directory or one type's groups. */
export async function workflowRead(
  host: ApprovalHost,
  params: URLSearchParams,
) {
  switch (params.get("view")) {
    case "users":
      return stageUsers(host, params.get("stage"));
    case "setup":
      return addStageSetup(host);
    case "people":
      return approverPeople();
    case "groups":
      return approverGroups(host, params.get("type"));
    case "graph":
      return routeGraph(host);
    case "history":
      return workflowHistory(host);
    default:
      return workflowView(host);
  }
}
