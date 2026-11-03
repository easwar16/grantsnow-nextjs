"use client";
import Link from "next/link";
import { fundHref } from "../links";
import { useCallback, useEffect, useRef, useState } from "react";
import { Icon } from "@/components/ui/icon";
import { FilterPanel } from "@/components/ui/filter-panel";
import { Select } from "@/components/ui/select";
import { InsideField } from "@/components/ui/inside-field";
import { RecordMetadata } from "@/components/ui/record-metadata";
import listing from "@/components/ui/listing.module.css";
import { Skeleton } from "@/components/feedback/skeleton";
import { State } from "@/components/feedback/state";
import { useToast } from "@/components/feedback/toast";
import type { FormatSettings } from "@/lib/format";
import { claims, useApi, usePagedApi } from "@/lib/api";
import { isOffline } from "@/lib/api/http";
import { constants } from "@/lib/constants";
import {
  clearedFundFilters,
  fundFiltered,
  serializeFundFilters,
  type FundFilters,
} from "./schema";
import type { FundListView, FundPage, FundRow } from "./types";
import { FundSummaryDialog } from "./fund-summary-dialog";
import styles from "../units/unit-list.module.css";

type PublicError = { code: string; message: string; action?: string };
export type FundListResult =
  { ok: true; data: FundPage } | { ok: false; error: PublicError };

const NO_CHOICES: FundListView["funds"] = [];
const UNREACHABLE: PublicError = {
  code: "UPSTREAM",
  message: "Funds could not be loaded.",
};

/** Funds Inquiry (legacy claims-funds-inquiry-page): each application's funds, filtered, with each fund's summary. */
export function FundList({
  view,
  initial,
  format,
}: {
  view: FundListView;
  initial: Promise<FundListResult>;
  format?: FormatSettings & { currency?: string };
}) {
  const { gates: g, texts: t } = view;
  const toast = useToast();
  const [filters, setFilters] = useState<FundFilters>(clearedFundFilters);
  const [panelOpen, setPanelOpen] = useState(true);
  const [summary, setSummary] = useState<FundRow | null>(null);
  const list = useRef<HTMLUListElement>(null);
  const [seed] = useState(() =>
    initial.then((r) =>
      r.ok
        ? { ok: r.ok, data: { ...r.data, total: r.data.total ?? undefined } }
        : r,
    ),
  );
  const orgs = useApi(claims.fundChoices, g.unit ? "orgs" : null).data;
  const paged = usePagedApi(claims.funds, filters, { initial: seed });
  const { rows, loading } = paged,
    total = paged.total ?? null,
    failed =
      paged.error && isOffline({ ok: false, error: paged.error })
        ? UNREACHABLE
        : paged.error,
    error = failed && rows.length === 0 ? failed : undefined,
    moreFailed = failed !== undefined && rows.length > 0;
  const filterKey = serializeFundFilters(filters);

  useEffect(() => {
    list.current?.scrollTo({ top: 0 });
  }, [filterKey]);
  useEffect(() => {
    for (const message of view.errors) toast.show("error", message);
  }, [view.errors, toast]);
  useEffect(() => {
    for (const message of orgs?.errors ?? []) toast.show("error", message);
  }, [orgs, toast]);
  useEffect(() => {
    if (moreFailed && failed) toast.error(failed);
  }, [moreFailed, failed, toast]);

  const patch = (change: Partial<FundFilters>) =>
    setFilters((f) => ({ ...f, ...change }));
  const { loadMore } = paged;
  const more = useCallback(() => {
    if (!failed) loadMore();
  }, [failed, loadMore]);
  useEffect(() => {
    const el = list.current;
    if (el && el.scrollHeight <= el.clientHeight) more();
  }, [rows, more]);

  const select = (
    key: "unit" | "year" | "fund" | "func" | "object",
    options: FundListView["funds"],
  ) => (
    <InsideField
      htmlFor={`claims-funds-filter-${key}-trigger`}
      label={t[key]}
      filled={filters[key] !== ""}
    >
      <Select
        id={`claims-funds-filter-${key}`}
        label={t[key]}
        options={options}
        value={filters[key]}
        onChange={(value) => patch({ [key]: value })}
      />
    </InsideField>
  );

  const drawer = (
    <div
      id="claims-funds-drawer"
      className={`${listing.drawer} ${styles.drawer}`}
    >
      <div id="claims-funds-filters" className={listing.filters}>
        {g.unit && select("unit", orgs?.options ?? NO_CHOICES)}
        {select("year", view.years)}
        {select("fund", view.funds)}
        {select("func", view.functions)}
        {select("object", view.objects)}
      </div>
      <button
        type="button"
        id="claims-funds-clear"
        className={`gn-btn gn-btn--outlined ${styles.clear}`}
        disabled={!fundFiltered(filters)}
        onClick={() => setFilters(clearedFundFilters())}
      >
        {t.clear}
      </button>
    </div>
  );

  return (
    <section id="claims-funds" className="page-fill" aria-label="Funds Inquiry">
      <FilterPanel
        id="claims-funds-filter-panel"
        label="Fund filters"
        page="claims-funds"
        filters={drawer}
        open={panelOpen}
      >
        <div id="claims-funds-main" className={listing.main}>
          <h1 className="sr-only">Funds Inquiry</h1>
          <div id="claims-funds-toolbar" className={styles.toolbar}>
            <button
              type="button"
              id="claims-funds-panel-toggle"
              className="gn-btn gn-btn--outlined gn-btn--icon"
              aria-label={t.toggle}
              title={t.toggle}
              aria-expanded={panelOpen}
              aria-controls="claims-funds-filter-panel"
              onClick={() => setPanelOpen((o) => !o)}
            >
              <Icon name="collapse-menu" size={14} />
            </button>
          </div>
          {error ? (
            <State
              title="Funds unavailable"
              message={error.message}
              action={error.action}
              code={error.code}
              retry={paged.retry}
            />
          ) : (
            <ul
              ref={list}
              id="claims-funds-rows"
              className={listing.list}
              aria-label="Funds"
              aria-busy={paged.stale}
              inert={paged.stale}
              onScroll={(e) => {
                const el = e.currentTarget;
                if (
                  el.scrollHeight - el.scrollTop - el.clientHeight <
                  constants.paging.loadMorePx
                )
                  more();
              }}
            >
              {rows.map((row) => (
                <li
                  key={row.id}
                  id={`claims-fund-${row.id}`}
                  className={`${listing.row} ${styles.row} enter-rise`}
                >
                  <div
                    id={`claims-fund-${row.id}-body`}
                    className={listing.body}
                  >
                    <div className={`${listing.overline} ${styles.overline}`}>
                      <Icon name="data-document" size={14} />
                      <span
                        id={`claims-fund-${row.id}-number`}
                        className={listing.number}
                      >
                        {row.id}
                      </span>
                    </div>
                    <Link
                      id={`claims-fund-${row.id}-title`}
                      className={listing.title}
                      href={fundHref(row.id)}
                      prefetch={false}
                    >
                      {row.unitName}
                    </Link>
                    <div className={styles.fields}>
                      <RecordMetadata
                        muted
                        id={`claims-fund-${row.id}-meta`}
                        fields={[
                          { label: t.fiscalYear, value: row.fiscalYear },
                          { label: t.fundName, value: row.fundName },
                        ]}
                      />
                    </div>
                  </div>
                  <div
                    className={`${styles.rowActions} ${styles.rowActionsCentre}`}
                  >
                    <button
                      type="button"
                      id={`claims-fund-${row.id}-view`}
                      className="gn-btn gn-btn--borderless gn-btn--icon"
                      title={t.view}
                      aria-label={`${t.view} ${row.id}`}
                      onClick={() => setSummary(row)}
                    >
                      <Icon name="view" size={16} />
                    </button>
                  </div>
                </li>
              ))}
              {rows.length === 0 && paged.last !== undefined && (
                <li id="claims-funds-empty" className={listing.empty}>
                  {t.empty}
                </li>
              )}
              {((loading && !paged.last) || paged.loadingMore) && (
                <li id="claims-funds-loading" className={listing.skeleton}>
                  <Skeleton
                    kind="list"
                    count={rows.length ? 1 : 4}
                    label="Loading funds"
                  />
                </li>
              )}
              {moreFailed && (
                <li className={listing.empty}>
                  <button
                    type="button"
                    id="claims-funds-retry"
                    className="gn-btn gn-btn--outlined"
                    onClick={paged.retry}
                  >
                    Retry
                  </button>
                </li>
              )}
            </ul>
          )}
          {!error && (
            <p
              id="claims-funds-count"
              className={listing.total}
              aria-live="polite"
            >
              {total !== null && rows.length < total ? (
                `${rows.length} of ${total}`
              ) : (
                <>
                  <span className={listing.totalTitle}>{t.total}:</span>{" "}
                  {total ?? rows.length}
                </>
              )}
            </p>
          )}
        </div>
      </FilterPanel>
      {summary && (
        <FundSummaryDialog
          id="claims-fund-summary-dialog"
          fund={summary}
          format={format}
          onClose={() => setSummary(null)}
        />
      )}
    </section>
  );
}
