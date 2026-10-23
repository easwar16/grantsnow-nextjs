"use client";
import { useEffect, useEffectEvent, useMemo, useState } from "react";
import { InsideField } from "@/components/ui/inside-field";
import { MultiSelect } from "@/components/ui/multi-select";
import { Select } from "@/components/ui/select";
import { Skeleton } from "@/components/feedback/skeleton";
import { useToast } from "@/components/feedback/toast";
import { useInFlight } from "@/lib/hooks/use-in-flight";
import { ActionDialog } from "../../../../../components/dialog/action-dialog";
import { opportunities } from "@/lib/api";
import {
  useActionFailure,
  type ActionError,
} from "../../../../../components/dialog/action-failure";
import styles from "../../../../../components/dialog/dialog.module.css";
type SendTo = "ROLE" | "GROUP" | "INDIVIDUAL";
type Option = { value: string; label: string; detail?: string };
type Texts = Record<
  | "title"
  | "sendTo"
  | "sendToValue"
  | "fullName"
  | "comment"
  | "commentHelp"
  | "share"
  | "cancel"
  | "sendToRequired"
  | "sendToValueRequired"
  | "fullNameRequired"
  | "tooLong"
  | "truncated",
  string
>;
export type ShareSetup = { texts: Texts; maxLength: number };
// Hard-coded in the original page model (sendToTypesArray).
const SEND_TO: { code: SendTo; label: string }[] = [
  { code: "ROLE", label: "Role" },
  { code: "GROUP", label: "Group" },
  { code: "INDIVIDUAL", label: "Individual" },
];
// gn-select drew 200 matches at a time; a search narrows the rest.
const SHOWN = 200;
/** dialogShareButtonActionChain's checks, in its order, with its messages. */
export function shareProblem(
  texts: Pick<
    Texts,
    "sendToRequired" | "sendToValueRequired" | "fullNameRequired" | "tooLong"
  >,
  v: { sendTo: string; value: string; people: string[]; comment: string },
  maxLength: number,
) {
  if (!v.sendTo) return texts.sendToRequired;
  if (v.sendTo !== "INDIVIDUAL" && !v.value) return texts.sendToValueRequired;
  if (v.sendTo === "INDIVIDUAL" && v.people.length === 0)
    return texts.fullNameRequired;
  if (v.comment.trim().length > maxLength) return texts.tooLong;
  return null;
}
/** Starts the share setup read before the dialog opens (hover or focus on Share). */
export const warmShare = () =>
  opportunities.warm(opportunities.shareSetup, undefined);
/** The one 8516 share dialog for the finder and Home: to a role, a group or chosen people, with an optional comment. */
export function ShareDialog({
  id,
  opportunityId,
  onClose,
}: {
  id: string;
  opportunityId: string;
  /** The opportunity's title; live's dialog shows none, so it is kept only for callers' symmetry. */
  heading: string;
  onClose: () => void;
}) {
  const [setup, setSetup] = useState<ShareSetup>(),
    [sendTo, setSendTo] = useState<SendTo | "">(""),
    [values, setValues] = useState<Record<string, Option[] | "failed">>({}),
    [value, setValue] = useState(""),
    [people, setPeople] = useState<string[]>([]),
    [comment, setComment] = useState(""),
    { run, isActive } = useInFlight(),
    toast = useToast(),
    fail = useActionFailure(),
    saving = isActive("share");
  const setupFailed = useEffectEvent((error: ActionError) => {
    toast.error(error);
    onClose();
  });
  useEffect(() => {
    let live = true;
    opportunities.take(opportunities.shareSetup, undefined).then((r) => {
      if (!live) return;
      if (r.ok) setSetup(r.data);
      else setupFailed(r.error);
    });
    return () => {
      live = false;
    };
  }, []);
  useEffect(() => {
    if (!sendTo || values[sendTo]) return;
    let live = true;
    opportunities
      .take(opportunities.shareValues, { type: sendTo })
      .then((r) => {
        if (!live) return;
        // A failed list degrades to empty, as the original's toast.degrade.
        if (!r.ok) toast.error(r.error);
        setValues((all) => ({ ...all, [sendTo]: r.ok ? r.data : "failed" }));
      });
    return () => {
      live = false;
    };
  }, [sendTo, values, toast]);
  const list = sendTo ? values[sendTo] : undefined;
  const options = useMemo(() => (Array.isArray(list) ? list : []), [list]);
  if (!setup)
    return (
      <ActionDialog id={id} title="" width={600} onClose={onClose}>
        <Skeleton kind="lines" count={4} label="Loading share options" />
      </ActionDialog>
    );
  const { texts, maxLength } = setup;
  const submit = () => {
    const problem = shareProblem(
      texts,
      { sendTo, value, people, comment },
      maxLength,
    );
    if (problem) return toast.show("error", problem);
    run(async () => {
      const result = await opportunities.share({
        opportunityId: Number(opportunityId),
        sendTo,
        ...(sendTo === "INDIVIDUAL"
          ? { personIds: people.map(Number) }
          : { sendToValue: value }),
        comment,
      });
      if (!result.ok) return fail(result.error);
      toast.show("success", "Done");
      onClose();
    }, "share");
  };
  return (
    // Live: no subtitle, 600px, every field a Redwood inside-label box.
    <ActionDialog
      id={id}
      title={texts.title}
      width={600}
      busy={saving}
      onClose={onClose}
    >
      <div id={`${id}-form`} className={styles.form}>
        <InsideField
          htmlFor={`${id}-send-to-trigger`}
          label={texts.sendTo}
          filled={sendTo !== ""}
          required
        >
          <Select
            id={`${id}-send-to`}
            label={texts.sendTo}
            options={SEND_TO.map((t) => ({ value: t.code, label: t.label }))}
            value={sendTo}
            disabled={saving}
            onChange={(next) => {
              // A new recipient kind starts afresh, as live clears its value and people.
              setSendTo(next as SendTo | "");
              setValue("");
              setPeople([]);
            }}
          />
        </InsideField>
        {sendTo && sendTo !== "INDIVIDUAL" && (
          <InsideField
            htmlFor={`${id}-send-to-value-trigger`}
            label={texts.sendToValue}
            filled={value !== ""}
            required
          >
            <Select
              id={`${id}-send-to-value`}
              label={texts.sendToValue}
              options={options}
              value={value}
              disabled={saving || list === undefined}
              emptyText={
                list === undefined ? "Loading…" : "No data to display."
              }
              onChange={setValue}
            />
          </InsideField>
        )}
        {sendTo === "INDIVIDUAL" && (
          <InsideField
            htmlFor={`${id}-people-field`}
            label={texts.fullName}
            filled={people.length > 0}
            required
          >
            <MultiSelect
              id={`${id}-people`}
              variant="chips"
              label={texts.fullName}
              options={options}
              value={people}
              limit={SHOWN}
              closeOnPick
              disabled={saving || list === undefined}
              onChange={setPeople}
            />
          </InsideField>
        )}
        <div className={styles.commentField}>
          <InsideField
            htmlFor={`${id}-comment`}
            label={texts.comment}
            filled
            multiline
          >
            <textarea
              id={`${id}-comment`}
              rows={3}
              maxLength={maxLength}
              value={comment}
              disabled={saving}
              aria-describedby={`${id}-comment-help`}
              onChange={(e) => setComment(e.target.value)}
              onPaste={(e) => {
                // maxLength trims a long paste; this only says so, as shareCommentPasteChain does.
                const t = e.currentTarget,
                  pasted = e.clipboardData.getData("text");
                if (
                  t.value.length -
                    (t.selectionEnd - t.selectionStart) +
                    pasted.length >
                  maxLength
                )
                  toast.show("warning", texts.truncated);
              }}
            />
          </InsideField>
          <span className={styles.meta} id={`${id}-comment-help`}>
            <span>{texts.commentHelp}</span>
            <span
              className={`${styles.counter}${comment.length >= maxLength ? ` ${styles.limit}` : ""}`}
              aria-live="polite"
            >
              {comment.length} / {maxLength}
            </span>
          </span>
        </div>
        <div className={styles.foot}>
          <button
            type="button"
            id={`${id}-cancel`}
            className="gn-btn gn-btn--solid"
            disabled={saving}
            onClick={onClose}
          >
            {texts.cancel}
          </button>
          <button
            type="button"
            id={`${id}-submit`}
            className="gn-btn gn-btn--primary"
            disabled={saving || comment.length > maxLength}
            onClick={submit}
          >
            {texts.share}
          </button>
        </div>
      </div>
    </ActionDialog>
  );
}
