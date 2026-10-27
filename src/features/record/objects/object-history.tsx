"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { State } from "@/components/feedback/state";
import { DateInput } from "@/components/ui/date-input";
import { useFormat } from "@/components/layout/shell-context";
import { stampDisplay } from "@/lib/format";
import { InsideField } from "@/components/ui/inside-field";
import { Select } from "@/components/ui/select";
import { idPart } from "@/lib/ids";
import { useInFlight } from "@/lib/hooks/use-in-flight";
import { ActionDialog } from "@/components/dialog/action-dialog";
import { useActionFailure } from "@/components/dialog/action-failure";
import dialogStyles from "@/components/dialog/dialog.module.css";
import { objects } from "@/lib/api";
import type { ObjectHost } from "@/lib/api/endpoints/objects";
import {
  ABANDON,
  RESPONSE_DATE_STATUSES,
  type Choice,
  type HistoryView,
} from "./types";
import styles from "./history-delegations.module.css";
/** Legacy convertUserComments: the table shows the first 15 characters, the popup the whole comment. */
const preview = (c: string) => (c.length >= 15 ? `${c.slice(0, 15)}...` : c);
/**
 * The shared status and approval history (legacy `object-history` fragment) for any host record. Add Status offers
 * only the statuses the server says are next; Abandon sends ABANDON. Both stay disabled once the record is abandoned.
 * A saved status refreshes the record, so the history and the header's status badge re-read together.
 */
export function ObjectHistory({
  id,
  host,
  view,
}: {
  /** The panel's page-unique id; its parts derive theirs from it. */
  id: string;
  host: ObjectHost;
  view: HistoryView;
}) {
  const { texts, gates } = view;
  const format = useFormat();
  const router = useRouter(),
    [, startTransition] = useTransition(),
    { run, isActive } = useInFlight(),
    fail = useActionFailure(),
    [dialog, setDialog] = useState<{
      abandon: boolean;
      statuses: Choice[];
    } | null>(null),
    [comment, setComment] = useState<string | null>(null);
  const opening = isActive("open");
  const openAdd = () =>
    run(async () => {
      const result = await objects.nextStatuses.load(host);
      if (!result.ok) return fail(result.error);
      setDialog({ abandon: false, statuses: result.data.statuses });
    }, "open");
  const saved = () => {
    setDialog(null);
    startTransition(() => router.refresh());
  };
  return (
    <section id={id} className={styles.panel} aria-labelledby={`${id}-title`}>
      <div className={styles.head}>
        <h2 id={`${id}-title`}>{texts.title}</h2>
        <div className={styles.actions}>
          {gates.abandon && (
            <button
              type="button"
              id={`${id}-abandon-button`}
              className={`gn-btn gn-btn--primary ${dialogStyles.danger}`}
              disabled={gates.abandoned || opening}
              onClick={() => setDialog({ abandon: true, statuses: [] })}
            >
              {texts.abandon}
            </button>
          )}
          {gates.addStatus && (
            <button
              type="button"
              id={`${id}-add-status`}
              className="gn-btn gn-btn--primary"
              disabled={gates.abandoned || opening}
              aria-busy={opening || undefined}
              onClick={openAdd}
            >
              {texts.addStatus}
            </button>
          )}
        </div>
      </div>
      {/* Legacy oj-table: the header stays, an empty table says so in its body. */}
      <div className={`gn-table-scroll ${styles.tableWrap}`}>
        <table id={`${id}-table`} className="gn-table">
          <thead>
            <tr>
              <th scope="col">{texts.status}</th>
              <th scope="col">{texts.mode}</th>
              <th scope="col">{texts.comments}</th>
              <th scope="col">{texts.user}</th>
              <th scope="col">{texts.date}</th>
            </tr>
          </thead>
          <tbody>
            {view.rows.map((r) => (
              <tr
                key={r.id}
                id={`${id}-row-${idPart(r.id)}`}
                className="enter-rise"
              >
                <td>{r.status}</td>
                <td>{r.mode}</td>
                <td>
                  {r.comments && (
                    <button
                      type="button"
                      id={`${id}-row-${idPart(r.id)}-comments`}
                      className={styles.link}
                      onClick={() => setComment(r.comments)}
                    >
                      {preview(r.comments)}
                    </button>
                  )}
                </td>
                <td>{r.user}</td>
                <td>{stampDisplay(r.date, format)}</td>
              </tr>
            ))}
            {view.rows.length === 0 && (
              <tr>
                <td id={`${id}-empty`} colSpan={5} className="gn-table-empty">
                  {texts.noData}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {view.approvals && (
        <details
          id={`${id}-approvals`}
          className={`gn-collapsible ${styles.section}`}
          open
        >
          <summary id={`${id}-approvals-title`}>{texts.approvalTitle}</summary>
          {"error" in view.approvals ? (
            <State
              id={`${id}-approvals-error`}
              title={view.approvals.error}
              code="UPSTREAM"
            />
          ) : (
            <div className={`gn-table-scroll ${styles.tableWrap}`}>
              <table id={`${id}-approvals-table`} className="gn-table">
                <thead>
                  <tr>
                    <th scope="col">{texts.approvalName}</th>
                    <th scope="col">{texts.approvalStatus}</th>
                    <th scope="col">{texts.approvalStage}</th>
                    <th scope="col">{texts.approvalComments}</th>
                    {view.approvalTransaction && (
                      <th scope="col">{texts.approvalTransaction}</th>
                    )}
                    <th scope="col">{texts.approvalUpdated}</th>
                  </tr>
                </thead>
                <tbody>
                  {view.approvals.rows.map((r) => (
                    <tr
                      key={r.id}
                      id={`${id}-approval-${idPart(r.id)}`}
                      className="enter-rise"
                    >
                      <td>{r.name}</td>
                      <td>{r.status}</td>
                      <td>{r.stage}</td>
                      <td>
                        {r.comments && (
                          <button
                            type="button"
                            id={`${id}-approval-${idPart(r.id)}-comments`}
                            className={`${styles.link} ${styles.clamp}`}
                            onClick={() => setComment(r.comments)}
                          >
                            {r.comments}
                          </button>
                        )}
                      </td>
                      {view.approvalTransaction && <td>{r.transaction}</td>}
                      <td>{stampDisplay(r.updated, format)}</td>
                    </tr>
                  ))}
                  {view.approvals.rows.length === 0 && (
                    <tr>
                      <td
                        id={`${id}-approvals-empty`}
                        colSpan={5}
                        className="gn-table-empty"
                      >
                        {texts.approvalNoData}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </details>
      )}
      {dialog && (
        <StatusDialog
          id={`${id}-dialog`}
          host={host}
          view={view}
          abandon={dialog.abandon}
          statuses={dialog.statuses}
          onSaved={saved}
          onClose={() => setDialog(null)}
        />
      )}
      {comment !== null && (
        <ActionDialog
          id={`${id}-comment`}
          title={texts.commentsTitle}
          width="50vw" /* legacy commentPopUp oj-md-width-1/2 */
          onClose={() => setComment(null)}
        >
          <p id={`${id}-comment-text`} className={styles.comment}>
            {comment}
          </p>
        </ActionDialog>
      )}
    </section>
  );
}
/** Add New Status (or Abandon, with its status fixed): status, the response date where shown, and a comment. */
function StatusDialog({
  id,
  host,
  view: { texts, gates },
  abandon,
  statuses,
  onSaved,
  onClose,
}: {
  id: string;
  host: ObjectHost;
  view: HistoryView;
  abandon: boolean;
  statuses: Choice[];
  onSaved: () => void;
  onClose: () => void;
}) {
  // A single next status is chosen for the user, as legacy fetchNextStatus does.
  const [status, setStatus] = useState(
      abandon ? ABANDON : statuses.length === 1 ? statuses[0].value : "",
    ),
    [comments, setComments] = useState(""),
    [responseDate, setResponseDate] = useState(""),
    { run, isActive } = useInFlight(),
    fail = useActionFailure(),
    saving = isActive("save");
  const dated = gates.responseDate && RESPONSE_DATE_STATUSES.includes(status);
  const ready = status !== "" && comments.trim() !== "";
  const save = () =>
    run(async () => {
      const result = await objects.addStatus(host, {
        status,
        comments,
        ...(dated && responseDate !== "" ? { responseDate } : {}),
      });
      if (!result.ok) return fail(result.error);
      onSaved();
    }, "save");
  return (
    <ActionDialog
      id={id}
      title={texts.dialogTitle}
      busy={saving}
      closeLabel={texts.cancel}
      onClose={onClose}
    >
      <div id={`${id}-form`} className={dialogStyles.form}>
        {!abandon && (
          <InsideField
            htmlFor={`${id}-status-trigger`}
            label={texts.statusLabel}
            filled={status !== ""}
            required
          >
            <Select
              id={`${id}-status`}
              label={texts.statusLabel}
              options={statuses}
              value={status}
              disabled={saving}
              onChange={setStatus}
            />
          </InsideField>
        )}
        {dated && (
          <InsideField
            htmlFor={`${id}-response-date`}
            label={texts.responseDate}
            filled={responseDate !== ""}
          >
            <DateInput
              id={`${id}-response-date`}
              value={responseDate}
              disabled={saving}
              onChange={setResponseDate}
            />
          </InsideField>
        )}
        <InsideField
          htmlFor={`${id}-comments`}
          label={texts.commentPlaceholder}
          filled
          multiline
          required
        >
          <textarea
            id={`${id}-comments`}
            rows={2}
            value={comments}
            required
            disabled={saving}
            onChange={(e) => setComments(e.target.value)}
          />
        </InsideField>
        <div className={dialogStyles.foot}>
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
            id={`${id}-save`}
            className="gn-btn gn-btn--primary"
            disabled={saving || !ready}
            aria-busy={saving || undefined}
            onClick={save}
          >
            {texts.save}
          </button>
        </div>
      </div>
    </ActionDialog>
  );
}
