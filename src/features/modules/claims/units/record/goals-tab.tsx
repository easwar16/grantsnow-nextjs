"use client";
import { useState } from "react";
import { ActionDialog } from "@/components/dialog/action-dialog";
import { useActionFailure } from "@/components/dialog/action-failure";
import { useToast } from "@/components/feedback/toast";
import { State } from "@/components/feedback/state";
import { TableSkeleton } from "@/components/feedback/skeleton";
import { DataTable } from "@/components/ui/data-table";
import { HelpButton } from "@/components/ui/help-button";
import { Icon } from "@/components/ui/icon";
import { InsideField } from "@/components/ui/inside-field";
import { ReadonlyField } from "@/components/ui/readonly-field";
import { Select } from "@/components/ui/select";
import { claims, useApi } from "@/lib/api";
import type { FormatSettings } from "@/lib/format";
import { functions } from "@/lib/functions";
import { useInFlight } from "@/lib/hooks/use-in-flight";
import type { UnitGoalDialog, UnitGoalRow } from "../types";
import { useRecordAudit } from "@/features/record/shell/record-frame";
import styles from "./summary.module.css";

type Format = FormatSettings & { currency?: string };
type Header = { label: string; help: string | null };
const head = (id: string, h: Header) => (
  <>
    {h.label}
    <HelpButton id={`${id}-help`} html={h.help} />
  </>
);

/** The Goals tab (legacy claims-unit-goals): a fund's goals, Add Goal, and each goal's edit / view and delete. */
export function UnitGoalsTab({
  appId,
  format,
}: {
  appId: string;
  format?: Format;
}) {
  const [fund, setFund] = useState(""),
    [dialog, setDialog] = useState<{ goal: string } | null>(null);
  const list = useApi(claims.goals, { appId, fund });
  const fail = useActionFailure(),
    { run, isActive } = useInFlight(),
    openAudit = useRecordAudit();
  const view = list.data;
  if (list.error)
    return (
      <State
        id="claims-unit-goals-error"
        title="Couldn't load the goals"
        message={list.error.message}
        retry={list.retry}
      />
    );
  if (!view) return <TableSkeleton label="Loading goals" />;
  const id = "claims-unit-goals";
  const remove = (r: UnitGoalRow) =>
    void run(async () => {
      const result = await claims.deleteGoal(appId, {
        fund: view.fund,
        goal: r.key,
      });
      if (!result.ok) return fail(result.error);
      list.retry();
    }, `delete-${r.key}`);
  return (
    <div id={id} className={styles.tab}>
      <section id={`${id}-panel`} className={styles.panel}>
        <h2 className={styles.heading}>
          {view.heading.title}
          <HelpButton id={`${id}-heading-help`} html={view.heading.help} />
        </h2>
        <div className={styles.goalsBar}>
          <InsideField
            htmlFor={`${id}-fund-trigger`}
            label={view.fundLabel}
            filled={view.fund !== ""}
          >
            <Select
              id={`${id}-fund`}
              label={view.fundLabel}
              options={view.funds}
              value={view.fund}
              onChange={setFund}
            />
          </InsideField>
          {/* Legacy: unit-add-goal edit, on a fund whose status allows a user edit (owner: hidden, not disabled). */}
          {view.audit && view.fund && (
            <button
              type="button"
              id={`${id}-audit`}
              className={`gn-btn gn-btn--outlined ${styles.pushEnd}`}
              onClick={() =>
                openAudit({
                  page: "claims-unit-goals",
                  sec: view.fund,
                  title: view.audit!,
                })
              }
            >
              <Icon name="audits" size={14} />
              {view.audit}
            </button>
          )}
          {view.canManage && view.editable && view.fund && (
            <button
              type="button"
              id={`${id}-add`}
              className="gn-btn gn-btn--outlined"
              onClick={() => setDialog({ goal: "" })}
            >
              <Icon name="plus" size={14} />
              {view.texts.addGoal}
            </button>
          )}
        </div>
        <DataTable
          id={`${id}-table`}
          rowIds={`${id}-row`}
          label={view.heading.title}
          rows={view.rows}
          rowKey={(r) => r.key}
          empty={view.empty}
          columns={[
            {
              id: "number",
              header: head(`${id}-number`, view.headers.number),
              rowHeader: true,
              cell: (r) => r.number,
            },
            {
              id: "fund",
              header: head(`${id}-fund-col`, view.headers.fund),
              cell: (r) => r.fund,
            },
            {
              id: "activities",
              header: head(`${id}-activities`, view.headers.activities),
              cell: (r) => r.activities,
            },
            {
              id: "description",
              header: head(`${id}-description`, view.headers.description),
              cell: (r) => r.description,
            },
            {
              id: "evaluation",
              header: head(`${id}-evaluation`, view.headers.evaluation),
              cell: (r) => r.evaluation,
            },
            {
              id: "reviewer-comments",
              header: head(
                `${id}-reviewer-comments`,
                view.headers.reviewerComments,
              ),
              cell: (r) => r.reviewerComments,
            },
          ]}
          actions={[
            {
              id: view.editable ? "edit" : "view",
              icon: view.editable ? "edit" : "view",
              label: (r) =>
                `${view.editable ? view.texts.edit : view.texts.view} ${r.number}`,
              hidden: () => !view.canManage,
              onClick: (r) => setDialog({ goal: r.key }),
            },
            {
              id: "delete",
              icon: "trash",
              label: (r) => `${view.texts.delete} ${r.number}`,
              // A goal linked to an activity cannot go (legacy disables it): hidden, as is all without the right.
              hidden: (r) => !view.canManage || !view.editable || r.linked,
              disabled: (r) => isActive(`delete-${r.key}`),
              onClick: remove,
            },
          ]}
        />
      </section>
      {dialog && (
        <GoalDialog
          appId={appId}
          fund={view.fund}
          goal={dialog.goal}
          format={format}
          onClose={() => setDialog(null)}
          onSaved={() => {
            setDialog(null);
            list.retry();
          }}
        />
      )}
    </div>
  );
}

function GoalDialog({
  appId,
  fund,
  goal,
  format,
  onClose,
  onSaved,
}: {
  appId: string;
  fund: string;
  goal: string;
  format?: Format;
  onClose: () => void;
  onSaved: () => void;
}) {
  const id = "claims-unit-goal-dialog";
  // The fiscal year drives the goals offered (legacy loadFundGoals on its change); "" until the server picks it.
  const [year, setYear] = useState("");
  const read = useApi(claims.goalDialog, { appId, fund, goal, year });
  const view = read.data;
  return (
    <ActionDialog
      id={id}
      title={view?.title ?? ""}
      width="70vw" /* legacy addGoalDialog: 70vw × 70vh */
      className={styles.goalDialog}
      onClose={onClose}
    >
      {read.error ? (
        <State
          id={`${id}-error`}
          title="Couldn't load the goal"
          message={read.error.message}
          retry={read.retry}
        />
      ) : !view ? (
        <TableSkeleton label="Loading goal" />
      ) : (
        <GoalForm
          id={id}
          appId={appId}
          fund={fund}
          view={view}
          format={format}
          onYear={setYear}
          onSaved={onSaved}
        />
      )}
    </ActionDialog>
  );
}

function GoalForm({
  id,
  appId,
  fund,
  view,
  format,
  onYear,
  onSaved,
}: {
  id: string;
  appId: string;
  fund: string;
  view: UnitGoalDialog;
  format?: Format;
  onYear: (year: string) => void;
  onSaved: () => void;
}) {
  const toast = useToast(),
    fail = useActionFailure(),
    { run, isActive } = useInFlight();
  const editing = view.goal !== null;
  const [draft, setDraft] = useState(() => ({
    goalId: view.goal?.goalId ?? "",
    description: view.goal?.description ?? "",
    evaluation: view.goal?.evaluation ?? "",
    reviewerComments: view.goal?.reviewerComments ?? "",
    category: view.goal?.category ?? "",
  }));
  const [touched, setTouched] = useState(false);
  // A goal no longer offered for the chosen year shows blank, as legacy's select does.
  const goalId = view.goals.some((g) => g.value === draft.goalId)
    ? draft.goalId
    : "";
  const saving = isActive("save");
  const system = draft.category === "SYSTEM";
  const save = () =>
    void run(async () => {
      setTouched(true);
      if (!goalId || !view.fiscalYear) return;
      const result = await claims.saveGoal(appId, {
        fund,
        ...(view.goal ? { goal: view.goal.id } : {}),
        fiscalYear: view.fiscalYear,
        goalId,
        description: draft.description,
        evaluation: draft.evaluation,
        reviewerComments: draft.reviewerComments,
      });
      if (!result.ok) return fail(result.error);
      toast.show("success", editing ? view.texts.update : view.texts.add);
      onSaved();
    }, "save");
  const money = (v: number | null) =>
    v === null
      ? ""
      : functions.format.moneyDisplay(String(v), format?.currency, format);
  const chosen = view.goals.find((g) => g.value === goalId);
  const area = (
    key: "description" | "evaluation" | "reviewerComments",
    readOnly: boolean,
  ) =>
    readOnly || !view.editable ? (
      <ReadonlyField
        id={`${id}-${functions.ids.idPart(key)}`}
        label={view.labels[key]}
        value={draft[key]}
      />
    ) : (
      <InsideField
        htmlFor={`${id}-${functions.ids.idPart(key)}`}
        label={view.labels[key]}
        filled={draft[key] !== ""}
      >
        <textarea
          id={`${id}-${functions.ids.idPart(key)}`}
          rows={3}
          value={draft[key]}
          disabled={saving}
          onChange={(e) => setDraft((d) => ({ ...d, [key]: e.target.value }))}
        />
      </InsideField>
    );
  return (
    <div className={styles.goalForm}>
      <div className={styles.fields}>
        <ReadonlyField
          id={`${id}-fund`}
          label={view.labels.fund}
          value={view.fundName}
        />
        {editing || !view.editable ? (
          <ReadonlyField
            id={`${id}-fiscal-year`}
            label={view.labels.fiscalYear}
            value={view.fiscalYear}
          />
        ) : (
          <InsideField
            htmlFor={`${id}-fiscal-year-trigger`}
            label={view.labels.fiscalYear}
            filled={view.fiscalYear !== ""}
            required
          >
            <Select
              id={`${id}-fiscal-year`}
              label={view.labels.fiscalYear}
              options={view.fiscalYears.map((y) => ({ value: y, label: y }))}
              value={view.fiscalYear}
              disabled={saving}
              onChange={onYear}
            />
          </InsideField>
        )}
        {view.editable ? (
          <div>
            <InsideField
              htmlFor={`${id}-fund-goal-trigger`}
              label={view.labels.fundGoal}
              filled={goalId !== ""}
              required
            >
              <Select
                id={`${id}-fund-goal`}
                label={view.labels.fundGoal}
                options={view.goals}
                value={goalId}
                disabled={saving}
                onChange={(next) => {
                  // Legacy fundGoalValueChange: the goal's description, number and category come with it.
                  const g = view.goals.find((o) => o.value === next);
                  setDraft((d) => ({
                    ...d,
                    goalId: next,
                    description: g?.description ?? d.description,
                    category: g?.category ?? "",
                  }));
                }}
              />
            </InsideField>
            {touched && !goalId && (
              <span
                id={`${id}-fund-goal-error`}
                role="alert"
                className={styles.error}
              >
                Enter a value.
              </span>
            )}
          </div>
        ) : (
          <ReadonlyField
            id={`${id}-fund-goal`}
            label={view.labels.fundGoal}
            value={chosen?.label ?? ""}
          />
        )}
        {area("description", system)}
        {area("evaluation", false)}
        {area("reviewerComments", false)}
      </div>
      {view.editable && (
        <div className={styles.goalActions}>
          <button
            type="button"
            id={`${id}-save`}
            className="gn-btn gn-btn--primary"
            disabled={saving}
            onClick={save}
          >
            {editing ? view.texts.update : view.texts.add}
          </button>
        </div>
      )}
      <DataTable
        id={`${id}-activities`}
        rowIds={`${id}-activity`}
        label={view.activities.headers.number.label}
        rows={view.activities.rows}
        rowKey={(r) => r.key}
        empty={view.activities.empty}
        columns={[
          {
            id: "number",
            header: head(
              `${id}-activity-number`,
              view.activities.headers.number,
            ),
            rowHeader: true,
            cell: (r) => r.number,
            footer: <strong>{view.texts.total}</strong>,
          },
          {
            id: "status",
            header: head(
              `${id}-activity-status`,
              view.activities.headers.status,
            ),
            cell: (r) => r.status,
          },
          {
            id: "text",
            header: head(`${id}-activity-text`, view.activities.headers.text),
            cell: (r) => r.text,
          },
          {
            id: "cost",
            header: head(`${id}-activity-cost`, view.activities.headers.cost),
            cell: (r) => money(r.cost),
            footer: <strong>{money(view.activities.total)}</strong>,
          },
        ]}
      />
    </div>
  );
}
