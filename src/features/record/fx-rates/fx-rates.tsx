"use client";
import { useState } from "react";
import { TableSkeleton } from "@/components/feedback/skeleton";
import { State } from "@/components/feedback/state";
import { DataTable } from "@/components/ui/data-table";
import { useActionFailure } from "@/components/dialog/action-failure";
import { useStoreApi } from "@/lib/store/app-store";
import { useInFlight } from "@/lib/hooks/use-in-flight";
import { fxRates, useApi } from "@/lib/api";
import {
  ADMIN_DEFAULT,
  editedColumn,
  withEdits,
  type FxEdit,
  type FxMode,
} from "./model";
import styles from "./fx-rates.module.css";
import { functions } from "@/lib/functions";
const shown = (n: number | null) => (n === null ? "" : String(n));
const without = <T,>(all: Record<string, T>, key: string) =>
  Object.fromEntries(Object.entries(all).filter(([k]) => k !== key));
/**
 * The shared FX Rates panel (legacy fragment `fx-rates`), for a dialog on the proposal Budget (PURCHASE) or Pricing
 * (INCOME) tab. Read-only, with no Save, until the server says every edit gate passed, so it never renders blank
 * while loading (legacy's `fxRatesData` defect). Mount it when the dialog opens; `onSaved` replaces legacy's
 * `application:refreshParentCurrencyRates` so the host re-reads its own rates.
 */
export function FxRates({
  id,
  type,
  proposalId,
  versionId,
  mode,
  onSaved,
}: {
  /** The panel's page-unique id; rows take `${id}-<currency>`. */
  id: string;
  type: string;
  proposalId: string;
  versionId: string;
  mode: FxMode;
  onSaved?: () => void;
}) {
  const target = { type, id: proposalId, versionId, mode };
  const { data, error, retry } = useApi(fxRates.rates, target),
    store = useStoreApi(),
    fail = useActionFailure(),
    { run, isActive } = useInFlight(),
    [edits, setEdits] = useState<Record<string, FxEdit>>({}),
    // What is typed in each rate box, so "1." or an empty box stays as typed.
    [typed, setTyped] = useState<Record<string, string>>({});
  if (error)
    return (
      <State
        id={`${id}-error`}
        title="FX rates could not be loaded"
        message={error.message}
        code={error.code}
        action={error.action}
        retry={retry}
      />
    );
  if (data === undefined) return <TableSkeleton label="Loading FX rates" />;
  const { texts, editable } = data,
    saving = isActive("save"),
    column = editedColumn(data.mode),
    rows = withEdits(data.rates, edits, data.mode),
    invalid = (text?: string) =>
      text !== undefined && text.trim() !== "" && !(Number(text) > 0),
    blocked = Object.values(typed).some(invalid);
  const setRate = (currency: string, text: string) => {
    setTyped((t) => ({ ...t, [currency]: text }));
    const n = text.trim() === "" ? NaN : Number(text);
    setEdits((all) => {
      const reset = all[currency]?.reset ?? false,
        rest = without(all, currency);
      // An empty, unreadable or non-positive box changes nothing; legacy would have posted it.
      if (!(n > 0))
        return reset ? { ...rest, [currency]: { currency, reset } } : rest;
      return { ...rest, [currency]: { currency, reset, rate: n } };
    });
  };
  const reset = (currency: string) => {
    setTyped((t) => without(t, currency));
    setEdits((all) => ({ ...all, [currency]: { currency, reset: true } }));
  };
  const save = () =>
    void run(async () => {
      const result = await fxRates.save(target, Object.values(edits));
      if (!result.ok) return fail(result.error);
      store.patch(fxRates.rates.key(target), result.data);
      setEdits({});
      setTyped({});
      onSaved?.();
    }, "save");
  const cell = (
    currency: string,
    which: "cost" | "price",
    value: number | null,
    header: string,
  ) =>
    editable && which === column ? (
      <input
        id={`${id}-${functions.ids.idPart(currency)}-${which}`}
        className={`gn-control ${styles.input}`}
        type="number"
        step="any"
        min="0"
        aria-invalid={invalid(typed[currency]) || undefined}
        aria-label={`${header} ${currency}`}
        value={typed[currency] ?? shown(value)}
        disabled={saving}
        onChange={(e) => setRate(currency, e.target.value)}
      />
    ) : (
      shown(value)
    );
  return (
    <div id={id} className={styles.panel}>
      {rows.length === 0 ? (
        <p id={`${id}-empty`}>{texts.noData}</p>
      ) : (
        <div className={`gn-table-scroll ${styles.scroll}`}>
          <DataTable
            id={`${id}-table`}
            rowIds={id}
            className={styles.table}
            columns={[
              {
                id: "currency",
                header: texts.currency,
                cell: (r) => (
                  <>
                    {r.name}
                    {r.status !== ADMIN_DEFAULT && (
                      <span className={styles.dot} title={texts.edited}>
                        <span className="sr-only">{texts.edited}</span>
                      </span>
                    )}
                  </>
                ),
              },
              {
                id: "cost",
                header: texts.cost,
                cell: (r) => cell(r.currency, "cost", r.cost, texts.cost),
              },
              {
                id: "price",
                header: texts.price,
                cell: (r) => cell(r.currency, "price", r.price, texts.price),
              },
            ]}
            rows={rows}
            rowKey={(r) => r.currency}
            actions={
              editable
                ? [
                    {
                      id: "reset",
                      icon: "reset",
                      size: 14,
                      label: (r) => `${texts.reset} ${r.currency}`,
                      title: texts.reset,
                      disabled: () => saving,
                      onClick: (r) => reset(r.currency),
                    },
                  ]
                : []
            }
            actionsLabel={texts.reset}
            actionsClassName={styles.actions}
          />
        </div>
      )}
      {editable && (
        <div className={styles.foot}>
          <button
            type="button"
            id={`${id}-save`}
            className="gn-btn gn-btn--primary"
            disabled={saving || blocked}
            onClick={save}
          >
            {texts.save}
          </button>
        </div>
      )}
    </div>
  );
}
