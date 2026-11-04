"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/ui/icon";
import { InsideField } from "@/components/ui/inside-field";
import { DateInput } from "@/components/ui/date-input";
import { useActionFailure } from "@/components/dialog/action-failure";
import { useInFlight } from "@/lib/hooks/use-in-flight";
import { DataTable } from "@/components/ui/data-table";
import { HelpButton } from "@/components/ui/help-button";
import { ReadonlyField } from "@/components/ui/readonly-field";
import { claims } from "@/lib/api";
import type { FormatSettings } from "@/lib/format";
import { functions } from "@/lib/functions";
import type {
  UnitFundSummaryRow,
  UnitHeading,
  UnitSummaryField,
  UnitSummaryView,
} from "../types";
import { AllocationsDialog } from "./allocations-dialog";
import { useRecordAudit } from "@/features/record/shell/record-frame";
import { SignOffLists } from "./sign-off-lists";
import styles from "./summary.module.css";

type Format = FormatSettings & { currency?: string };
/** Legacy formatDate: an empty date shows blank (dateDisplay's dash is for other pages). */
const day = (v: string, format?: Format) =>
  v ? functions.format.dateDisplay(v, format) : "";
type MoneyKey =
  "original" | "day20" | "other" | "budget" | "unapplied" | "pending";

/** A panel's heading with its RB More Info (legacy `h1` + rb-help-btn). */
function Heading({ id, heading }: { id: string; heading: UnitHeading }) {
  return (
    <h2 className={styles.heading}>
      {heading.title}
      <HelpButton id={`${id}-help`} html={heading.help} />
    </h2>
  );
}
/** Edit mode's state for the fields: values by column, and whether Save was pressed (shows the required messages). */
interface FieldEdit {
  values: Record<string, string>;
  set: (column: string, value: string) => void;
  touched: boolean;
  required: string;
}
/**
 * Two columns; `down` fills each column first (legacy direction="column"), else row by row. Read-only text in view
 * mode; in edit mode legacy's inside-label inputs, every one required.
 */
function Fields({
  id,
  fields,
  format,
  down = false,
  edit,
}: {
  id: string;
  fields: UnitSummaryField[];
  format?: Format;
  down?: boolean;
  edit?: FieldEdit;
}) {
  return (
    <div
      className={`${styles.fields} ${down ? styles.down : ""}`}
      style={
        down
          ? ({ "--rows": Math.ceil(fields.length / 2) } as React.CSSProperties)
          : undefined
      }
    >
      {fields.map((f) => {
        const fieldId = `${id}-${f.key}`;
        if (!edit)
          return (
            <ReadonlyField
              key={f.key}
              id={fieldId}
              label={f.label}
              value={f.date ? day(f.value, format) : f.value}
            />
          );
        const value = edit.values[f.column] ?? "";
        const missing = edit.touched && value.trim() === "";
        const errorId = `${fieldId}-error`;
        return (
          <div key={f.key}>
            <InsideField
              htmlFor={fieldId}
              label={f.label}
              filled={value !== ""}
              required
            >
              {f.date ? (
                <DateInput
                  id={fieldId}
                  value={value}
                  required
                  invalid={missing}
                  describedBy={missing ? errorId : undefined}
                  onChange={(next) => edit.set(f.column, next)}
                />
              ) : (
                <input
                  id={fieldId}
                  type="text"
                  value={value}
                  required
                  aria-invalid={missing || undefined}
                  aria-describedby={missing ? errorId : undefined}
                  onChange={(e) => edit.set(f.column, e.target.value)}
                />
              )}
            </InsideField>
            {missing && (
              <span id={errorId} role="alert" className={styles.error}>
                {edit.required}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}

/** The editable columns' values as the form holds them (dates as the picker's yyyy-MM-dd). */
const formValues = (view: UnitSummaryView) =>
  Object.fromEntries(
    [...view.preparer.fields, ...view.cfo.fields, ...view.signedOff.fields].map(
      (f) => [f.column, f.date ? f.value.slice(0, 10) : f.value],
    ),
  );

/** The Summary tab (legacy claims-unit-summary): view mode, and Edit with the record's `unit-summary-edit` right. */
export function UnitSummaryTab({
  appId,
  view,
  format,
}: {
  appId: string;
  view: UnitSummaryView;
  format?: Format;
}) {
  const { fundSummary: fs } = view;
  const router = useRouter(),
    fail = useActionFailure(),
    { run, isActive } = useInFlight(),
    [, startTransition] = useTransition(),
    [editing, setEditing] = useState(false),
    [values, setValues] = useState(() => formValues(view)),
    [touched, setTouched] = useState(false),
    [allocating, setAllocating] = useState<string | null>(null),
    openAudit = useRecordAudit();
  const all = [
    ...view.preparer.fields,
    ...view.cfo.fields,
    ...view.signedOff.fields,
  ];
  const fieldEdit: FieldEdit | undefined = editing
    ? {
        values,
        set: (column, value) => setValues((v) => ({ ...v, [column]: value })),
        touched,
        required: view.edit.texts.required,
      }
    : undefined;
  const saving = isActive("save");
  // Legacy changeMode: Cancel drops the edits and shows the summary as read.
  const cancel = () => {
    setValues(formValues(view));
    setTouched(false);
    setEditing(false);
  };
  // Legacy saveApplication: both validation groups first, then putAppSummary, then the summary re-read.
  const save = () =>
    void run(async () => {
      setTouched(true);
      if (all.some((f) => (values[f.column] ?? "").trim() === "")) return;
      const result = await claims.saveUnitSummary(appId, values);
      if (!result.ok) return fail(result.error);
      setTouched(false);
      setEditing(false);
      startTransition(() => router.refresh());
    }, "save");
  const money = (v: number | null) =>
    v === null
      ? ""
      : functions.format.moneyDisplay(String(v), format?.currency, format);
  const date = (v: string) => day(v, format);
  const moneyColumn = (key: MoneyKey) => ({
    id: key,
    header: fs.headers[key],
    cell: (r: UnitFundSummaryRow) => money(r[key]),
    footer: <strong>{money(fs.totals[key])}</strong>,
  });
  return (
    <div id="claims-unit-summary" className={styles.tab}>
      {(view.edit.allowed || view.audit) && (
        <div id="claims-unit-summary-toolbar" className={styles.toolbar}>
          {editing ? (
            <>
              <button
                type="button"
                id="claims-unit-summary-save"
                className="gn-btn gn-btn--primary"
                disabled={saving}
                onClick={save}
              >
                <Icon name="save" size={14} />
                {view.edit.texts.save}
              </button>
              <button
                type="button"
                id="claims-unit-summary-cancel"
                className="gn-btn gn-btn--danger"
                disabled={saving}
                onClick={cancel}
              >
                <Icon name="close" size={14} />
                {view.edit.texts.cancel}
              </button>
            </>
          ) : (
            <>
              {view.audit && (
                <button
                  type="button"
                  id="claims-unit-summary-audit"
                  className="gn-btn gn-btn--outlined"
                  onClick={() =>
                    openAudit({
                      page: "claims-unit-summary",
                      title: view.audit!,
                    })
                  }
                >
                  <Icon name="audits" size={14} />
                  {view.audit}
                </button>
              )}
              <button
                type="button"
                id="claims-unit-summary-edit"
                className="gn-btn gn-btn--outlined"
                onClick={() => setEditing(true)}
              >
                <Icon name="edit" size={14} />
                {view.edit.texts.edit}
              </button>
            </>
          )}
        </div>
      )}
      <section id="claims-unit-fund-summary" className={styles.panel}>
        <Heading id="claims-unit-fund-summary" heading={fs} />
        <DataTable
          id="claims-unit-fund-summary-table"
          rowIds="claims-unit-fund"
          label={fs.title}
          rows={fs.rows}
          rowKey={(r) => r.key}
          empty={fs.empty}
          columns={[
            {
              id: "fund",
              header: fs.headers.fund,
              rowHeader: true,
              cell: (r) => r.fund,
              footer: <strong>{fs.totalLabel}</strong>,
            },
            { id: "status", header: fs.headers.status, cell: (r) => r.status },
            moneyColumn("original"),
            moneyColumn("day20"),
            moneyColumn("other"),
            moneyColumn("budget"),
            moneyColumn("unapplied"),
            moneyColumn("pending"),
            {
              id: "period",
              header: fs.headers.period,
              cell: (r) =>
                r.period ? `${date(r.period[0])} - ${date(r.period[1])}` : "",
            },
            {
              id: "amendment-date",
              header: fs.headers.amendmentDate,
              cell: (r) => date(r.amendmentDate),
            },
            {
              id: "claim-date",
              header: fs.headers.claimDate,
              cell: (r) => date(r.claimDate),
            },
            // Legacy's grand total (the total budget) sits under Allocations.
            {
              id: "allocation",
              header: fs.headers.allocation,
              // Only a fund the user may allocate shows the button (owner: hidden, not disabled).
              cell: (r) => (
                <span className={styles.cellActions}>
                  {r.allocate && (
                    <button
                      type="button"
                      id={`claims-unit-fund-${r.key}-allocations`}
                      className="gn-btn gn-btn--icon"
                      aria-label={fs.headers.allocation}
                      title={fs.headers.allocation}
                      onClick={() => setAllocating(r.key)}
                    >
                      <Icon name="manage-allocations" />
                    </button>
                  )}
                  {view.allocationAudit && (
                    <button
                      type="button"
                      id={`claims-unit-fund-${r.key}-allocations-audit`}
                      className="gn-btn gn-btn--icon"
                      aria-label={view.allocationAudit}
                      title={view.allocationAudit}
                      onClick={() =>
                        openAudit({
                          page: "claim-allocations",
                          sec: r.key,
                          title: view.allocationAudit!,
                        })
                      }
                    >
                      <Icon name="audits" />
                    </button>
                  )}
                </span>
              ),
              footer: <strong>{money(fs.totals.budget)}</strong>,
            },
          ]}
        />
      </section>
      {allocating && (
        <AllocationsDialog
          appId={appId}
          fund={allocating}
          format={format}
          // Legacy allocationsDialogClose: the Fund Summary is read again.
          onClose={() => {
            setAllocating(null);
            startTransition(() => router.refresh());
          }}
        />
      )}
      <div className={styles.pair}>
        <section id="claims-unit-preparer" className={styles.panel}>
          <Heading id="claims-unit-preparer" heading={view.preparer} />
          <Fields
            id="claims-unit-preparer"
            fields={view.preparer.fields}
            down
            edit={fieldEdit}
          />
        </section>
        <section id="claims-unit-cfo" className={styles.panel}>
          <Heading id="claims-unit-cfo" heading={view.cfo} />
          <Fields
            id="claims-unit-cfo"
            fields={view.cfo.fields}
            down
            edit={fieldEdit}
          />
        </section>
      </div>
      <section id="claims-unit-signed-off" className={styles.panel}>
        <Heading id="claims-unit-signed-off" heading={view.signedOff} />
        {view.signedOff.note && (
          <div
            id="claims-unit-signed-off-note"
            className={styles.note}
            dangerouslySetInnerHTML={{ __html: view.signedOff.note }}
          />
        )}
        <Fields
          id="claims-unit-signed-off"
          fields={view.signedOff.fields}
          format={format}
          edit={fieldEdit}
        />
        <hr className={styles.rule} />
        <SignOffLists
          appId={appId}
          tabs={view.signOffTabs}
          assurance={view.assuranceTab}
          format={format}
        />
      </section>
      <section id="claims-unit-terms" className={styles.panel}>
        <Heading id="claims-unit-terms" heading={view.terms} />
        {view.terms.parts.map((p) => (
          <div key={p.key} id={`claims-unit-terms-${p.key}`}>
            <h3 className={styles.subheading}>{p.title}</h3>
            {p.html && (
              <div
                className={styles.note}
                dangerouslySetInnerHTML={{ __html: p.html }}
              />
            )}
          </div>
        ))}
      </section>
    </div>
  );
}
