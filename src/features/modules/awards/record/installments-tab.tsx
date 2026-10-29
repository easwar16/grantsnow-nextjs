"use client";
import { Fragment, useState, useSyncExternalStore } from "react";
import { Icon } from "@/components/ui/icon";
import { DataTable } from "@/components/ui/data-table";
import { StatusBadge } from "@/components/ui/status-badge";
import { Collapsible } from "@/components/ui/collapsible";
import { HelpButton } from "@/components/ui/help-button";
import { Select } from "@/components/ui/select";
import { DateInput } from "@/components/ui/date-input";
import { ActionDialog, useConfirm } from "@/components/dialog/action-dialog";
import {
  STATUSES,
  balance,
  buildInstallments,
  funderTotal,
  installmentTotal,
  parseInstallments,
  maxValue,
  minAmount,
  progress,
  saveInstallments,
  storedInstallments,
  type Amounts,
  type Installment,
  type InstallmentRow,
} from "./installments-model";
import type { InstallmentsView } from "./installments-types";
import type { Money } from "./projects-tab";
import styles from "./tabs.module.css";
import own from "./installments.module.css";
import { functions } from "@/lib/functions";

/** A draft in the dialog: `index` -1 for a new installment (legacy draftInstallment). */
type Draft = Installment & { index: number };
const NEW: Draft = {
  index: -1,
  title: null,
  mode: "AMOUNT",
  amount: null,
  pct: null,
  due_date: null,
  status: "INITIATED",
};
const noStore = () => () => {};
const percent = (n: number, decimals?: number | null) =>
  `${(n * 100).toFixed(decimals ?? 2)}%`;

/**
 * The Installments tab (legacy awards-installments, kept as is): installments live in this browser tab only, each
 * prorated over the award's cost lines. Nothing reaches the backend.
 */
export function InstallmentsTab({
  view,
  format,
}: {
  view: InstallmentsView;
  format?: Money;
}) {
  const { lines, decimals, texts: t } = view;
  const money = (n: number) =>
    functions.format.moneyDisplay(String(n), format?.currency, format);
  // The tab's session exists only in the browser: null on the server, the stored text once hydrated.
  const stored = useSyncExternalStore(
      noStore,
      () => storedInstallments(view.awardId),
      () => null,
    ),
    [edited, setEdited] = useState<Installment[] | null>(null),
    [draft, setDraft] = useState<Draft | null>(null),
    confirm = useConfirm("award-installment-delete");
  const list = edited ?? (stored === null ? null : parseInstallments(stored));
  if (list === null) return null;
  const commit = (next: Installment[]) => {
    setEdited(next);
    saveInstallments(view.awardId, next);
  };
  const left = balance(lines, list, decimals);
  const bar = progress(lines, list, decimals);
  const sections = buildInstallments(lines, view.projects, list, decimals);
  const remove = async (index: number) => {
    const ok = await confirm.ask({
      title: t.deleteTitle,
      message: t.deleteMessage,
      confirm: t.deleteYes,
      cancel: t.deleteNo,
      danger: true,
    });
    if (ok) commit(list.filter((_, i) => i !== index));
  };
  // The four amount columns of a section, category, item or project total, formatted.
  const values = (r: Amounts) =>
    [
      money(r.sponsor_contribution),
      percent(r.share_pct, decimals),
      money(r.installment_amount),
      money(r.remaining_balance),
    ] as const;
  return (
    <div id="award-record-installments" className={styles.tab}>
      {list.length > 0 && (
        <div id="award-installments-progress" className={own.progress}>
          <div className={own.track}>
            {bar.segments.map((s) => (
              <div
                key={s.index}
                className={own.segment}
                data-tone={s.status.tone}
                style={{ width: s.width }}
                title={[s.title, s.status.label].filter(Boolean).join(" - ")}
              />
            ))}
          </div>
          <div className={own.legend}>
            {bar.legend.map((s) => (
              <span key={s.value}>
                <span className={own.swatch} data-tone={s.tone} />
                {`${s.label} (${s.count})`}
              </span>
            ))}
          </div>
        </div>
      )}
      <div id="award-installments-summary" className={own.summary}>
        <label className={styles.startField}>
          <span>{t.funderTotal}</span>
          <input
            id="award-installments-funder-total"
            className="gn-control"
            readOnly
            value={money(funderTotal(lines))}
          />
        </label>
        <label className={styles.startField}>
          <span>{t.balance}</span>
          <input
            id="award-installments-balance"
            className="gn-control"
            readOnly
            value={money(left)}
          />
        </label>
      </div>
      <div className={own.actions}>
        {/* No balance left: an installment must be reduced first to release funds. */}
        <button
          type="button"
          id="award-installments-new"
          className="gn-btn gn-btn--primary"
          disabled={!view.canEdit || left <= 0}
          onClick={() => setDraft(NEW)}
        >
          <Icon name="plus" size={14} />
          {t.newInstallment}
        </button>
        {list.length > 0 && left <= 0 && (
          <span id="award-installments-no-balance" className={own.hint}>
            {t.noBalance}
          </span>
        )}
      </div>
      {list.length === 0 && (
        <p id="award-installments-empty" className={own.empty}>
          {t.noData}
        </p>
      )}
      {sections.map((s) => {
        const key = `award-installment-${s.index}`;
        return (
          <Collapsible
            key={`${s.index}:${list.length}`}
            id={key}
            className={`${styles.collapsible} ${own.installment}`}
            // Legacy: only the newest installment starts open.
            defaultOpen={s.index === list.length - 1}
            heading={
              <span className={own.header}>
                <span className={own.title}>{s.installment.title}</span>
                {/* Legacy: Overdue is the solid danger badge, so it reads apart from Blocked. */}
                <StatusBadge
                  tone={s.status.tone === "overdue" ? "danger" : s.status.tone}
                  solid={s.status.tone === "overdue"}
                >
                  {s.status.label}
                </StatusBadge>
                <span className={own.spacer} />
                {s.installment.due_date && (
                  <span className={own.hint}>
                    {functions.format.dateDisplay(
                      s.installment.due_date,
                      format,
                    )}
                  </span>
                )}
                <span className={own.total}>{money(s.total)}</span>
                {view.canEdit && s.status.editable && (
                  <>
                    <button
                      type="button"
                      id={`${key}-edit`}
                      className="gn-btn gn-btn--borderless gn-btn--icon"
                      aria-label={`${t.edit} ${s.installment.title ?? ""}`}
                      title={t.edit}
                      onClick={(e) => {
                        e.stopPropagation();
                        setDraft({ ...s.installment, index: s.index });
                      }}
                    >
                      <Icon name="edit" size={14} />
                    </button>
                    <button
                      type="button"
                      id={`${key}-delete`}
                      className="gn-btn gn-btn--borderless gn-btn--icon"
                      aria-label={`${t.delete} ${s.installment.title ?? ""}`}
                      title={t.delete}
                      onClick={(e) => {
                        e.stopPropagation();
                        void remove(s.index);
                      }}
                    >
                      <Icon name="trash" size={14} />
                    </button>
                  </>
                )}
              </span>
            }
          >
            {s.projects.map((p) => (
              <Collapsible
                key={p.project_id}
                id={`${key}-project-${p.project_id}`}
                className={styles.collapsible}
                heading={<span className={own.projectTitle}>{p.title}</span>}
              >
                <InstallmentTable
                  id={`${key}-project-${p.project_id}-table`}
                  view={view}
                  rows={p.sections}
                  total={p}
                  values={values}
                />
              </Collapsible>
            ))}
          </Collapsible>
        );
      })}
      {draft && (
        <InstallmentDialog
          view={view}
          list={list}
          draft={draft}
          money={money}
          onClose={() => setDraft(null)}
          onSave={(saved) => {
            const { index, ...installment } = saved;
            // Only the chosen mode's value is kept, so a stale one cannot come back on a later mode switch.
            const kept = {
              ...installment,
              amount:
                installment.mode === "PERCENT" ? null : installment.amount,
              pct: installment.mode === "PERCENT" ? installment.pct : null,
            };
            commit(
              index >= 0
                ? list.map((i, n) => (n === index ? kept : i))
                : [...list, kept],
            );
            setDraft(null);
          }}
        />
      )}
      {confirm.element}
    </div>
  );
}

/** One project's table: funding section > cost category > item, every level open, as legacy's AllKeySet. */
function InstallmentTable({
  id,
  view,
  rows,
  total,
  values,
}: {
  id: string;
  view: InstallmentsView;
  rows: InstallmentRow[];
  total: Amounts;
  values: (r: Amounts) => readonly string[];
}) {
  const t = view.texts;
  // Sections and categories (depth 0 and 1) are bold, as legacy's node rows.
  const strong = (depth: number, v: string) =>
    depth < 2 ? <span className={styles.strong}>{v}</span> : v;
  const amount = (i: number, header: string) => ({
    id: `amount-${i}`,
    header,
    align: "end" as const,
    cell: (r: InstallmentRow, depth: number) => strong(depth, values(r)[i]),
    footer: strong(0, values(total)[i]),
  });
  return (
    <DataTable
      id={id}
      height="tall"
      columns={[
        {
          id: "item",
          header: t.costItem,
          cell: (r, depth) =>
            depth < 2 ? (
              <span className={styles.nodeName}>{r.name}</span>
            ) : (
              r.name
            ),
          footer: t.total,
        },
        amount(0, t.funderContribution),
        amount(1, t.share),
        amount(2, t.amount),
        amount(3, t.remaining),
      ]}
      rows={rows}
      rowKey={(r) => r.key}
      childrenOf={(r) => r.children}
      rowLabel={(r) => r.name}
      // Measured text starts: section 30px, category 49px, item 60px from the cell edge (12px padding, 18px expander).
      indent={(depth, leaf) => (leaf && depth > 1 ? "30px" : `${depth * 19}px`)}
      empty={t.tableNoData}
    />
  );
}

/** Legacy dlgInstallment: works on a copy; Save validates and commits it. */
function InstallmentDialog({
  view,
  list,
  draft: initial,
  money,
  onClose,
  onSave,
}: {
  view: InstallmentsView;
  list: Installment[];
  draft: Draft;
  money: (n: number) => string;
  onClose: () => void;
  onSave: (draft: Draft) => void;
}) {
  const { lines, decimals, fields: f, texts: t } = view;
  const [d, setD] = useState(initial),
    [typed, setTyped] = useState<string | null>(null),
    [touched, setTouched] = useState(false);
  const total = funderTotal(lines);
  const left = balance(lines, list, decimals, d.index);
  const amount = installmentTotal(d, total, decimals);
  const pctMode = d.mode === "PERCENT";
  const min = pctMode ? minAmount(decimals) / 100 : minAmount(decimals);
  const max = maxValue(lines, list, decimals, d.index, d.mode);
  const value = pctMode ? d.pct : d.amount;
  const outOfRange = value !== null && (value < min || value > max);
  const missing = {
    title: f.title.show && f.title.required && !d.title?.trim(),
    dueDate: f.dueDate.show && f.dueDate.required && !d.due_date,
    value: f.value.show && f.value.required && value === null,
  };
  const invalid = {
    title: touched && missing.title,
    dueDate: touched && missing.dueDate,
    value: touched && (missing.value || outOfRange),
  };
  const save = () => {
    setTouched(true);
    if (missing.title || missing.dueDate || missing.value || outOfRange) return;
    onSave(d);
  };
  const shown =
    typed ?? (value === null ? "" : String(pctMode ? value * 100 : value));
  const setValue = (text: string) => {
    setTyped(text);
    const n = Number(text);
    const next = text.trim() === "" || !Number.isFinite(n) ? null : n;
    setD((s) =>
      pctMode
        ? { ...s, pct: next === null ? null : next / 100 }
        : { ...s, amount: next },
    );
  };
  const labelOf = (
    field: InstallmentsView["fields"][keyof InstallmentsView["fields"]],
    key: string,
  ) => (
    <span>
      {field.label}
      {field.required ? " *" : ""}
      <HelpButton id={`award-installment-${key}-help`} html={field.help} />
    </span>
  );
  return (
    <ActionDialog
      id="award-installment-dialog"
      title={d.index >= 0 ? t.editTitle : t.newTitle}
      width="50vw" /* legacy dlgInstallment oj-md-6 */
      onClose={onClose}
    >
      <div className={own.form}>
        {f.title.show && (
          <label className={styles.startField}>
            {labelOf(f.title, "title")}
            <input
              id="award-installment-title"
              className="gn-control"
              value={d.title ?? ""}
              aria-invalid={invalid.title || undefined}
              required={f.title.required}
              onChange={(e) => setD((s) => ({ ...s, title: e.target.value }))}
            />
          </label>
        )}
        {f.dueDate.show && (
          <div className={styles.startField}>
            {labelOf(f.dueDate, "due-date")}
            <DateInput
              id="award-installment-due-date"
              label={f.dueDate.label}
              value={d.due_date ?? ""}
              required={f.dueDate.required}
              invalid={invalid.dueDate}
              onChange={(v) => setD((s) => ({ ...s, due_date: v || null }))}
            />
          </div>
        )}
        {f.type.show && (
          <div className={styles.startField}>
            {labelOf(f.type, "type")}
            <div
              id="award-installment-type"
              role="radiogroup"
              aria-label={f.type.label}
              className={own.radios}
            >
              {(["AMOUNT", "PERCENT"] as const).map((mode) => (
                <label key={mode}>
                  <input
                    id={`award-installment-type-${mode.toLowerCase()}`}
                    type="radio"
                    name="award-installment-type"
                    checked={d.mode === mode}
                    onChange={() => {
                      setTyped(null);
                      setD((s) => ({ ...s, mode }));
                    }}
                  />
                  {mode === "AMOUNT" ? t.typeAmount : t.typePercent}
                </label>
              ))}
            </div>
          </div>
        )}
        {f.value.show && (
          <label className={styles.startField}>
            {labelOf(f.value, "value")}
            <span className={own.valueCell}>
              <input
                id="award-installment-value"
                className="gn-control"
                type="number"
                step="any"
                min={pctMode ? min * 100 : min}
                max={pctMode ? max * 100 : max}
                value={shown}
                aria-invalid={invalid.value || undefined}
                aria-describedby={
                  invalid.value && outOfRange
                    ? "award-installment-value-error"
                    : undefined
                }
                onChange={(e) => setValue(e.target.value)}
                onBlur={() => setTyped(null)}
              />
              {invalid.value && outOfRange && (
                <span
                  id="award-installment-value-error"
                  className={own.error}
                  role="alert"
                >
                  {pctMode
                    ? `Enter a value between ${percent(min, decimals)} and ${percent(max, decimals)}.`
                    : `Enter a value between ${money(min)} and ${money(max)}.`}
                </span>
              )}
            </span>
          </label>
        )}
        {f.status.show && (
          <div className={styles.startField}>
            {labelOf(f.status, "status")}
            <Select
              id="award-installment-status"
              label={f.status.label}
              options={STATUSES.map((s) => ({
                value: s.value,
                label: s.label,
              }))}
              value={d.status}
              clearable={false}
              onChange={(status) => setD((s) => ({ ...s, status }))}
            />
          </div>
        )}
        <label className={styles.startField}>
          <span>{t.balance}</span>
          <input
            id="award-installment-balance"
            className="gn-control"
            readOnly
            value={money(left)}
          />
        </label>
        <label className={styles.startField}>
          <span>{t.installmentTotal}</span>
          <input
            id="award-installment-total"
            className="gn-control"
            readOnly
            value={money(amount)}
          />
        </label>
        <label className={styles.startField}>
          <span>{t.remainingAfter}</span>
          <input
            id="award-installment-remaining"
            className="gn-control"
            readOnly
            value={money(left - amount)}
          />
        </label>
      </div>
      <div className={own.foot}>
        <button
          type="button"
          id="award-installment-cancel"
          className="gn-btn gn-btn--outlined"
          onClick={onClose}
        >
          {t.cancel}
        </button>
        <button
          type="button"
          id="award-installment-save"
          className="gn-btn gn-btn--primary"
          onClick={save}
        >
          {t.save}
        </button>
      </div>
    </ActionDialog>
  );
}
