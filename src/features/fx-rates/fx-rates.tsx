"use client";
import { useState } from "react";
import { TableSkeleton } from "@/components/feedback/skeleton";
import { State } from "@/components/feedback/state";
import { Icon } from "@/components/ui/icon";
import { useActionFailure } from "@/features/opportunities/components/actions/request";
import { useStoreApi } from "@/lib/app-store";
import { idPart } from "@/lib/ids";
import { useInFlight } from "@/lib/use-in-flight";
import { useRemote } from "@/lib/use-remote";
import {
  ADMIN_DEFAULT,
  editedColumn,
  withEdits,
  type FxEdit,
  type FxMode,
  type FxView,
} from "./model";
import styles from "./fx-rates.module.css";
const OFFLINE = {
  code: "UPSTREAM",
  message: "The request could not be completed. Please retry.",
};
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
  const target = { type, id: proposalId, versionId, mode },
    url = `/api/fx-rates?${new URLSearchParams(target)}`;
  const { data, error, retry } = useRemote<FxView>(url),
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
    rows = withEdits(data.rates, edits, data.mode);
  const setRate = (currency: string, text: string) => {
    setTyped((t) => ({ ...t, [currency]: text }));
    const n = text.trim() === "" ? NaN : Number(text);
    setEdits((all) => {
      const reset = all[currency]?.reset ?? false,
        rest = without(all, currency);
      // An empty or unreadable box changes nothing; legacy would have posted a null rate.
      if (!Number.isFinite(n))
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
      let result:
        { ok: true; data: FxView } | { ok: false; error: typeof OFFLINE };
      try {
        const response = await fetch("/api/fx-rates", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ target, edits: Object.values(edits) }),
        });
        const body = await response.json();
        result = response.ok
          ? { ok: true, data: body as FxView }
          : { ok: false, error: body.error ?? OFFLINE };
      } catch {
        result = { ok: false, error: OFFLINE };
      }
      if (!result.ok) return fail(result.error);
      store.patch(url, result.data);
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
        id={`${id}-${idPart(currency)}-${which}`}
        className={`gn-control ${styles.input}`}
        type="number"
        step="any"
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
        <div className={styles.scroll}>
          <table id={`${id}-table`} className={styles.table}>
            <thead>
              <tr>
                <th scope="col">{texts.currency}</th>
                <th scope="col">{texts.cost}</th>
                <th scope="col">{texts.price}</th>
                {editable && (
                  <th scope="col" className={styles.actions}>
                    <span className="sr-only">{texts.reset}</span>
                  </th>
                )}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.currency} id={`${id}-${idPart(r.currency)}`}>
                  <td>
                    {r.name}
                    {r.status !== ADMIN_DEFAULT && (
                      <span className={styles.dot} title={texts.edited}>
                        <span className="sr-only">{texts.edited}</span>
                      </span>
                    )}
                  </td>
                  <td>{cell(r.currency, "cost", r.cost, texts.cost)}</td>
                  <td>{cell(r.currency, "price", r.price, texts.price)}</td>
                  {editable && (
                    <td className={styles.actions}>
                      <button
                        type="button"
                        id={`${id}-${idPart(r.currency)}-reset`}
                        className="gn-btn gn-btn--borderless gn-btn--icon"
                        title={texts.reset}
                        aria-label={`${texts.reset} ${r.currency}`}
                        disabled={saving}
                        onClick={() => reset(r.currency)}
                      >
                        <Icon name="reset" size={14} />
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {editable && (
        <div className={styles.foot}>
          <button
            type="button"
            id={`${id}-save`}
            className="gn-btn gn-btn--primary"
            disabled={saving}
            onClick={save}
          >
            {texts.save}
          </button>
        </div>
      )}
    </div>
  );
}
