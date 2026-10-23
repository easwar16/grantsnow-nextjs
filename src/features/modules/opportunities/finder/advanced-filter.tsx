"use client";
import { DateInput, pickerOpen } from "@/components/ui/date-input";
import { idPart } from "@/lib/ids";
import { useEffect, useRef, useState } from "react";
import { Icon } from "@/components/ui/icon";
import { Pop } from "@/components/ui/pop";
import { MultiSelect } from "@/components/ui/multi-select";
import { Select } from "@/components/ui/select";
import type { FinderContext } from "@/server/modules/opportunities/service";
import {
  cleared,
  type DateFilter,
  type DateOp,
  type FinderFilters,
} from "./state";
import styles from "./advanced-filter.module.css";
type DateField = "publication" | "opening" | "closing";
const DATES: DateField[] = ["publication", "opening", "closing"];
const KEY_SEP = "\u001f";
// The popup still works when FILTER_OPERATOR fails to load: Between is the default operator.
const FALLBACK_OPS = [{ value: "BETWEEN", label: "Between" }];
/**
 * The advanced filter popup, anchored under the search box. It edits a draft of the finder's one filter state and
 * hands it back on Filter; Clear resets all but sort and match mode and leaves the popup open.
 */
export function AdvancedFilter({
  filters,
  context,
  onApply,
  onClear,
  onClose,
}: {
  filters: FinderFilters;
  context: Pick<FinderContext, "labels" | "gates" | "options">;
  onApply: (draft: FinderFilters) => void;
  onClear: () => void;
  onClose: () => void;
}) {
  const { labels: t, gates, options } = context;
  const [draft, setDraft] = useState(() => structuredClone(filters));
  const host = useRef<HTMLDivElement>(null);
  const set = (patch: Partial<FinderFilters>) =>
    setDraft((d) => ({ ...d, ...patch }));
  useEffect(() => {
    host.current?.querySelector<HTMLElement>("input, select")?.focus();
  }, []);
  useEffect(() => {
    // An Escape a field inside already handled (closing its own dropdown) leaves the popup open.
    const escape = (e: KeyboardEvent) =>
      e.key === "Escape" &&
      !e.defaultPrevented &&
      !pickerOpen(host.current) &&
      onClose();
    const outside = (e: PointerEvent) => {
      const target = e.target as HTMLElement;
      // The multi-select's own list sits inside the popup; the toggle button handles itself.
      if (
        !host.current?.contains(target) &&
        !target.closest("[data-advanced-toggle]")
      )
        onClose();
    };
    document.addEventListener("keydown", escape);
    document.addEventListener("pointerdown", outside);
    return () => {
      document.removeEventListener("keydown", escape);
      document.removeEventListener("pointerdown", outside);
    };
  }, [onClose]);
  // Funders, not sites: the popup lists getOppFunders rows (value + site), as fundersListADP does.
  const funderOptions = options.funders
    .filter((r) => r.value !== r.site)
    .map((r) => ({ value: r.site + KEY_SEP + r.value, label: r.value }));
  const selectedFunders = draft.funders
    .filter((k) => k.funder !== null)
    .map((k) => k.site + KEY_SEP + k.funder);
  const operators = options.operators.length ? options.operators : FALLBACK_OPS;
  const dateLabel = (field: DateField, suffix: "Filter" | "" | "From" | "To") =>
    t[`${field}${suffix}` as keyof typeof t];
  const setDate = (field: DateField, patch: Partial<DateFilter>) =>
    setDraft((d) => ({ ...d, [field]: { ...d[field], ...patch } }));
  const amount = (raw: string) =>
    raw === "" ? null : Math.max(0, Number(raw));
  const blank = <span className={styles.cell} />;
  function apply(event: React.FormEvent) {
    event.preventDefault();
    // Only a listed code can be applied, as the original's select-single.
    onApply({
      ...draft,
      call: options.callCodes.includes(draft.call) ? draft.call : "",
    });
  }
  return (
    <Pop
      ref={host}
      id="advanced-filter"
      className={styles.popup}
      role="dialog"
      aria-label={t.advanced}
    >
      <form
        id="advanced-filter-form"
        className={styles.form}
        onSubmit={apply}
        noValidate
      >
        {(gates.keyword || gates.advFunders) && (
          <div className={styles.row}>
            {gates.keyword && (
              <label className={`gn-field ${styles.cell}`}>
                <span className="gn-label">{t.keyword}</span>
                <input
                  id="advanced-filter-keyword"
                  className="gn-control"
                  value={draft.search}
                  maxLength={200}
                  onChange={(e) => set({ search: e.target.value })}
                />
              </label>
            )}
            {gates.advFunders && (
              <div className={`gn-field ${styles.cell}`}>
                <span className="gn-label" aria-hidden="true">
                  {t.advFunders}
                </span>
                <MultiSelect
                  id="advanced-filter-funders"
                  variant="control"
                  label={t.advFunders}
                  options={funderOptions}
                  value={selectedFunders}
                  onChange={(keys) =>
                    set({
                      funders: [
                        ...draft.funders.filter((k) => k.funder === null),
                        ...keys.map((k) => {
                          const [site, funder] = k.split(KEY_SEP);
                          return { site, funder };
                        }),
                      ],
                    })
                  }
                />
              </div>
            )}
            {blank}
          </div>
        )}
        {/* One row per date: its operator, then the date (Greater / Less Than) or the From – To pair (Between). */}
        {DATES.filter((field) => gates[field]).map((field) => {
          const d = draft[field];
          return (
            <div key={field} className={styles.row}>
              <label className={`gn-field ${styles.cell}`}>
                <span className="gn-label">{dateLabel(field, "Filter")}</span>
                <Select
                  id={`advanced-filter-${field}-op`}
                  label={dateLabel(field, "Filter")}
                  options={operators}
                  value={d.op}
                  clearable={false}
                  // filterOperatorChanged: a new operator clears that field's dates.
                  onChange={(op) =>
                    setDate(field, {
                      op: op as DateOp,
                      on: "",
                      from: "",
                      to: "",
                    })
                  }
                />
              </label>
              {d.op === "GT" || d.op === "LT" ? (
                <>
                  <div className={`gn-field ${styles.cell}`}>
                    <span className="gn-label" aria-hidden="true">
                      {dateLabel(field, "")}
                    </span>
                    <DateInput
                      id={`advanced-filter-${field}-date`}
                      label={dateLabel(field, "")}
                      value={d.on}
                      onChange={(on) => setDate(field, { on })}
                    />
                  </div>
                  {blank}
                </>
              ) : d.op === "BETWEEN" ? (
                <>
                  <div className={`gn-field ${styles.cell}`}>
                    <span className="gn-label" aria-hidden="true">
                      {dateLabel(field, "From")}
                    </span>
                    <DateInput
                      id={`advanced-filter-${field}-from`}
                      label={dateLabel(field, "From")}
                      value={d.from}
                      max={d.to || undefined}
                      onChange={(from) => setDate(field, { from })}
                    />
                  </div>
                  <div className={`gn-field ${styles.cell}`}>
                    <span className="gn-label" aria-hidden="true">
                      {dateLabel(field, "To")}
                    </span>
                    <DateInput
                      id={`advanced-filter-${field}-to`}
                      label={dateLabel(field, "To")}
                      value={d.to}
                      min={d.from || undefined}
                      onChange={(to) => setDate(field, { to })}
                    />
                  </div>
                </>
              ) : (
                <>
                  {blank}
                  {blank}
                </>
              )}
            </div>
          );
        })}
        {(gates.totalFund || gates.callCode) && (
          <div className={styles.row}>
            {gates.totalFund ? (
              <>
                <label className={`gn-field ${styles.cell}`}>
                  <span className="gn-label">{t.totalFundFrom}</span>
                  <input
                    id="advanced-filter-total-fund-from"
                    className="gn-control"
                    type="number"
                    min={0}
                    value={draft.totalFundFrom ?? ""}
                    onChange={(e) =>
                      set({ totalFundFrom: amount(e.target.value) })
                    }
                  />
                </label>
                <label className={`gn-field ${styles.cell}`}>
                  <span className="gn-label">{t.to}</span>
                  <input
                    id="advanced-filter-total-fund-to"
                    className="gn-control"
                    type="number"
                    min={0}
                    value={draft.totalFundTo ?? ""}
                    onChange={(e) =>
                      set({ totalFundTo: amount(e.target.value) })
                    }
                  />
                </label>
              </>
            ) : (
              <>
                {blank}
                {blank}
              </>
            )}
            {gates.callCode ? (
              <div className={`gn-field ${styles.cell}`}>
                <span className="gn-label" aria-hidden="true">
                  {t.callCode}
                </span>
                <Select
                  id="advanced-filter-call-code"
                  label={t.callCode}
                  options={options.callCodes.map((c) => ({
                    value: c,
                    label: c,
                  }))}
                  value={draft.call}
                  onChange={(call) => set({ call })}
                />
              </div>
            ) : (
              blank
            )}
          </div>
        )}
        {(gates.aln || gates.fon || gates.costSharing) && (
          <div className={styles.row}>
            {(
              [
                ["aln", gates.aln, t.aln, "aln"],
                ["fon", gates.fon, t.fon, "fon"],
                [
                  "costSharing",
                  gates.costSharing,
                  t.costSharing,
                  "cost-sharing",
                ],
              ] as const
            ).map(([key, shown, text, name]) =>
              shown ? (
                <label key={key} className={`gn-field ${styles.cell}`}>
                  <span className="gn-label">{text}</span>
                  <input
                    id={`advanced-filter-${name}`}
                    className="gn-control"
                    value={draft[key]}
                    maxLength={150}
                    onChange={(e) => set({ [key]: e.target.value })}
                  />
                </label>
              ) : (
                <span key={key} className={styles.cell} />
              ),
            )}
          </div>
        )}
        {gates.advStatus && options.status.length > 0 && (
          <fieldset id="advanced-filter-status" className={styles.status}>
            <legend className="gn-label">{t.advStatus}</legend>
            <div className={styles.checks}>
              {options.status.map((s) => (
                <label key={s.value}>
                  <input
                    id={`advanced-filter-status-${idPart(s.value)}`}
                    className="gn-check"
                    type="checkbox"
                    checked={draft.status.includes(s.value)}
                    onChange={(e) =>
                      set({
                        status: e.target.checked
                          ? [...draft.status, s.value]
                          : draft.status.filter((v) => v !== s.value),
                      })
                    }
                  />
                  {s.label}
                </label>
              ))}
            </div>
          </fieldset>
        )}
        <div className={styles.foot}>
          <button
            id="advanced-filter-apply"
            type="submit"
            className="gn-btn gn-btn--outlined"
          >
            <Icon name="filter" size={14} />
            {t.filter}
          </button>
          <button
            id="advanced-filter-clear"
            type="button"
            className="gn-btn gn-btn--solid"
            onClick={() => {
              setDraft((d) => cleared(d));
              onClear();
            }}
          >
            <Icon name="reset-filters" size={14} />
            {t.advClear}
          </button>
        </div>
      </form>
    </Pop>
  );
}
