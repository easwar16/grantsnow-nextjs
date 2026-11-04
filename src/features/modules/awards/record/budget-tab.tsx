"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/ui/icon";
import { DataTable } from "@/components/ui/data-table";
import { HelpButton } from "@/components/ui/help-button";
import { DateInput } from "@/components/ui/date-input";
import { useToast } from "@/components/feedback/toast";
import { ActionDialog } from "@/components/dialog/action-dialog";
import { useActionFailure } from "@/components/dialog/action-failure";
import { useInFlight } from "@/lib/hooks/use-in-flight";
import { awards } from "@/lib/api";
import { type FormatSettings } from "@/lib/format";
import type { BudgetView } from "@/server/modules/awards/record/budget";
import {
  budgetTotals,
  periodBound,
  recalc,
  type BudgetAmount,
  type BudgetDraft,
} from "./budget-model";
import dialog from "@/components/dialog/dialog.module.css";
import styles from "./tabs.module.css";
import { functions } from "@/lib/functions";

const AMOUNTS: BudgetAmount[] = [
  "direct",
  "indirect",
  "sponsor",
  "institution",
  "total",
];
const EMPTY: BudgetDraft = {
  key: "",
  type: "",
  start: "",
  end: "",
  direct: 0,
  indirect: 0,
  sponsor: 0,
  institution: 0,
  total: 0,
  erpId: "",
};

/** Budget Periods (legacy awards-budget-periods): the periods with their totals, Add and Edit in one dialog. */
export function BudgetTab({
  view,
  format,
}: {
  view: BudgetView;
  format?: FormatSettings & { currency?: string };
}) {
  const [draft, setDraft] = useState<BudgetDraft | null>(null),
    router = useRouter(),
    [, startTransition] = useTransition();
  const totals = budgetTotals(view.rows);
  const money = (n: number) =>
    functions.format.moneyDisplay(String(n), format?.currency, format);
  const c = view.columns;
  return (
    <div id="award-record-budget-periods" className={styles.tab}>
      {view.canAdd && (
        <div className={styles.actions}>
          <button
            type="button"
            id="award-budget-add"
            className="gn-btn gn-btn--primary"
            onClick={() => setDraft({ ...EMPTY, type: view.calendarType })}
          >
            <Icon name="plus" size={14} />
            {view.texts.add}
          </button>
        </div>
      )}
      <DataTable
        id="award-budget-periods"
        rowIds="award-budget"
        height="default"
        columns={[
          {
            id: "start",
            header: c.start,
            cell: (r) => functions.format.dateDisplay(r.start, format),
          },
          {
            id: "end",
            header: c.end,
            cell: (r) => functions.format.dateDisplay(r.end, format),
          },
          // Legacy footerTemplate totalCostLabel: in the type column, at its end.
          {
            id: "type",
            header: c.type,
            cell: (r) => r.type,
            footer: <span className={styles.footLabel}>{c.footer}</span>,
          },
          ...AMOUNTS.map((k) => ({
            id: k,
            header: c[k],
            align: "end" as const,
            cell: (r: BudgetView["rows"][number]) => money(r[k]),
            footer: money(totals[k]),
          })),
        ]}
        rows={view.rows}
        rowKey={(r) => r.key}
        actions={[
          {
            id: "edit",
            icon: "edit",
            size: 14,
            label: (r) => `${view.texts.edit} ${r.key}`,
            title: view.texts.edit,
            hidden: (r) => !view.canEdit || !r.editable,
            onClick: setDraft,
          },
        ]}
        actionsLabel={view.texts.edit}
        empty={view.texts.noData}
      />
      {draft && (
        <BudgetDialog
          view={view}
          initial={draft}
          onClose={() => setDraft(null)}
          onSaved={() => {
            setDraft(null);
            startTransition(() => router.refresh());
          }}
        />
      )}
    </div>
  );
}

function BudgetDialog({
  view,
  initial,
  onClose,
  onSaved,
}: {
  view: BudgetView;
  initial: BudgetDraft;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [d, setD] = useState(initial),
    // The typed text per amount; the split is re-derived when an amount is committed (blur), as legacy's value change.
    [typed, setTyped] = useState<Partial<Record<BudgetAmount, string>>>({}),
    [touched, setTouched] = useState(false),
    { run, isActive } = useInFlight(),
    toast = useToast(),
    fail = useActionFailure(),
    saving = isActive("budget");
  const f = view.fields;
  const commit = (k: BudgetAmount) => {
    const text = typed[k];
    if (text === undefined) return;
    setTyped((t) => ({ ...t, [k]: undefined }));
    const n = Number(text);
    if (text.trim() === "" || !Number.isFinite(n)) return;
    setD((s) => recalc(s, k, n));
  };
  const save = () => {
    setTouched(true);
    if (!d.start || !d.end) return toast.show("error", view.texts.required);
    run(async () => {
      const result = await awards.saveBudgetPeriod(view.awardId, {
        key: d.key,
        start: d.start,
        end: d.end,
        direct: d.direct,
        indirect: d.indirect,
        sponsor: d.sponsor,
        institution: d.institution,
        total: d.total,
      });
      if (!result.ok) return fail(result.error);
      toast.show("success", view.texts.saved);
      onSaved();
    }, "budget");
  };
  return (
    <ActionDialog
      id="award-budget-dialog"
      title={view.texts.title}
      width="83.333vw" /* legacy dialogAwardbudgetEdit oj-md-10 */
      busy={saving}
      onClose={onClose}
    >
      <div className={dialog.convert}>
        {f.type.show && (
          <label className={`gn-field ${dialog.cell}`}>
            <span className="gn-label">
              {f.type.label}
              <HelpButton id="award-budget-type-help" html={f.type.help} />
            </span>
            <input
              id="award-budget-type"
              className="gn-control"
              value={d.type}
              readOnly
            />
          </label>
        )}
        {(["start", "end"] as const).map(
          (k) =>
            f[k].show && (
              <div key={k} className={`gn-field ${dialog.cell}`}>
                <span className="gn-label">
                  <span aria-hidden="true">{f[k].label} *</span>
                  <HelpButton id={`award-budget-${k}-help`} html={f[k].help} />
                </span>
                <DateInput
                  id={`award-budget-${k}`}
                  label={f[k].label}
                  value={d[k]}
                  min={
                    k === "start"
                      ? view.award.start || undefined
                      : periodBound(
                          view.award.start,
                          d.start,
                          true,
                          view.award.end,
                        ) || undefined
                  }
                  max={
                    k === "start"
                      ? periodBound(
                          view.award.end,
                          d.end,
                          false,
                          view.award.start,
                        ) || undefined
                      : view.award.end || undefined
                  }
                  disabled={saving}
                  invalid={touched && !d[k]}
                  onChange={(v) => setD((s) => ({ ...s, [k]: v }))}
                />
              </div>
            ),
        )}
        {AMOUNTS.map(
          (k) =>
            f[k].show && (
              <label key={k} className={`gn-field ${dialog.cell}`}>
                <span className="gn-label">
                  {f[k].label}
                  {f[k].required ? " *" : ""}
                  <HelpButton id={`award-budget-${k}-help`} html={f[k].help} />
                </span>
                <input
                  id={`award-budget-${k}`}
                  className="gn-control"
                  type="number"
                  step="any"
                  min={k === "institution" ? undefined : 0}
                  max={k === "institution" ? d.total : undefined}
                  value={typed[k] ?? String(Math.round(d[k] * 100) / 100)}
                  disabled={saving}
                  onChange={(e) =>
                    setTyped((t) => ({ ...t, [k]: e.target.value }))
                  }
                  onBlur={() => commit(k)}
                  onKeyDown={(e) => e.key === "Enter" && commit(k)}
                />
              </label>
            ),
        )}
        <div className={dialog.foot}>
          <button
            type="button"
            id="award-budget-cancel"
            className="gn-btn gn-btn--outlined"
            disabled={saving}
            onClick={onClose}
          >
            {view.texts.cancel}
          </button>
          <button
            type="button"
            id="award-budget-save"
            className="gn-btn gn-btn--primary"
            disabled={saving}
            onClick={save}
          >
            {view.texts.save}
          </button>
        </div>
      </div>
    </ActionDialog>
  );
}
