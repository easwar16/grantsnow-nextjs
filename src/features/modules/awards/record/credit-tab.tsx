"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { DataTable } from "@/components/ui/data-table";
import { InsideField } from "@/components/ui/inside-field";
import { ActionDialog } from "@/components/dialog/action-dialog";
import { useActionFailure } from "@/components/dialog/action-failure";
import { useInFlight } from "@/lib/hooks/use-in-flight";
import { awards } from "@/lib/api";
import { type FormatSettings } from "@/lib/format";
import type { CreditRow, CreditView } from "./credit-types";
import dialog from "@/components/dialog/dialog.module.css";
import styles from "./tabs.module.css";

const percent = (n: number, decimals?: number | null) =>
  `${(n * 100).toFixed(decimals ?? 2)}%`;

/**
 * The Credit Allocation tab (legacy awards-credit-allocation): each row's person, role, credit and effort, edited one
 * row at a time. Credit and effort are typed as percentages and sent as fractions.
 */
export function CreditTab({
  view,
  format,
}: {
  view: CreditView;
  format?: FormatSettings;
}) {
  const t = view.texts;
  const [editing, setEditing] = useState<CreditRow | null>(null),
    router = useRouter(),
    [, startTransition] = useTransition();
  return (
    <div id="award-record-credit-allocation" className={styles.tab}>
      <DataTable
        id="award-credit-table"
        rowIds="award-credit"
        height="short"
        columns={[
          { id: "person", header: t.person, cell: (r) => r.person },
          { id: "role", header: t.role, cell: (r) => r.role },
          {
            id: "credit",
            header: t.credit,
            className: styles.number,
            cell: (r) => percent(r.credit, format?.decimals),
          },
          {
            id: "effort",
            header: t.effort,
            className: styles.number,
            cell: (r) => percent(r.effort, format?.decimals),
          },
        ]}
        rows={view.rows}
        rowKey={(r) => r.id}
        actions={[
          {
            id: "edit",
            icon: "edit",
            size: 14,
            label: (r) => `${t.edit} ${r.person}`,
            title: t.edit,
            disabled: () => !view.canEdit,
            onClick: setEditing,
          },
        ]}
        actionsLabel={t.edit}
        empty={t.noData}
      />
      {editing && (
        <CreditDialog
          view={view}
          row={editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            startTransition(() => router.refresh());
          }}
        />
      )}
    </div>
  );
}

/** Legacy dialogAwardCreditEdit: person and role as they are (the operation cannot change them), effort and credit. */
function CreditDialog({
  view,
  row,
  onClose,
  onSaved,
}: {
  view: CreditView;
  row: CreditRow;
  onClose: () => void;
  onSaved: () => void;
}) {
  const t = view.texts;
  const asText = (n: number) => String(Math.round(n * 10_000) / 100);
  const [credit, setCredit] = useState(asText(row.credit)),
    [effort, setEffort] = useState(asText(row.effort)),
    [touched, setTouched] = useState(false),
    { run, isActive } = useInFlight(),
    fail = useActionFailure();
  const saving = isActive("credit");
  const value = (text: string) => {
    const n = Number(text);
    return text.trim() !== "" && Number.isFinite(n) && n >= 0 && n <= 100
      ? n / 100
      : null;
  };
  const save = () => {
    setTouched(true);
    const c = value(credit),
      e = value(effort);
    if (c === null || e === null) return;
    void run(async () => {
      const result = await awards.saveCredit(view.awardId, {
        id: row.id,
        credit: c,
        effort: e,
      });
      if (!result.ok) return fail(result.error);
      onSaved();
    }, "credit");
  };
  const percentField = (
    id: string,
    label: string,
    text: string,
    set: (v: string) => void,
  ) => (
    <InsideField htmlFor={id} label={label} filled={text !== ""} required>
      <input
        id={id}
        className="gn-control"
        type="number"
        min={0}
        max={100}
        step="any"
        value={text}
        disabled={saving}
        aria-invalid={(touched && value(text) === null) || undefined}
        onChange={(e) => set(e.target.value)}
      />
    </InsideField>
  );
  return (
    <ActionDialog
      id="award-credit-dialog"
      title={t.title}
      width="83.333vw" /* legacy dialogAwardCreditEdit oj-md-10 */
      busy={saving}
      onClose={onClose}
    >
      <div className={styles.headerEdit}>
        <InsideField htmlFor="award-credit-person" label={t.person} filled>
          <input
            id="award-credit-person"
            className="gn-control"
            value={row.person}
            readOnly
          />
        </InsideField>
        <InsideField htmlFor="award-credit-role" label={t.role} filled>
          <input
            id="award-credit-role"
            className="gn-control"
            value={row.role}
            readOnly
          />
        </InsideField>
        {percentField("award-credit-effort", t.effort, effort, setEffort)}
        {percentField("award-credit-credit", t.credit, credit, setCredit)}
      </div>
      <div className={dialog.foot}>
        <button
          type="button"
          id="award-credit-cancel"
          className="gn-btn gn-btn--outlined"
          disabled={saving}
          onClick={onClose}
        >
          {t.cancel}
        </button>
        <button
          type="button"
          id="award-credit-save"
          className="gn-btn gn-btn--primary"
          disabled={saving}
          onClick={save}
        >
          {t.save}
        </button>
      </div>
    </ActionDialog>
  );
}
