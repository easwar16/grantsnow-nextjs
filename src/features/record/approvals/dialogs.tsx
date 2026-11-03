"use client";
import { useState } from "react";
import { State } from "@/components/feedback/state";
import { Skeleton } from "@/components/feedback/skeleton";
import { DataTable } from "@/components/ui/data-table";
import { InsideField } from "@/components/ui/inside-field";
import { RichText } from "@/components/ui/rich-text";
import { Select } from "@/components/ui/select";
import { ActionDialog } from "@/components/dialog/action-dialog";
import { approvals, useApi } from "@/lib/api";
import type { useInFlight } from "@/lib/hooks/use-in-flight";
import type { Texts, Write } from "./approval-workflow";
import type { ApprovalAction, ApprovalStage } from "./types";
import styles from "./approval-workflow.module.css";
import { functions } from "@/lib/functions";

/** Legacy #submitPopUp: comments for an action; a rejection or rework must say why. */
export function CommentsDialog({
  id,
  texts,
  action,
  busy,
  onClose,
  onSend,
}: {
  id: string;
  texts: Texts;
  action: ApprovalAction;
  busy: boolean;
  onClose: () => void;
  onSend: (comments: string) => void;
}) {
  const [comments, setComments] = useState(""),
    [tried, setTried] = useState(false);
  const required = action === "Rejected" || action === "Rework";
  const missing = required && comments.trim() === "";
  const title =
    action === "Submitted"
      ? texts.submitTitle
      : action === "Withdrawn"
        ? texts.withdrawTitle
        : texts.actionTitle;
  return (
    <ActionDialog
      id={id}
      title={title}
      width="50vw" /* legacy submitPopUp oj-md-width-1/2 */
      busy={busy}
      closeLabel={texts.cancel}
      onClose={onClose}
    >
      <InsideField
        htmlFor={`${id}-text`}
        label={texts.comments}
        filled
        multiline
        required={required}
      >
        <textarea
          id={`${id}-text`}
          rows={4}
          maxLength={4000}
          value={comments}
          disabled={busy}
          aria-invalid={(tried && missing) || undefined}
          onChange={(e) => setComments(e.target.value)}
        />
      </InsideField>
      <div className={styles.foot}>
        <button
          type="button"
          id={`${id}-cancel`}
          className="gn-btn gn-btn--outlined"
          disabled={busy}
          onClick={onClose}
        >
          {texts.cancel}
        </button>
        <button
          type="button"
          id={`${id}-send`}
          className="gn-btn gn-btn--primary"
          disabled={busy}
          onClick={() => {
            setTried(true);
            if (!missing) onSend(comments.trim());
          }}
        >
          {texts.send}
        </button>
      </div>
    </ActionDialog>
  );
}

/** Legacy #dialogStageUsers: a stage's approvers, with add, change and remove behind the stage's gates. */
export function ApproversDialog({
  id,
  api,
  stage,
  texts,
  write,
  isActive,
  onClose,
}: {
  id: string;
  api: string;
  stage: ApprovalStage;
  texts: Texts;
  write: Write;
  isActive: ReturnType<typeof useInFlight>["isActive"];
  onClose: () => void;
}) {
  const users = useApi(approvals.stageUsers, { api, stage: stage.id });
  const gates = users.data?.gates;
  const people = useApi(
    approvals.people,
    gates?.add || gates?.change ? api : null,
  );
  const [editing, setEditing] = useState<string | null>(null),
    [replacement, setReplacement] = useState("");
  const options = (people.data ?? []).map((p) => ({
    value: p.value,
    label: p.unit ? `${p.label} (${p.unit})` : p.label,
  }));
  const busy = isActive("approvers");
  return (
    <ActionDialog
      id={id}
      title={texts.approversTitle}
      width="50vw" /* legacy dialogStageUsers oj-md-width-1/2 */
      busy={busy}
      closeLabel={texts.cancel}
      onClose={onClose}
    >
      {gates?.add && (
        <div className={styles.addApprover}>
          <InsideField
            htmlFor={`${id}-add-trigger`}
            label={texts.addApprover}
            filled={false}
          >
            <Select
              id={`${id}-add`}
              label={texts.addApprover}
              options={options}
              value=""
              disabled={busy || people.data === undefined}
              onChange={(personId) => {
                if (personId)
                  void write(
                    "approvers",
                    { op: "add-approver", stageId: stage.id, personId },
                    "backend",
                  );
              }}
            />
          </InsideField>
        </div>
      )}
      {users.error ? (
        <State
          id={`${id}-error`}
          title={users.error.message}
          action={users.error.action}
          code={users.error.code}
          retry={users.retry}
        />
      ) : users.data === undefined ? (
        <Skeleton kind="lines" count={3} label="Loading approvers" />
      ) : users.data.users.length === 0 ? (
        <State id={`${id}-empty`} title={texts.noData} />
      ) : (
        <div className={`gn-table-scroll ${styles.tableWrap}`}>
          <DataTable
            id={`${id}-table`}
            rowIds={`${id}-user`}
            columns={[
              {
                id: "name",
                header: texts.userName,
                cell: (user) =>
                  editing === user.id ? (
                    <InsideField
                      htmlFor={`${id}-user-${functions.ids.idPart(user.id)}-new-trigger`}
                      label={texts.newApprover}
                      filled={replacement !== ""}
                    >
                      <Select
                        id={`${id}-user-${functions.ids.idPart(user.id)}-new`}
                        label={texts.newApprover}
                        options={options}
                        value={replacement}
                        disabled={busy || people.data === undefined}
                        onChange={setReplacement}
                      />
                    </InsideField>
                  ) : (
                    user.name
                  ),
              },
              { id: "email", header: texts.userEmail, cell: (user) => user.id },
              {
                id: "status",
                header: texts.userStatus,
                cell: (user) => user.status,
              },
            ]}
            rows={users.data.users}
            rowKey={(user) => user.id}
            actions={[
              {
                id: "save",
                icon: "save",
                size: 14,
                className: "gn-btn gn-btn--icon",
                label: () => texts.save,
                hidden: (user) =>
                  !gates?.change ||
                  user.status !== "Pending" ||
                  editing !== user.id,
                disabled: () => busy || replacement === "",
                onClick: async (user) => {
                  if (
                    await write("approvers", {
                      op: "change-approver",
                      stageId: stage.id,
                      current: user.id,
                      personId: replacement,
                    })
                  )
                    setEditing(null);
                },
              },
              {
                id: "change",
                icon: "pen",
                size: 14,
                className: "gn-btn gn-btn--icon",
                label: () => texts.changeApprover,
                hidden: (user) =>
                  !gates?.change ||
                  user.status !== "Pending" ||
                  editing === user.id,
                disabled: () => busy,
                onClick: (user) => {
                  setReplacement("");
                  setEditing(user.id);
                },
              },
              {
                id: "remove",
                icon: "close",
                size: 14,
                className: "gn-btn gn-btn--icon",
                label: () => texts.removeApprover,
                hidden: (user) => !gates?.remove || editing === user.id,
                disabled: () => busy,
                onClick: (user) =>
                  void write(
                    "approvers",
                    { op: "remove-approver", stageId: stage.id, user: user.id },
                    "SUCCESS",
                  ),
              },
            ]}
            actionsClassName={styles.rowActions}
          />
        </div>
      )}
    </ActionDialog>
  );
}

export interface StageDraft {
  position: string | null;
  name: string;
  description: string;
  actionType: string | null;
  groupType: string;
  group: string;
  count: number | null;
  deadlineDays: number | null;
  remarks: string | null;
  helpText: string | null;
}
const blank: StageDraft = {
  position: null,
  name: "",
  description: "",
  actionType: null,
  groupType: "",
  group: "",
  count: null,
  deadlineDays: null,
  remarks: null,
  helpText: null,
};
const whole = (v: string) =>
  v.trim() === "" ? null : Math.max(0, Math.trunc(Number(v)));

/** Legacy #dialogAddStage: a new stage after a chosen position, acted on by a group or one person. */
export function AddStageDialog({
  id,
  api,
  stages,
  texts,
  busy,
  onClose,
  onSubmit,
}: {
  id: string;
  api: string;
  stages: ApprovalStage[];
  texts: Texts;
  busy: boolean;
  onClose: () => void;
  onSubmit: (draft: StageDraft) => void;
}) {
  const setup = useApi(approvals.setup, api);
  const [draft, setDraft] = useState(blank),
    [tried, setTried] = useState(false);
  const individual = draft.groupType === "INDIVIDUAL";
  const people = useApi(approvals.people, individual ? api : null);
  const groups = useApi(
    approvals.groups,
    draft.groupType && !individual ? { api, type: draft.groupType } : null,
  );
  const set = (patch: Partial<StageDraft>) =>
    setDraft((d) => ({ ...d, ...patch }));
  const s = setup.data;
  const required = s?.required;
  const missing =
    !s ||
    draft.groupType === "" ||
    draft.group === "" ||
    (required!.position && draft.position === null) ||
    (required!.name && draft.name.trim() === "") ||
    (required!.description && draft.description.trim() === "") ||
    (required!.actionType && draft.actionType === null) ||
    (required!.count && !individual && draft.count === null) ||
    (s.fields.deadlineDays &&
      required!.deadlineDays &&
      draft.deadlineDays === null) ||
    (s.fields.remarks &&
      required!.remarks &&
      (draft.remarks ?? "").trim() === "") ||
    (s.fields.helpText &&
      required!.helpText &&
      (draft.helpText ?? "").trim() === "");
  const bad = (empty: boolean) => (tried && empty) || undefined;
  const groupOptions = individual
    ? (people.data ?? []).map((p) => ({ value: p.value, label: p.label }))
    : (groups.data ?? []);
  return (
    <ActionDialog
      id={id}
      title={texts.addStageTitle}
      width="50vw" /* legacy dialogAddStage oj-md-width-1/2 */
      busy={busy}
      closeLabel={texts.addStageCancel}
      onClose={onClose}
    >
      {setup.error ? (
        <State
          id={`${id}-error`}
          title={setup.error.message}
          action={setup.error.action}
          code={setup.error.code}
          retry={setup.retry}
        />
      ) : !s ? (
        <Skeleton kind="lines" count={4} label="Loading stage options" />
      ) : (
        <div id={`${id}-form`} className={styles.form}>
          <InsideField
            htmlFor={`${id}-position-trigger`}
            label={texts.position}
            filled={draft.position !== null}
            required={s.required.position}
          >
            <Select
              id={`${id}-position`}
              label={texts.position}
              options={stages.map((st) => ({ value: st.id, label: st.name }))}
              value={draft.position ?? ""}
              disabled={busy}
              invalid={bad(s.required.position && draft.position === null)}
              onChange={(v) => set({ position: v || null })}
            />
          </InsideField>
          <InsideField
            htmlFor={`${id}-name`}
            label={texts.name}
            filled={draft.name !== ""}
            required={s.required.name}
          >
            <input
              id={`${id}-name`}
              maxLength={200}
              value={draft.name}
              disabled={busy}
              aria-invalid={bad(s.required.name && draft.name.trim() === "")}
              onChange={(e) => set({ name: e.target.value })}
            />
          </InsideField>
          <InsideField
            htmlFor={`${id}-description`}
            label={texts.description}
            filled={draft.description !== ""}
            required={s.required.description}
          >
            <input
              id={`${id}-description`}
              maxLength={500}
              value={draft.description}
              disabled={busy}
              aria-invalid={bad(
                s.required.description && draft.description.trim() === "",
              )}
              onChange={(e) => set({ description: e.target.value })}
            />
          </InsideField>
          <InsideField
            htmlFor={`${id}-action-type-trigger`}
            label={texts.actionType}
            filled={draft.actionType !== null}
            required={s.required.actionType}
          >
            <Select
              id={`${id}-action-type`}
              label={texts.actionType}
              options={s.actionTypes}
              value={draft.actionType ?? ""}
              disabled={busy}
              invalid={bad(s.required.actionType && draft.actionType === null)}
              onChange={(v) => set({ actionType: v || null })}
            />
          </InsideField>
          <InsideField
            htmlFor={`${id}-group-type-trigger`}
            label={texts.groupType}
            filled={draft.groupType !== ""}
            required
          >
            <Select
              id={`${id}-group-type`}
              label={texts.groupType}
              options={s.groupTypes}
              value={draft.groupType}
              disabled={busy}
              invalid={bad(draft.groupType === "")}
              // Legacy ApprovalGroupTypeValueChangeChain: a new type clears the group; one person needs one action.
              onChange={(v) =>
                set({
                  groupType: v,
                  group: "",
                  count: v === "INDIVIDUAL" ? 1 : null,
                })
              }
            />
          </InsideField>
          <InsideField
            htmlFor={`${id}-group-trigger`}
            label={texts.group}
            filled={draft.group !== ""}
            required
          >
            <Select
              id={`${id}-group`}
              label={texts.group}
              options={groupOptions}
              value={draft.group}
              disabled={busy || draft.groupType === ""}
              invalid={bad(draft.group === "")}
              onChange={(v) => set({ group: v })}
            />
          </InsideField>
          <InsideField
            htmlFor={`${id}-count`}
            label={texts.count}
            filled={draft.count !== null}
            required={s.required.count}
          >
            <input
              id={`${id}-count`}
              type="number"
              min={0}
              step={1}
              value={draft.count ?? ""}
              readOnly={individual}
              disabled={busy}
              aria-invalid={bad(
                s.required.count && !individual && draft.count === null,
              )}
              onChange={(e) => set({ count: whole(e.target.value) })}
            />
          </InsideField>
          {s.fields.deadlineDays && (
            <InsideField
              htmlFor={`${id}-deadline`}
              label={texts.deadlineDays}
              filled={draft.deadlineDays !== null}
              required={s.required.deadlineDays}
            >
              <input
                id={`${id}-deadline`}
                type="number"
                min={0}
                step={1}
                value={draft.deadlineDays ?? ""}
                disabled={busy}
                aria-invalid={bad(
                  s.required.deadlineDays && draft.deadlineDays === null,
                )}
                onChange={(e) => set({ deadlineDays: whole(e.target.value) })}
              />
            </InsideField>
          )}
          {s.fields.remarks && (
            <div className={styles.wide}>
              <InsideField
                htmlFor={`${id}-remarks`}
                label={texts.stageRemarks}
                filled
                multiline
                required={s.required.remarks}
              >
                <textarea
                  id={`${id}-remarks`}
                  rows={3}
                  maxLength={4000}
                  value={draft.remarks ?? ""}
                  disabled={busy}
                  aria-invalid={bad(
                    s.required.remarks && (draft.remarks ?? "").trim() === "",
                  )}
                  onChange={(e) => set({ remarks: e.target.value })}
                />
              </InsideField>
            </div>
          )}
          {s.fields.helpText && (
            <div className={styles.wide}>
              <span className={styles.fieldLabel}>{texts.stageHelp}</span>
              <RichText
                id={`${id}-help-text`}
                label={texts.stageHelp}
                value={draft.helpText}
                disabled={busy}
                invalid={
                  tried &&
                  s.required.helpText &&
                  (draft.helpText ?? "").trim() === ""
                }
                onChange={(html) => set({ helpText: html })}
              />
            </div>
          )}
        </div>
      )}
      <div className={styles.foot}>
        <button
          type="button"
          id={`${id}-cancel`}
          className="gn-btn gn-btn--outlined"
          disabled={busy}
          onClick={onClose}
        >
          {texts.addStageCancel}
        </button>
        <button
          type="button"
          id={`${id}-submit`}
          className="gn-btn gn-btn--primary"
          disabled={busy || !s}
          onClick={() => {
            setTried(true);
            if (!missing)
              onSubmit({
                ...draft,
                name: draft.name.trim(),
                description: draft.description.trim(),
                remarks: s!.fields.remarks ? draft.remarks : null,
                helpText: s!.fields.helpText ? draft.helpText : null,
                deadlineDays: s!.fields.deadlineDays
                  ? draft.deadlineDays
                  : null,
              });
          }}
        >
          {texts.addStageSubmit}
        </button>
      </div>
    </ActionDialog>
  );
}
