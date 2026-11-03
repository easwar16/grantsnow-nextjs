"use client";
import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Select } from "@/components/ui/select";
import { DateInput } from "@/components/ui/date-input";
import { DataTable } from "@/components/ui/data-table";
import { HelpButton } from "@/components/ui/help-button";
import { InsideField } from "@/components/ui/inside-field";
import { ReadonlyField } from "@/components/ui/readonly-field";
import { useToast } from "@/components/feedback/toast";
import { ActionDialog } from "@/components/dialog/action-dialog";
import { useActionFailure } from "@/components/dialog/action-failure";
import {
  DynamicForm,
  type DynamicFormHandle,
} from "@/features/record/dynamic-form/dynamic-form";
import {
  ObjectAttributes,
  type AttributesHandle,
} from "@/features/record/attributes/object-attributes";
import { awards } from "@/lib/api";
import { type FormatSettings } from "@/lib/format";
import { useInFlight } from "@/lib/hooks/use-in-flight";
import type { PageLock } from "@/shared/opportunities/eoi-record";
import { AWARD_MODULE } from "@/shared/awards/award-record";
import {
  HEADER_FIELDS,
  HEADER_LISTS,
  outsideProposal,
  type AwardPeriodRow,
  type HeaderField,
  type HeaderView,
} from "./header-model";
import { RECORD_SAVE, useAwardRecord } from "./record-shell";
import dialog from "@/components/dialog/dialog.module.css";
import styles from "./tabs.module.css";
import { functions } from "@/lib/functions";

/**
 * The Award Header tab (legacy awards-header): the header form (read-only until Edit Award Header), the object
 * attributes, the AWARDS-HEADER dynamic form and the award periods. The shell's Save posts the header, then saves
 * the dynamic form, as legacy's saveAwardHeader does. The host keys it by the values it read, so a fresh read after a
 * save starts it over.
 */
export function HeaderTab({
  view,
  lock,
  format,
}: {
  view: HeaderView;
  lock: PageLock;
  format?: FormatSettings & { currency?: string };
}) {
  const { editing, setEditing, run, setGuard, setHeader } = useAwardRecord(),
    toast = useToast(),
    fail = useActionFailure(),
    router = useRouter(),
    [, startTransition] = useTransition(),
    [values, setValues] = useState(view.values),
    [touched, setTouched] = useState(false),
    [period, setPeriod] = useState<AwardPeriodRow | null>(null),
    attributes = useRef<AttributesHandle>(null),
    form = useRef<DynamicFormHandle>(null);
  const { fields: f } = view;
  const editable = (k: HeaderField) =>
    editing && !lock.locked && !f[k].readOnly;
  const missing = (k: HeaderField) =>
    f[k].show && f[k].required && values[k].trim() === "";
  const dirty = () =>
    HEADER_FIELDS.some(([k]) => values[k] !== view.values[k]) ||
    (form.current?.hasChanges() ?? false);
  // The latest values for the shell's Save / Cancel, which call in after this render.
  const latest = useRef({ values, view });
  useEffect(() => {
    latest.current = { values, view };
  });
  useEffect(() => {
    setGuard({ locked: lock.locked || !editing, dirty });
    return () => setGuard(null);
  });
  useEffect(() => {
    setHeader({
      save: () =>
        void run(async () => {
          setTouched(true);
          const { values: v } = latest.current;
          const invalid = HEADER_FIELDS.some(
            ([k]) => f[k].show && f[k].required && v[k].trim() === "",
          );
          const attributesOk = attributes.current?.check() ?? true;
          const formOk = form.current?.check() ?? true;
          if (invalid || !attributesOk || !formOk) {
            if (invalid) toast.show("error", view.texts.required);
            return;
          }
          const result = await awards.saveHeader(view.awardId, {
            values: Object.fromEntries(
              HEADER_FIELDS.filter(([k]) => editable(k)).map(([k]) => [
                k,
                v[k],
              ]),
            ),
            attributes: attributes.current?.values() ?? {},
          });
          if (!result.ok) return fail(result.error);
          toast.show("success", view.texts.updated);
          // Legacy submitTrigger: the header's dynamic form saves after the header.
          if (form.current && !(await form.current.save())) return;
          setEditing(false);
          startTransition(() => router.refresh());
        }, RECORD_SAVE),
      cancel: () => {
        setValues(latest.current.view.values);
        setTouched(false);
        void form.current?.reload();
        attributes.current?.reload();
        setEditing(false);
      },
    });
    return () => setHeader(null);
  });
  const set = (k: HeaderField) => (next: string) =>
    setValues((s) => ({ ...s, [k]: next }));
  // Legacy awardHeaderForm: readonly (plain text) in view mode, inside labels while editing; four columns either way.
  const shown = (k: HeaderField) => {
    const list =
      k in HEADER_LISTS ? HEADER_LISTS[k as keyof typeof HEADER_LISTS] : null;
    if (list)
      return (
        view.choices[list].find((c) => c.value === values[k])?.label.trim() ??
        values[k]
      );
    return k === "actualDate" && values[k] !== ""
      ? functions.format.dateDisplay(values[k], format)
      : values[k];
  };
  const field = (k: HeaderField) => {
    if (!f[k].show) return null;
    const id = `award-header-${functions.ids.idPart(k)}`;
    // A field that cannot be edited reads as label and value while the rest of the form is editing too.
    if (!editable(k))
      return (
        <ReadonlyField key={k} id={id} label={f[k].label} value={shown(k)} />
      );
    const list =
      k in HEADER_LISTS ? HEADER_LISTS[k as keyof typeof HEADER_LISTS] : null;
    const invalid = touched && missing(k);
    const inside = (htmlFor: string, control: React.ReactNode) => (
      <InsideField
        key={k}
        htmlFor={htmlFor}
        label={f[k].label}
        filled={values[k] !== ""}
        required={f[k].required}
      >
        {control}
      </InsideField>
    );
    if (list)
      return inside(
        `${id}-trigger`,
        <Select
          id={id}
          label={f[k].label}
          options={view.choices[list]}
          value={values[k]}
          invalid={invalid}
          onChange={set(k)}
        />,
      );
    if (k === "actualDate")
      return inside(
        id,
        <DateInput
          id={id}
          value={values[k]}
          invalid={invalid}
          onChange={set(k)}
        />,
      );
    return inside(
      id,
      <input
        id={id}
        type={k === "period" ? "number" : "text"}
        step={k === "period" ? 1 : undefined}
        value={values[k]}
        maxLength={f[k].maxLength}
        aria-invalid={invalid || undefined}
        onChange={(e) => set(k)(e.target.value)}
      />,
    );
  };
  return (
    <div id="award-record-header" className={styles.tab}>
      <div className={styles.headerPanel}>
        <form
          id="award-header-form"
          className={editing ? styles.headerEdit : styles.headerView}
          onSubmit={(e) => e.preventDefault()}
        >
          {HEADER_FIELDS.map(([k]) => field(k))}
        </form>
        {view.showAttributes && (
          <ObjectAttributes
            ref={attributes}
            id="award-header-attributes"
            host="award-header"
            objectId={view.awardId}
            editable={editing && !lock.locked}
            initial={view.attributes}
            plain
          />
        )}
      </div>
      <DynamicForm
        ref={form}
        objectType={AWARD_MODULE}
        slot="AWARDS-HEADER"
        parentId={view.awardId}
        objectId={view.awardId}
        objectNumber={view.number}
        editable={editing && !lock.locked}
        hideEmpty
      />
      <section id="award-header-periods" aria-label={view.texts.periodsTitle}>
        <DataTable
          id="award-header-periods-table"
          rowIds="award-header-period"
          height="short"
          columns={[
            {
              id: "start",
              header: view.periodFields.start.label,
              cell: (p) => functions.format.dateDisplay(p.start, format),
            },
            {
              id: "end",
              header: view.periodFields.end.label,
              cell: (p) => functions.format.dateDisplay(p.end, format),
            },
            {
              id: "amount",
              header: view.periodFields.amount.label,
              cell: (p) =>
                p.amount === ""
                  ? ""
                  : functions.format.moneyDisplay(
                      p.amount,
                      format?.currency,
                      format,
                    ),
            },
          ]}
          rows={view.periods}
          rowKey={(p) => p.key}
          actions={[
            {
              id: "edit",
              icon: "edit",
              size: 14,
              label: () => view.texts.edit,
              disabled: (p) => !view.canEditPeriods || !p.editable,
              onClick: setPeriod,
            },
          ]}
          actionsLabel={view.texts.edit}
          empty={view.texts.noPeriods}
        />
      </section>
      {period && (
        <PeriodDialog
          view={view}
          row={period}
          onClose={() => setPeriod(null)}
          onSaved={() => {
            setPeriod(null);
            startTransition(() => router.refresh());
          }}
        />
      )}
    </div>
  );
}

/** Legacy dialogAwardAmountEdit: one period's dates and amount, warning outside the proposal's range. */
function PeriodDialog({
  view,
  row,
  onClose,
  onSaved,
}: {
  view: HeaderView;
  row: AwardPeriodRow;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [v, setV] = useState({
      start: row.start,
      end: row.end,
      amount: row.amount,
    }),
    [touched, setTouched] = useState(false),
    { run, isActive } = useInFlight(),
    toast = useToast(),
    fail = useActionFailure(),
    saving = isActive("period");
  const pf = view.periodFields;
  const missing = (k: "start" | "end" | "amount") =>
    pf[k].required && v[k] === "";
  const save = () => {
    setTouched(true);
    if (missing("start") || missing("end") || missing("amount"))
      return toast.show("error", view.texts.required);
    run(async () => {
      const result = await awards.savePeriod(view.awardId, {
        key: row.key,
        start: v.start,
        end: v.end,
        amount: v.amount === "" ? null : Number(v.amount),
      });
      if (!result.ok) return fail(result.error);
      onSaved();
    }, "period");
  };
  return (
    <ActionDialog
      id="award-header-period-dialog"
      title={view.texts.periodEditTitle}
      width="28.653vw" /* legacy dialogAwardAmountEdit 500px at 1745px */
      busy={saving}
      onClose={onClose}
    >
      <div
        className={dialog.convert}
        style={{ "--cols": 3 } as React.CSSProperties}
      >
        {outsideProposal(view.proposalRange, v.start, v.end) && (
          <p className={styles.warning} role="status">
            {view.texts.periodOutside}
          </p>
        )}
        {(["start", "end"] as const).map((k) => (
          <div key={k} className={`gn-field ${dialog.cell}`}>
            <span className="gn-label">
              <span aria-hidden="true">
                {pf[k].label}
                {pf[k].required ? " *" : ""}
              </span>
              <HelpButton id={`award-period-${k}-help`} html={pf[k].help} />
            </span>
            <DateInput
              id={`award-header-period-${k}`}
              label={pf[k].label}
              value={v[k]}
              min={k === "end" ? v.start || undefined : undefined}
              max={k === "start" ? v.end || undefined : undefined}
              disabled={saving}
              invalid={touched && missing(k)}
              onChange={(next) => setV((s) => ({ ...s, [k]: next }))}
            />
          </div>
        ))}
        <label className={`gn-field ${dialog.cell}`}>
          <span className="gn-label">
            {pf.amount.label}
            {pf.amount.required ? " *" : ""}
            <HelpButton id="award-period-amount-help" html={pf.amount.help} />
          </span>
          <input
            id="award-header-period-amount"
            className="gn-control"
            type="number"
            min="0"
            step="any"
            value={v.amount}
            disabled={saving}
            aria-invalid={(touched && missing("amount")) || undefined}
            onChange={(e) => setV((s) => ({ ...s, amount: e.target.value }))}
          />
        </label>
        <div className={dialog.foot}>
          <button
            type="button"
            id="award-header-period-cancel"
            className="gn-btn gn-btn--outlined"
            disabled={saving}
            onClick={onClose}
          >
            {view.texts.cancel}
          </button>
          <button
            type="button"
            id="award-header-period-save"
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
