"use client";
import {
  memo,
  useCallback,
  useState,
  useTransition,
  type ReactNode,
} from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { State } from "@/components/feedback/state";
import { useToast } from "@/components/feedback/toast";
import { HelpButton } from "@/components/ui/help-button";
import { Icon } from "@/components/ui/icon";
import { useConfirm } from "@/components/dialog/action-dialog";
import { useActionFailure } from "@/components/dialog/action-failure";
import { approvals } from "@/lib/api";
import { useStoreApi } from "@/lib/store/app-store";
import { idPart } from "@/lib/ids";
import { useInFlight } from "@/lib/hooks/use-in-flight";
import { AddStageDialog, ApproversDialog, CommentsDialog } from "./dialogs";
import { ApprovalTree } from "./approval-tree";
import type {
  ApprovalAction,
  ApprovalStage,
  WorkflowTextKey,
  WorkflowView,
} from "./types";
import styles from "./approval-workflow.module.css";

/** Legacy oj-badge tones by stage status; any other status is the plain badge. */
const TONE: Record<string, string> = {
  Rework: "warning",
  Notified: "info",
  Approved: "success",
  Rejected: "danger",
};
export type Texts = Record<WorkflowTextKey, string>;
/** A route write: the request body plus the success toast it shows, if any. */
export type Write = (
  key: string,
  body: Record<string, unknown>,
  success?: string | "backend",
) => Promise<boolean>;

const Stage = memo(function Stage({
  id,
  stage,
  texts,
  busy,
  onApprovers,
  onAct,
  onDelete,
}: {
  id: string;
  stage: ApprovalStage;
  texts: Texts;
  busy: boolean;
  onApprovers: (stage: ApprovalStage) => void;
  onAct: (action: ApprovalAction, stage: ApprovalStage) => void;
  onDelete: (stage: ApprovalStage) => void;
}) {
  return (
    <li
      id={id}
      className={`${styles.stage} enter-rise`}
      data-status={stage.status}
    >
      <span className={styles.level}>{stage.name}</span>
      <div className={styles.body}>
        <p className={styles.title}>
          <strong>{texts.stageName}</strong> {stage.description}
          <HelpButton
            id={`${id}-help`}
            html={stage.helpText}
            label={texts.helpText}
          />
        </p>
        <ul className={styles.meta}>
          {stage.role && (
            <li>
              <strong>{texts.role}: </strong>
              {stage.role}
            </li>
          )}
          <li>
            <strong>{texts.actionType}: </strong>
            {stage.actionType}
          </li>
          <li>
            <strong>{texts.count} </strong>
            {stage.required}
          </li>
          {!stage.review && stage.status && (
            <li>
              <span className="gn-status" data-tone={TONE[stage.status]}>
                <strong>{texts.status}</strong> : {stage.status}
              </span>
            </li>
          )}
        </ul>
        {stage.remarks && (
          <p className={styles.remarks}>
            <strong>{texts.remarks} </strong>
            <span dangerouslySetInnerHTML={{ __html: stage.remarks }} />
          </p>
        )}
        {stage.pendingDays !== null && (
          <p className={styles.remarks}>
            <strong>{`${texts.pendingSince} :  ${stage.pendingDays} Days`}</strong>
          </p>
        )}
      </div>
      <div className={styles.actions}>
        <div className={styles.links}>
          {stage.approverHref ? (
            <Link
              id={`${id}-approvers`}
              className="gn-btn gn-btn--borderless"
              href={stage.approverHref}
              prefetch={false}
            >
              <Icon name="contact" size={14} />
              {stage.review ? texts.viewReviewers : texts.viewApprovers}
            </Link>
          ) : stage.approvers ? (
            <button
              type="button"
              id={`${id}-approvers`}
              className="gn-btn gn-btn--borderless"
              onClick={() => onApprovers(stage)}
            >
              <Icon name="contact" size={14} />
              {stage.review ? texts.viewReviewers : texts.viewApprovers}
            </button>
          ) : null}
          {stage.canDelete && (
            <button
              type="button"
              id={`${id}-delete`}
              className="gn-btn gn-btn--icon"
              aria-label={texts.delete}
              title={texts.delete}
              disabled={busy}
              onClick={() => onDelete(stage)}
            >
              <Icon name="trash" size={14} />
            </button>
          )}
        </div>
        {stage.canAct && (
          <div className={styles.verdicts}>
            <button
              type="button"
              id={`${id}-approve`}
              className="gn-btn gn-btn--primary"
              disabled={busy}
              onClick={() => onAct("Approved", stage)}
            >
              {texts.approve}
            </button>
            <button
              type="button"
              id={`${id}-reject`}
              className={`gn-btn gn-btn--solid ${styles.danger}`}
              disabled={busy}
              onClick={() => onAct("Rejected", stage)}
            >
              {texts.reject}
            </button>
            <button
              type="button"
              id={`${id}-rework`}
              className="gn-btn gn-btn--solid"
              disabled={busy}
              onClick={() => onAct("Rework", stage)}
            >
              {texts.rework}
            </button>
          </div>
        )}
      </div>
    </li>
  );
});

/**
 * The shared approval workflow (legacy `approval-workflow` fragment, list view): the route's stages with their
 * approvers, the route actions and the approval history. `view` is read on the server; `api` is the host's workflow
 * route under `/api`. After a write it drops the held dialog reads and re-reads the page, so the record's status
 * badge follows. `id` prefixes every element id.
 */
export function ApprovalWorkflow({
  id,
  api,
  view,
  showHistory = true,
  graphContent,
  compactGraph = false,
}: {
  id: string;
  api: string;
  view: WorkflowView;
  showHistory?: boolean;
  graphContent?: ReactNode;
  compactGraph?: boolean;
}) {
  const { texts, stages, gates, history } = view;
  const router = useRouter(),
    store = useStoreApi(),
    toast = useToast(),
    fail = useActionFailure(),
    { run, isActive, busy } = useInFlight(),
    { ask, element: confirm } = useConfirm(`${id}-confirm`),
    [, startTransition] = useTransition(),
    [comment, setComment] = useState<{
      action: ApprovalAction;
      stage?: ApprovalStage;
    } | null>(null),
    [approvers, setApprovers] = useState<ApprovalStage | null>(null),
    [adding, setAdding] = useState(false),
    [routeView, setRouteView] = useState<"list" | "graph">("list");
  const write = useCallback<Write>(
    async (key, body, success) =>
      (await run(async () => {
        const result = await approvals.write(api, body);
        if (!result.ok) {
          fail(result.error);
          return false;
        }
        const message = success === "backend" ? result.data.message : success;
        if (message) toast.show("success", message);
        // Stage approvers changed; the people and Add Stage lists did not.
        store.forget(approvals.stageUsersKeys(api));
        startTransition(() => router.refresh());
        return true;
      }, key)) === true,
    [api, fail, router, run, store, toast],
  );
  const onAct = useCallback(
    async (action: ApprovalAction, stage?: ApprovalStage) => {
      // Legacy approvalDialogAction: a rejection is confirmed before its comments are asked for.
      if (
        action === "Rejected" &&
        !(await ask({
          title: texts.confirmTitle,
          message: texts.confirmReject,
          confirm: texts.reject,
          cancel: texts.cancel,
          danger: true,
        }))
      )
        return;
      setComment({ action, stage });
    },
    [ask, texts],
  );
  const onDelete = useCallback(
    async (stage: ApprovalStage) => {
      if (
        await ask({
          title: texts.deleteTitle,
          message: texts.deleteMessage,
          confirm: texts.deleteConfirm,
          cancel: texts.cancel,
          danger: true,
        })
      )
        await write(`delete-${stage.id}`, {
          op: "delete-stage",
          stageId: stage.id,
        });
    },
    [ask, texts, write],
  );
  return (
    <div
      id={id}
      className={`${styles.workflow} ${compactGraph ? styles.compactGraph : ""}`}
    >
      {stages.length > 0 && (
        <details
          id={`${id}-route`}
          className={`gn-collapsible ${styles.panel}`}
          open
        >
          <summary className={styles.head}>
            <h3 id={`${id}-route-heading`}>{texts.route}</h3>
            <span
              className={styles.viewSwitch}
              role="group"
              aria-label={`${texts.route} view`}
            >
              <button
                type="button"
                aria-pressed={routeView === "list"}
                onClick={(event) => {
                  event.preventDefault();
                  setRouteView("list");
                }}
              >
                List View
              </button>
              <button
                type="button"
                aria-pressed={routeView === "graph"}
                onClick={(event) => {
                  event.preventDefault();
                  setRouteView("graph");
                }}
              >
                Graph View
              </button>
            </span>
            {gates.addStage && (
              <button
                type="button"
                id={`${id}-add-stage`}
                className="gn-btn gn-btn--outlined"
                disabled={busy}
                onClick={(e) => {
                  e.preventDefault();
                  setAdding(true);
                }}
              >
                <Icon name="plus" size={14} />
                {texts.addStage}
              </button>
            )}
          </summary>
          {routeView === "graph" ? (
            (graphContent ??
            (view.graphError ? (
              <State title={view.graphError} code="UPSTREAM" />
            ) : view.graph ? (
              <ApprovalTree root={view.graph} />
            ) : (
              <State title={texts.noData} />
            )))
          ) : (
            <ol id={`${id}-stages`} className={styles.stages}>
              {stages.map((stage) => (
                <Stage
                  key={stage.id}
                  id={`${id}-stage-${idPart(stage.id)}`}
                  stage={stage}
                  texts={texts}
                  busy={busy}
                  onApprovers={setApprovers}
                  onAct={onAct}
                  onDelete={onDelete}
                />
              ))}
            </ol>
          )}
        </details>
      )}
      {showHistory && (
        <ApprovalHistory id={id} history={history} texts={texts} />
      )}
      <div id={`${id}-footer`} className={styles.footer}>
        {gates.generate && (
          <button
            type="button"
            id={`${id}-generate`}
            className="gn-btn gn-btn--outlined"
            disabled={isActive("generate")}
            onClick={() => void write("generate", { op: "generate" })}
          >
            {texts.generate}
          </button>
        )}
        {gates.submit && (
          <button
            type="button"
            id={`${id}-submit`}
            className="gn-btn gn-btn--primary"
            disabled={busy}
            onClick={() => void onAct("Submitted")}
          >
            {texts.submit}
          </button>
        )}
        {gates.withdraw && (
          <button
            type="button"
            id={`${id}-withdraw`}
            className={`gn-btn gn-btn--solid ${styles.danger}`}
            disabled={busy}
            onClick={() => void onAct("Withdrawn")}
          >
            {texts.withdraw}
          </button>
        )}
      </div>
      {confirm}
      {comment && (
        <CommentsDialog
          id={`${id}-comments`}
          texts={texts}
          action={comment.action}
          busy={isActive("act")}
          onClose={() => setComment(null)}
          onSend={async (comments) => {
            const sent = await write(
              "act",
              {
                op: "act",
                action: comment.action,
                ...(comments === "" ? {} : { comments }),
                ...(comment.stage ? { stageId: comment.stage.id } : {}),
              },
              texts.success,
            );
            if (sent) setComment(null);
          }}
        />
      )}
      {approvers && (
        <ApproversDialog
          id={`${id}-approvers`}
          api={api}
          stage={approvers}
          texts={texts}
          write={write}
          isActive={isActive}
          onClose={() => setApprovers(null)}
        />
      )}
      {adding && (
        <AddStageDialog
          id={`${id}-add-stage-dialog`}
          api={api}
          stages={stages}
          texts={texts}
          busy={isActive("add-stage")}
          onClose={() => setAdding(false)}
          onSubmit={async (body) => {
            if (
              await write(
                "add-stage",
                { op: "add-stage", ...body },
                texts.stageAdded,
              )
            )
              setAdding(false);
          }}
        />
      )}
    </div>
  );
}

/** The same history section can stream after its route and be reused by every approval host. */
export function ApprovalHistory({
  id,
  history,
  texts,
  standalone = false,
}: {
  id: string;
  history: WorkflowView["history"];
  texts: WorkflowView["texts"];
  standalone?: boolean;
}) {
  const [historyView, setHistoryView] = useState<"table" | "card">("table");
  return (
    <details
      id={`${id}-history`}
      className={`gn-collapsible ${styles.panel} ${standalone ? styles.historyStandalone : ""}`}
      open
    >
      <summary className={styles.head}>
        <h3 id={`${id}-history-heading`}>{texts.history}</h3>
        <span
          className={styles.viewSwitch}
          role="group"
          aria-label={`${texts.history} view`}
        >
          <button
            type="button"
            aria-pressed={historyView === "table"}
            onClick={(event) => {
              event.preventDefault();
              setHistoryView("table");
            }}
          >
            Table View
          </button>
          <button
            type="button"
            aria-pressed={historyView === "card"}
            onClick={(event) => {
              event.preventDefault();
              setHistoryView("card");
            }}
          >
            Card View
          </button>
        </span>
      </summary>
      {"error" in history ? (
        <State
          id={`${id}-history-error`}
          title={history.error}
          code="UPSTREAM"
        />
      ) : history.rows.length === 0 ? (
        <State id={`${id}-history-empty`} title={texts.noData} />
      ) : historyView === "card" ? (
        <ol id={`${id}-history-cards`} className={styles.historyCards}>
          {history.rows.map((row) => (
            <li
              key={row.id}
              className={styles.historyCard}
              data-status={row.status}
            >
              <span className={styles.historyIcon} aria-hidden="true">
                {row.status === "Approved"
                  ? "✓"
                  : row.status === "Rejected"
                    ? "×"
                    : "⇄"}
              </span>
              <span className={styles.historyBody}>
                <span>{row.name}</span>
                <span>
                  {row.stage}
                  {row.comments ? `|${row.comments}` : ""}
                </span>
                <span>{row.status}</span>
              </span>
              <time>{row.created || row.updated}</time>
            </li>
          ))}
        </ol>
      ) : (
        <div className={styles.tableWrap}>
          <table id={`${id}-history-table`}>
            <thead>
              <tr>
                <th scope="col">{texts.historyName}</th>
                <th scope="col">{texts.historyStatus}</th>
                <th scope="col">{texts.historyStage}</th>
                <th scope="col">{texts.historyComments}</th>
                <th scope="col">{texts.historyUpdated}</th>
              </tr>
            </thead>
            <tbody>
              {history.rows.map((row) => (
                <tr
                  key={row.id}
                  id={`${id}-history-${idPart(row.id)}`}
                  className="enter-rise"
                >
                  <td>{row.name}</td>
                  <td>{row.status}</td>
                  <td>{row.stage}</td>
                  <td className={styles.comment} title={row.comments}>
                    {row.comments}
                  </td>
                  <td>{row.updated}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </details>
  );
}
