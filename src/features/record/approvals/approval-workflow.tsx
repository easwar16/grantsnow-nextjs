"use client";
import { StatusBadge, type StatusTone } from "@/components/ui/status-badge";
import { memo, useCallback, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { State } from "@/components/feedback/state";
import { Skeleton } from "@/components/feedback/skeleton";
import { LocalTime } from "@/components/ui/local-time";
import { DataTable } from "@/components/ui/data-table";
import { useToast } from "@/components/feedback/toast";
import { HelpButton } from "@/components/ui/help-button";
import { Icon } from "@/components/ui/icon";
import { Collapsible } from "@/components/ui/collapsible";
import { useConfirm } from "@/components/dialog/action-dialog";
import { useActionFailure } from "@/components/dialog/action-failure";
import { approvals, useApi } from "@/lib/api";
import { useStoreApi } from "@/lib/store/app-store";
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
import { functions } from "@/lib/functions";

/** Legacy oj-badge tones by stage status; any other status is the plain badge. */
const TONE: Record<string, StatusTone> = {
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
              <StatusBadge tone={TONE[stage.status]}>
                <strong>{texts.status}</strong> : {stage.status}
              </StatusBadge>
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
}: {
  id: string;
  api: string;
  view: WorkflowView;
}) {
  const { texts, stages, gates } = view;
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
        store.forget(approvals.history.key(api));
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
    <div id={id} className={styles.workflow}>
      {stages.length > 0 && (
        <Collapsible
          id={`${id}-route`}
          headClassName={styles.head}
          heading={<h3 id={`${id}-route-heading`}>{texts.route}</h3>}
          actions={
            <>
              {/* Legacy tabBarApprovals: Graph View only where the bundle shows it. */}
              {view.views.graph && (
                <span
                  className={styles.viewSwitch}
                  role="group"
                  aria-label={`${texts.route} view`}
                >
                  <button
                    type="button"
                    id={`${id}-list-view`}
                    aria-pressed={routeView === "list"}
                    onClick={(event) => {
                      event.preventDefault();
                      setRouteView("list");
                    }}
                  >
                    {texts.listView}
                  </button>
                  <button
                    type="button"
                    id={`${id}-graph-view`}
                    aria-pressed={routeView === "graph"}
                    onClick={(event) => {
                      event.preventDefault();
                      setRouteView("graph");
                    }}
                  >
                    {texts.graphView}
                  </button>
                </span>
              )}
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
            </>
          }
        >
          {routeView === "graph" ? (
            <RouteGraph id={`${id}-graph`} api={api} texts={texts} />
          ) : (
            <ol id={`${id}-stages`} className={styles.stages}>
              {stages.map((stage) => (
                <Stage
                  key={stage.id}
                  id={`${id}-stage-${functions.ids.idPart(stage.id)}`}
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
        </Collapsible>
      )}
      <ApprovalHistory
        id={id}
        api={api}
        texts={texts}
        cards={view.views.cards}
      />
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

/** Graph View: the route read as a tree when the view is first opened, then held. */
function RouteGraph({
  id,
  api,
  texts,
}: {
  id: string;
  api: string;
  texts: Texts;
}) {
  const { data, error, retry } = useApi(approvals.graph, api);
  if (error)
    return (
      <State
        id={`${id}-error`}
        title="Approval graph could not be loaded."
        message={error.message}
        code={error.code}
        action={error.action}
        retry={retry}
      />
    );
  if (!data) return <Skeleton kind="chart" label={texts.graphView} />;
  return <ApprovalTree root={data} />;
}

/** The route's history section, shared by every approval host. */
function ApprovalHistory({
  id,
  api,
  texts,
  cards,
}: {
  id: string;
  /** The host's workflow route; the history reads from it beside the route. */
  api: string;
  texts: WorkflowView["texts"];
  /** Legacy's Card View tab, RB-gated. */
  cards: boolean;
}) {
  const [historyView, setHistoryView] = useState<"table" | "card">("table");
  const { data: history, error, retry } = useApi(approvals.history, api);
  return (
    <Collapsible
      id={`${id}-history`}
      headClassName={styles.head}
      heading={<h3 id={`${id}-history-heading`}>{texts.history}</h3>}
      actions={
        <>
          {cards && (
            <span
              className={styles.viewSwitch}
              role="group"
              aria-label={`${texts.history} view`}
            >
              <button
                type="button"
                id={`${id}-history-table-view`}
                aria-pressed={historyView === "table"}
                onClick={(event) => {
                  event.preventDefault();
                  setHistoryView("table");
                }}
              >
                {texts.tableView}
              </button>
              <button
                type="button"
                id={`${id}-history-card-view`}
                aria-pressed={historyView === "card"}
                onClick={(event) => {
                  event.preventDefault();
                  setHistoryView("card");
                }}
              >
                {texts.cardView}
              </button>
            </span>
          )}
        </>
      }
    >
      {error ? (
        <State
          id={`${id}-history-error`}
          title="Approval history could not be loaded."
          message={error.message}
          code={error.code}
          action={error.action}
          retry={retry}
        />
      ) : !history ? (
        <Skeleton kind="list" count={3} label={texts.history} />
      ) : "error" in history ? (
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
              <time>
                <LocalTime value={row.updated} />
              </time>
            </li>
          ))}
        </ol>
      ) : (
        <div className={`gn-table-scroll ${styles.tableWrap}`}>
          <DataTable
            id={`${id}-history-table`}
            rowIds={`${id}-history`}
            columns={[
              { id: "name", header: texts.historyName, cell: (r) => r.name },
              {
                id: "status",
                header: texts.historyStatus,
                cell: (r) => r.status,
              },
              { id: "stage", header: texts.historyStage, cell: (r) => r.stage },
              {
                id: "comments",
                header: texts.historyComments,
                // The ellipsis gets its full-text tooltip from the shell's TruncatedTitles.
                className: styles.comment,
                cell: (r) => r.comments,
              },
              {
                id: "updated",
                header: texts.historyUpdated,
                cell: (r) => <LocalTime value={r.updated} />,
              },
            ]}
            rows={history.rows}
            rowKey={(r) => r.id}
            rowClassName={() => "enter-rise"}
          />
        </div>
      )}
    </Collapsible>
  );
}
