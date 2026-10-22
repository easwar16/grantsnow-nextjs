"use client";
import { useEffect, useEffectEvent, useId, useMemo, useState } from "react";
import { RecordSkeleton } from "@/components/feedback/skeleton";
import { useToast } from "@/components/feedback/toast";
import { useInFlight } from "@/lib/use-in-flight";
import { ActionDialog } from "./action-dialog";
import { callAction, useActionFailure, type ActionError } from "./request";
import styles from "./actions.module.css";
type SendTo = "ROLE" | "GROUP" | "INDIVIDUAL";
type Option = { value: string; label: string };
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
/** The one 8516 share dialog for the finder and Home: to a role, a group or chosen people, with an optional comment. */
export function ShareDialog({
  opportunityId,
  heading,
  onClose,
}: {
  opportunityId: string;
  heading: string;
  onClose: () => void;
}) {
  const [setup, setSetup] = useState<{ texts: Texts; maxLength: number }>(),
    [sendTo, setSendTo] = useState<SendTo | "">(""),
    [values, setValues] = useState<Record<string, Option[] | "failed">>({}),
    [value, setValue] = useState(""),
    [people, setPeople] = useState<string[]>([]),
    [search, setSearch] = useState(""),
    [comment, setComment] = useState(""),
    { run, isActive } = useInFlight(),
    toast = useToast(),
    fail = useActionFailure(),
    saving = isActive("share"),
    ids = useId();
  const setupFailed = useEffectEvent((error: ActionError) => {
    toast.error(error);
    onClose();
  });
  useEffect(() => {
    let live = true;
    callAction<{ texts: Texts; maxLength: number }>("share").then((r) => {
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
    callAction<Option[]>("share-values", undefined, { type: sendTo }).then(
      (r) => {
        if (!live) return;
        // A failed list degrades to empty, as the original's toast.degrade.
        if (!r.ok) toast.error(r.error);
        setValues((all) => ({ ...all, [sendTo]: r.ok ? r.data : "failed" }));
      },
    );
    return () => {
      live = false;
    };
  }, [sendTo, values, toast]);
  const list = sendTo ? values[sendTo] : undefined;
  const options = useMemo(() => (Array.isArray(list) ? list : []), [list]);
  const matches = useMemo(() => {
    const term = search.trim().toLowerCase();
    return (
      term
        ? options.filter((o) => o.label.toLowerCase().includes(term))
        : options
    ).slice(0, SHOWN);
  }, [options, search]);
  if (!setup)
    return (
      <ActionDialog title="" width={520} onClose={onClose}>
        <RecordSkeleton label="Loading share options" />
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
      const result = await callAction("share", {
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
    <ActionDialog
      title={texts.title}
      subtitle={heading}
      width={520}
      busy={saving}
      onClose={onClose}
    >
      <div className={styles.form}>
        <label className="gn-field">
          <span className="gn-label">{texts.sendTo} *</span>
          <select
            className="gn-control"
            value={sendTo}
            disabled={saving}
            onChange={(e) => {
              setSendTo(e.target.value as SendTo | "");
              setValue("");
            }}
          >
            <option value="" />
            {SEND_TO.map((t) => (
              <option key={t.code} value={t.code}>
                {t.label}
              </option>
            ))}
          </select>
        </label>
        {sendTo && sendTo !== "INDIVIDUAL" && (
          <label className="gn-field">
            <span className="gn-label">{texts.sendToValue} *</span>
            {list === undefined ? (
              <RecordSkeleton label={`Loading ${texts.sendToValue}`} />
            ) : (
              <select
                className="gn-control"
                value={value}
                disabled={saving}
                onChange={(e) => setValue(e.target.value)}
              >
                <option value="" />
                {options.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            )}
          </label>
        )}
        {sendTo === "INDIVIDUAL" && (
          <fieldset className={`gn-field ${styles.people}`}>
            <legend className="gn-label">
              {texts.fullName} * ({people.length} selected)
            </legend>
            <input
              type="search"
              aria-label={`Search ${texts.fullName}`}
              placeholder="Search"
              value={search}
              disabled={saving}
              onChange={(e) => setSearch(e.target.value)}
            />
            {list === undefined ? (
              <RecordSkeleton label={`Loading ${texts.fullName}`} />
            ) : matches.length === 0 ? (
              <p className={styles.empty}>No data to display.</p>
            ) : (
              <ul className={styles.choices}>
                {matches.map((o) => (
                  <li key={o.value}>
                    <label>
                      <input
                        type="checkbox"
                        checked={people.includes(o.value)}
                        disabled={saving}
                        onChange={(e) =>
                          setPeople((all) =>
                            e.target.checked
                              ? [...all, o.value]
                              : all.filter((p) => p !== o.value),
                          )
                        }
                      />
                      {o.label}
                    </label>
                  </li>
                ))}
              </ul>
            )}
          </fieldset>
        )}
        <label className="gn-field">
          <span className="gn-label">{texts.comment}</span>
          <textarea
            className="gn-control"
            rows={3}
            maxLength={maxLength}
            value={comment}
            disabled={saving}
            aria-describedby={`${ids}-help`}
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
          <span className={styles.meta} id={`${ids}-help`}>
            <span>{texts.commentHelp}</span>
            <span
              className={`${styles.counter}${comment.length >= maxLength ? ` ${styles.limit}` : ""}`}
              aria-live="polite"
            >
              {comment.length} / {maxLength}
            </span>
          </span>
        </label>
        <div className={styles.foot}>
          <button
            type="button"
            className="gn-btn gn-btn--solid"
            disabled={saving}
            onClick={onClose}
          >
            {texts.cancel}
          </button>
          <button
            type="button"
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
