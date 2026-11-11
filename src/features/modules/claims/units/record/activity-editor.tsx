"use client";
import { useState } from "react";
import { ActionDialog } from "@/components/dialog/action-dialog";
import { useActionFailure } from "@/components/dialog/action-failure";
import { FormSkeleton } from "@/components/feedback/skeleton";
import { State } from "@/components/feedback/state";
import { useToast } from "@/components/feedback/toast";
import { DataTable } from "@/components/ui/data-table";
import { Icon } from "@/components/ui/icon";
import { InsideField } from "@/components/ui/inside-field";
import { MultiSelect } from "@/components/ui/multi-select";
import { ReadonlyField } from "@/components/ui/readonly-field";
import { Select } from "@/components/ui/select";
import { claims, useApi } from "@/lib/api";
import { useInFlight } from "@/lib/hooks/use-in-flight";
import {
  itemAmountOf,
  itemRateOf,
  itemsTotal,
  lineAmountOf,
  positionAmounts,
  totalSalaryOf,
  type PositionFigures,
} from "@/shared/claims/activity-calc";
import type {
  UnitActivityDraft,
  UnitActivityEditView,
  UnitCostDraft,
} from "../listing/types";
import styles from "./summary.module.css";

type Money = (v: number | null) => string;
const ID = "claims-unit-activity-edit";
/** `fte_code == 2` is a lump-sum position (Stipend): three typed amounts, no position details. */
const LUMP_SUM = "2";
const num = (v: string) => (v === "" ? null : Number(v));

/**
 * Add / Edit Activity (legacy record drawer in edit mode: addNewActivity / editActivity, saveActivity). The setup
 * comes from the server with the fund's codes and lists; the save is checked there again.
 */
export function ActivityEditor({
  appId,
  fund,
  activity,
  version,
  amendment,
  money,
  onSaved,
  onCancel,
}: {
  appId: string;
  fund: string;
  /** Empty for a new activity. */
  activity: string;
  version: string;
  /** Add Activity in an amendment: its reason, and its key once minted. */
  amendment?: { key: string; reason: string };
  money: Money;
  onSaved: (activity: string, version: string, amendment: string) => void;
  onCancel: () => void;
}) {
  const read = useApi(claims.activityEdit, {
    appId,
    fund,
    activity,
    version,
    ...(amendment?.key ? { amendment: amendment.key } : {}),
    ...(amendment && !activity ? { reason: amendment.reason } : {}),
  });
  if (read.error)
    return (
      <State
        id={`${ID}-error`}
        title="Couldn't open the activity form"
        message={read.error.message}
        retry={read.retry}
      />
    );
  if (!read.data) return <FormSkeleton label="Loading the activity form" />;
  return (
    <EditorForm
      appId={appId}
      view={read.data}
      amendment={amendment}
      money={money}
      onSaved={onSaved}
      onCancel={onCancel}
    />
  );
}

function figuresOf(d: UnitActivityDraft): PositionFigures {
  const base = baseFigures(d);
  const total = totalSalaryOf(base);
  return {
    ...base,
    items: d.items.map((i) => ({
      type: i.type,
      amount: lineAmountOf(total, i.method, num(i.rate), num(i.amount)),
    })),
  };
}
function baseFigures(d: UnitActivityDraft): PositionFigures {
  return {
    salaryType: d.salaryType,
    totalSalary: num(d.totalSalary),
    deductSalary: num(d.deductSalary),
    hourlyRate: num(d.hourlyRate),
    hoursPerDay: num(d.hoursPerDay),
    daysPerYear: num(d.daysPerYear),
    salaryPercent: num(d.salaryPercent),
    deductBenefit: num(d.deductBenefit),
    benefitPercent: num(d.benefitPercent),
    deductService: num(d.deductService),
    servicePercent: num(d.servicePercent),
    items: d.items.map((i) => ({ type: i.type, amount: num(i.amount) })),
  };
}

function EditorForm({
  appId,
  view,
  amendment,
  money,
  onSaved,
  onCancel,
}: {
  appId: string;
  view: UnitActivityEditView;
  amendment?: { key: string; reason: string };
  money: Money;
  onSaved: (activity: string, version: string, amendment: string) => void;
  onCancel: () => void;
}) {
  const [d, setD] = useState<UnitActivityDraft>(view.draft),
    [line, setLine] = useState<UnitCostDraft | null>(null);
  const toast = useToast(),
    fail = useActionFailure(),
    { run, isActive } = useInFlight();
  const busy = isActive("save");
  const l = view.labels,
    x = view.texts;
  const set = <K extends keyof UnitActivityDraft>(
    k: K,
    v: UnitActivityDraft[K],
  ) => setD((s) => ({ ...s, [k]: v }));
  const position = d.type === "POSITION",
    lump = position && d.fte === LUMP_SUM,
    detailed = position && d.fte !== "" && !lump;
  const amounts = positionAmounts(figuresOf(d));
  const save = () =>
    void run(async () => {
      const result = await claims.saveActivity(appId, {
        fund: view.fund,
        ...(view.activity
          ? { activity: view.activity, version: view.version }
          : {}),
        // The amendment context travels with every save; a new activity also carries its reason.
        ...(amendment?.key ? { amendment: amendment.key } : {}),
        ...(amendment && !view.activity ? { reason: amendment.reason } : {}),
        draft: d,
      });
      if (!result.ok) return fail(result.error);
      if (result.data.info)
        toast.show("info", result.data.info.summary, result.data.info.message);
      if (result.data.warning)
        toast.show(
          "warning",
          result.data.warning.summary,
          result.data.warning.message,
        );
      onSaved(result.data.activity, result.data.version, result.data.amendment);
    }, "save");

  const text = (
    key: keyof UnitActivityDraft,
    rbKey: string,
    required = false,
    multiline = false,
  ) => {
    const fieldId = `${ID}-${rbKey}`;
    const value = d[key] as string;
    return (
      <InsideField
        htmlFor={fieldId}
        label={l[rbKey]}
        filled={value !== ""}
        required={required}
        multiline={multiline}
      >
        {multiline ? (
          <textarea
            id={fieldId}
            value={value}
            disabled={busy}
            onChange={(e) => set(key, e.target.value)}
          />
        ) : (
          <input
            id={fieldId}
            value={value}
            disabled={busy}
            onChange={(e) => set(key, e.target.value)}
          />
        )}
      </InsideField>
    );
  };
  const number = (
    key: keyof UnitActivityDraft,
    rbKey: string,
    required = false,
  ) => {
    const fieldId = `${ID}-${rbKey}`;
    const value = d[key] as string;
    return (
      <InsideField
        htmlFor={fieldId}
        label={l[rbKey]}
        filled={value !== ""}
        required={required}
      >
        <input
          id={fieldId}
          type="number"
          step="any"
          value={value}
          disabled={busy}
          onChange={(e) => set(key, e.target.value)}
        />
      </InsideField>
    );
  };
  const choice = (
    key: keyof UnitActivityDraft,
    rbKey: string,
    options: { value: string; label: string }[],
    onPick: (v: string) => void = (v) => set(key, v),
    required = false,
  ) => {
    const fieldId = `${ID}-${rbKey}`;
    return (
      <InsideField
        htmlFor={`${fieldId}-trigger`}
        label={l[rbKey]}
        filled={d[key] !== ""}
        required={required}
      >
        <Select
          id={fieldId}
          label={l[rbKey]}
          options={options}
          value={d[key] as string}
          disabled={busy}
          onChange={onPick}
        />
      </InsideField>
    );
  };
  const periods = Array.from(
    { length: view.periods[d.payFrequency] ?? 0 },
    (_, i) => ({ value: String(i + 1), label: String(i + 1) }),
  );
  const category = (code: string) =>
    view.categories.find((c) => c.code === code);
  const method = (code: string) =>
    view.methods.find((m) => m.value === code)?.label ?? code;
  const lines = (type: UnitCostDraft["type"]) =>
    d.items.filter((i) => i.type === type);

  return (
    <form
      id={ID}
      className={styles.editor}
      onSubmit={(e) => {
        e.preventDefault();
        save();
      }}
    >
      <section className={styles.panelSection}>
        <h3 className={styles.subheading}>{x.general}</h3>
        <div className={styles.editorGrid}>
          <ReadonlyField
            id={`${ID}-fund`}
            label={l["fund-type"]}
            value={view.fundName}
          />
          {view.homeless && (
            <fieldset className={styles.editorRadios}>
              <legend>
                {l.homeless}
                <span aria-hidden="true"> *</span>
              </legend>
              {(["Y", "N"] as const).map((v) => (
                <label key={v}>
                  <input
                    id={`${ID}-homeless-${v.toLowerCase()}`}
                    type="radio"
                    name={`${ID}-homeless`}
                    checked={d.homeless === v}
                    disabled={busy}
                    onChange={() => set("homeless", v)}
                  />
                  {v === "Y" ? x.yes : x.no}
                </label>
              ))}
            </fieldset>
          )}
          {/* Legacy selectHierarchyItem: a new type clears the codes under it; Tuition's object is 200. */}
          {choice(
            "type",
            "activity-type",
            view.types,
            (v) =>
              setD((s) => ({
                ...s,
                type: v,
                func: "",
                object: v === "TUITION" ? "200" : "",
              })),
            true,
          )}
          {d.type !== "" &&
            choice(
              "func",
              "function-code",
              view.functions[d.type] ?? [],
              (v) =>
                setD((s) => ({
                  ...s,
                  func: v,
                  object: s.type === "TUITION" ? "200" : "",
                })),
              true,
            )}
          {d.type !== "" &&
            d.func !== "" &&
            !position &&
            choice(
              "object",
              "object-code",
              view.objects[`${d.type}|${d.func}`] ?? [],
              undefined,
              d.type !== "TUITION",
            )}
          {position && choice("fte", "fte", view.ftes, undefined, true)}
          {!position &&
            d.type !== "" &&
            number(
              "amount",
              d.type === "TUITION" ? "benefits-amount" : "amount",
              d.type !== "TUITION",
            )}
          {lump && (
            <>
              {number("salaryAmount", "salary-amount", true)}
              {number("benefitsAmount", "benefits-amount")}
              {number("purchaseAmount", "purchased-amount")}
            </>
          )}
          {detailed && (
            <>
              <ReadonlyField
                id={`${ID}-salary-total`}
                label={l["salary-amount"]}
                value={money(amounts.salary)}
              />
              <ReadonlyField
                id={`${ID}-benefits-total`}
                label={l["benefits-amount"]}
                value={money(amounts.benefits)}
              />
              <ReadonlyField
                id={`${ID}-purchase-total`}
                label={l["purchased-amount"]}
                value={money(amounts.purchase)}
              />
            </>
          )}
          {position && text("jobTitle", "job-title", true)}
        </div>
        <div className={styles.editorGrid}>
          {position && text("jobDescription", "job-description", true, true)}
          {text("itemization", "itemization", true, true)}
          {view.amending &&
            text("justification", "amendment-justification", true, true)}
        </div>
        <div className={styles.editorWide}>
          <MultiSelect
            id={`${ID}-goals`}
            label={x.goals}
            options={view.goals}
            value={d.goals}
            disabled={busy}
            onChange={(goals) => set("goals", goals)}
          />
        </div>
      </section>
      {detailed && (
        <section className={styles.panelSection}>
          <h3 className={styles.subheading}>{x.position}</h3>
          <div className={styles.editorGrid}>
            {choice("payFrequency", "pay-frequency", view.payFrequencies, (v) =>
              setD((s) => ({ ...s, payFrequency: v, start: "", end: "" })),
            )}
            {d.payFrequency !== "" && (
              <>
                {choice("start", "starting-period", periods, undefined, true)}
                {choice("end", "ending-period", periods, undefined, true)}
              </>
            )}
          </div>
          <h4 className={styles.subheading}>{x.salary}</h4>
          <div className={styles.editorGrid}>
            {/* Legacy salaryTypeChange: Exempt drops the hourly inputs and keeps the salary. */}
            {choice(
              "salaryType",
              "salary-type",
              view.salaryTypes,
              (v) =>
                setD((s) => ({
                  ...s,
                  salaryType: v,
                  ...(v === "EXEMPT"
                    ? { hourlyRate: "", hoursPerDay: "", daysPerYear: "" }
                    : {}),
                })),
              true,
            )}
            {d.salaryType === "HOURLY" ? (
              <>
                {number("hourlyRate", "hourly-rate", true)}
                {number("hoursPerDay", "hours-per-day", true)}
                {number("daysPerYear", "days-per-year", true)}
                <ReadonlyField
                  id={`${ID}-total-salary`}
                  label={l["total-salary"]}
                  value={money(amounts.totalSalary)}
                />
              </>
            ) : (
              number("totalSalary", "total-salary", d.salaryType === "EXEMPT")
            )}
            {number("deductSalary", "deduct-salary")}
            {number("salaryPercent", "salary-percentage", true)}
          </div>
          {(["BENEFIT", "PURCHASE_SERVICE"] as const).map((type) => {
            const benefit = type === "BENEFIT";
            const rows = lines(type);
            const prefix = benefit ? "benefit" : "purchased";
            const heading = benefit ? x.benefit : x.purchase;
            return (
              <div key={type} id={`${ID}-${prefix}`}>
                <div className={styles.editorBar}>
                  <h4 className={styles.subheading}>{heading}</h4>
                  <button
                    type="button"
                    id={`${ID}-${prefix}-add`}
                    className="gn-btn gn-btn--outlined"
                    // A line's amount follows the salary, so the salary comes first (legacy disabled without it).
                    disabled={busy || !amounts.totalSalary}
                    onClick={() =>
                      setLine({
                        key: `N${Date.now()}`,
                        itemId: "",
                        type,
                        category: "",
                        method: "",
                        rate: "",
                        amount: "",
                      })
                    }
                  >
                    <Icon name="plus" size={14} />
                    {benefit ? x.addBenefit : x.addPurchase}
                  </button>
                </div>
                <DataTable
                  id={`${ID}-${prefix}-table`}
                  rowIds={`${ID}-${prefix}-row`}
                  label={heading}
                  rows={rows}
                  rowKey={(r) => r.key}
                  empty="—"
                  columns={[
                    {
                      id: "category",
                      header: view.headers[`${prefix}-category`],
                      rowHeader: true,
                      cell: (r) => category(r.category)?.name ?? r.category,
                      footer: l.total,
                    },
                    {
                      id: "method",
                      header: view.headers[`${prefix}-calculation`],
                      cell: (r) => method(r.method),
                    },
                    {
                      id: "rate",
                      header: view.headers[`${prefix}-rate`],
                      cell: (r) => (r.rate === "" ? "" : `${r.rate}%`),
                    },
                    {
                      id: "amount",
                      header: view.headers[`${prefix}-amount`],
                      cell: (r) =>
                        money(
                          lineAmountOf(
                            amounts.totalSalary,
                            r.method,
                            num(r.rate),
                            num(r.amount),
                          ),
                        ),
                      footer: money(itemsTotal(figuresOf(d).items, type)),
                    },
                  ]}
                  actions={[
                    {
                      id: "edit",
                      icon: "edit",
                      label: (r) =>
                        `${x.edit} ${category(r.category)?.name ?? ""}`,
                      disabled: () => busy,
                      onClick: (r) => setLine(r),
                    },
                    {
                      id: "delete",
                      icon: "trash",
                      label: (r) =>
                        `${x.delete} ${category(r.category)?.name ?? ""}`,
                      disabled: () => busy,
                      onClick: (r) =>
                        set(
                          "items",
                          d.items.filter((i) => i.key !== r.key),
                        ),
                    },
                  ]}
                />
                {/* The percentage and deduction apply to the lines, so they show once there are lines. */}
                <div className={styles.editorGrid}>
                  {rows.length > 0 &&
                    (benefit ? (
                      <>
                        {number("deductBenefit", "deduct-benefit")}
                        {number(
                          "benefitPercent",
                          "benefit-percentage",
                          amounts.totalSalary > 0,
                        )}
                      </>
                    ) : (
                      <>
                        {number("deductService", "deduct-service")}
                        {number(
                          "servicePercent",
                          "service-percentage",
                          amounts.totalSalary > 0,
                        )}
                      </>
                    ))}
                  <ReadonlyField
                    id={`${ID}-${prefix}-total`}
                    label={
                      l[benefit ? "total-benefit" : "total-purchase-service"]
                    }
                    value={money(benefit ? amounts.benefits : amounts.purchase)}
                  />
                </div>
              </div>
            );
          })}
        </section>
      )}
      <div className={styles.editorFoot}>
        <button
          type="button"
          id={`${ID}-cancel`}
          className="gn-btn gn-btn--outlined"
          disabled={busy}
          onClick={onCancel}
        >
          {x.cancel}
        </button>
        <button
          type="submit"
          id={`${ID}-save`}
          className="gn-btn gn-btn--primary"
          disabled={busy}
        >
          {view.activity ? x.update : x.create}
        </button>
      </div>
      {line && (
        <CostLineDialog
          view={view}
          initial={line}
          totalSalary={amounts.totalSalary}
          money={money}
          onClose={() => setLine(null)}
          onApply={(next) => {
            setD((s) => ({
              ...s,
              items: s.items.some((i) => i.key === next.key)
                ? s.items.map((i) => (i.key === next.key ? next : i))
                : [...s.items, next],
            }));
            setLine(null);
          }}
        />
      )}
    </form>
  );
}

/**
 * A benefit or purchase-service line (legacy addCostItemDialog / row edit): the category brings its method and rate;
 * Percent of Salary takes the rate and computes the amount, Flat Amount takes the amount and computes the rate.
 */
function CostLineDialog({
  view,
  initial,
  totalSalary,
  money,
  onClose,
  onApply,
}: {
  view: UnitActivityEditView;
  initial: UnitCostDraft;
  totalSalary: number;
  money: Money;
  onClose: () => void;
  onApply: (line: UnitCostDraft) => void;
}) {
  const [line, setLine] = useState(initial);
  const toast = useToast();
  const id = `${ID}-line`;
  const l = view.labels;
  const config = view.categories.find((c) => c.code === line.category);
  const flat = line.method === "FLAT_AMOUNT";
  const choices = view.categories
    .filter((c) => c.type === line.type)
    .map((c) => ({ value: c.code, label: c.name }));
  // Legacy costCategoryChanged: the category's method and rate, the amount from the rate.
  const pickCategory = (code: string) => {
    const c = view.categories.find((k) => k.code === code);
    setLine((s) => ({
      ...s,
      category: code,
      method: c?.method ?? "",
      rate: c?.rate === null || c?.rate === undefined ? "" : String(c.rate),
      amount: String(itemAmountOf(totalSalary, c?.rate ?? 0)),
    }));
  };
  const apply = () => {
    if (!line.category || !line.method)
      return toast.show("error", "Select a category and a calculation method.");
    onApply(line);
  };
  return (
    <ActionDialog
      id={id}
      title={line.type === "BENEFIT" ? view.texts.benefit : view.texts.purchase}
      onClose={onClose}
    >
      <div className={styles.editorGrid}>
        <InsideField
          htmlFor={`${id}-category-trigger`}
          label={l["cost-item-category"]}
          filled={line.category !== ""}
          required
        >
          <Select
            id={`${id}-category`}
            label={l["cost-item-category"]}
            options={choices}
            value={line.category}
            onChange={pickCategory}
          />
        </InsideField>
        {config && !config.methodEditable ? (
          <ReadonlyField
            id={`${id}-method`}
            label={l["calculation-method"]}
            value={
              view.methods.find((m) => m.value === line.method)?.label ??
              line.method
            }
          />
        ) : (
          <InsideField
            htmlFor={`${id}-method-trigger`}
            label={l["calculation-method"]}
            filled={line.method !== ""}
            required
          >
            <Select
              id={`${id}-method`}
              label={l["calculation-method"]}
              options={view.methods}
              value={line.method}
              onChange={(method) => setLine((s) => ({ ...s, method }))}
            />
          </InsideField>
        )}
        {flat ? (
          <>
            <InsideField
              htmlFor={`${id}-amount`}
              label={l["calculation-amount"]}
              filled={line.amount !== ""}
            >
              <input
                id={`${id}-amount`}
                type="number"
                step="any"
                value={line.amount}
                onChange={(e) =>
                  setLine((s) => ({
                    ...s,
                    amount: e.target.value,
                    rate: String(itemRateOf(totalSalary, num(e.target.value))),
                  }))
                }
              />
            </InsideField>
            <ReadonlyField
              id={`${id}-rate`}
              label={l["calculation-rate"]}
              value={line.rate === "" ? "" : `${line.rate}%`}
            />
          </>
        ) : (
          <>
            <InsideField
              htmlFor={`${id}-rate`}
              label={l["calculation-rate"]}
              filled={line.rate !== ""}
            >
              <input
                id={`${id}-rate`}
                type="number"
                step="any"
                value={line.rate}
                onChange={(e) =>
                  setLine((s) => ({
                    ...s,
                    rate: e.target.value,
                    amount: String(
                      itemAmountOf(totalSalary, num(e.target.value)),
                    ),
                  }))
                }
              />
            </InsideField>
            <ReadonlyField
              id={`${id}-amount`}
              label={l["calculation-amount"]}
              value={money(num(line.amount))}
            />
          </>
        )}
      </div>
      <div className={styles.editorFoot}>
        <button
          type="button"
          id={`${id}-cancel`}
          className="gn-btn gn-btn--outlined"
          onClick={onClose}
        >
          {view.texts.cancel}
        </button>
        <button
          type="button"
          id={`${id}-apply`}
          className="gn-btn gn-btn--primary"
          onClick={apply}
        >
          {view.texts.addCostItem}
        </button>
      </div>
    </ActionDialog>
  );
}
