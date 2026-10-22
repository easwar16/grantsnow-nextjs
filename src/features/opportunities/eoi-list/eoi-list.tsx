"use client";
import { idPart } from "@/lib/ids";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import type { FormatSettings } from "@/lib/format";
import { dateDisplay } from "@/lib/format";
import { LatestRequest } from "@/lib/latest-request";
import { Icon } from "@/components/ui/icon";
import { FilterPanel } from "@/components/ui/filter-panel";
import { Select } from "@/components/ui/select";
import { InsideField } from "@/components/ui/inside-field";
import { DateInput } from "@/components/ui/date-input";
import { Skeleton } from "@/components/feedback/skeleton";
import { State } from "@/components/feedback/state";
import { useToast } from "@/components/feedback/toast";
import {
  DEFAULT_EOI_FILTERS,
  clearedEoiFilters,
  serializeEoiFilters,
  type EoiFilters,
} from "./schema";
import type { EoiListPage, EoiListRow, EoiListView } from "./types";
import styles from "./eoi-list.module.css";

type PublicError = { code: string; message: string; action?: string };
export type EoiListResult =
  { ok: true; data: EoiListPage } | { ok: false; error: PublicError };

/** Within this many pixels of the end, the next page loads (as the original's LOAD_MORE_PX). */
const LOAD_MORE_PX = 80;
type TextKey = "number" | "title" | "department" | "createdBy";
const TEXT_IDS: Record<TextKey, string> = {
  number: "eoi-list-number",
  title: "eoi-list-title",
  department: "eoi-list-department",
  createdBy: "eoi-list-created-by",
};

export const eoiHref = (id: string) => `/opportunities/eoi/${id}`;

async function fetchPage(f: EoiFilters, signal: AbortSignal) {
  const response = await fetch(
    `/api/opportunities/eoi?${serializeEoiFilters(f)}`,
    { signal, cache: "no-store" },
  );
  const body = await response.json().catch(() => ({}));
  if (!response.ok)
    throw (
      body?.error ?? {
        code: "UPSTREAM",
        message: "Applications could not be loaded.",
      }
    );
  return body as EoiListPage;
}

/**
 * "EOI Application" (opportunities-eoi-list): every AOI / EOI request, with the status list and filters in the
 * drawer. Filters are page-scoped, as in the original, so they start over on every visit.
 */
export function EoiList({
  view,
  initial,
  format,
}: {
  view: EoiListView;
  initial: EoiListResult;
  format?: FormatSettings;
}) {
  const { gates: g, texts: t } = view;
  const toast = useToast(),
    router = useRouter();
  const [filters, setFilters] = useState<EoiFilters>(DEFAULT_EOI_FILTERS),
    [rows, setRows] = useState(initial.ok ? initial.data.rows : []),
    [total, setTotal] = useState(initial.ok ? initial.data.total : null),
    [hasMore, setHasMore] = useState(initial.ok && initial.data.hasMore),
    [error, setError] = useState(initial.ok ? undefined : initial.error),
    [loading, setLoading] = useState(false),
    [moreFailed, setMoreFailed] = useState(false),
    [broken, setBroken] = useState<ReadonlySet<string>>(new Set()),
    // Bumped by Clear so the uncontrolled text inputs remount empty.
    [generation, setGeneration] = useState(0);
  const latest = useRef(new LatestRequest()),
    list = useRef<HTMLUListElement>(null);

  useEffect(() => {
    for (const message of view.errors) toast.show("error", message);
  }, [view.errors, toast]);

  const load = useCallback(
    (f: EoiFilters, append: boolean) => {
      const request = latest.current.begin();
      setLoading(true);
      setMoreFailed(false);
      if (!append) setError(undefined);
      fetchPage(f, request.signal)
        .then((page) => {
          if (!request.current()) return;
          setRows((prev) => (append ? [...prev, ...page.rows] : page.rows));
          setTotal(page.total);
          setHasMore(page.hasMore);
        })
        .catch((e: PublicError) => {
          if (!request.current()) return;
          if (append) {
            setMoreFailed(true);
            toast.error(e);
          } else {
            setRows([]);
            setTotal(null);
            setHasMore(false);
            setError(e);
          }
        })
        .finally(() => {
          if (request.current()) setLoading(false);
        });
    },
    [toast],
  );
  useEffect(() => () => latest.current.cancel(), []);

  function apply(next: EoiFilters) {
    setFilters(next);
    load(next, false);
  }
  const patch = (change: Partial<EoiFilters>) =>
    apply({ ...filters, ...change });
  /** Text filters apply when committed (blur / Enter), as an oj-input-text value does; unchanged does nothing. */
  const commitText = (key: TextKey, value: string) => {
    if (value !== filters[key]) patch({ [key]: value });
  };
  const more = useCallback(() => {
    if (loading || !hasMore || moreFailed || error) return;
    load({ ...filters, offset: rows.length }, true);
  }, [loading, hasMore, moreFailed, error, load, filters, rows.length]);

  // A page that does not fill the list cannot be scrolled, so the next one loads straight away.
  useEffect(() => {
    const el = list.current;
    if (el && el.scrollHeight <= el.clientHeight) more();
  }, [rows, more]);

  function openRow(row: EoiListRow, event: React.MouseEvent) {
    const href = eoiHref(row.id);
    // Ctrl / Cmd-click opens the record in a new tab, as the original's View does.
    if (event.ctrlKey || event.metaKey)
      window.open(href, "_blank", "noopener,noreferrer");
    else router.push(href);
  }

  // Legacy oj-form-layout label-edge="inside": the shared Redwood inside-label box (measured on live).
  const field = (
    id: string,
    label: string,
    filled: boolean,
    control: React.ReactNode,
  ) => (
    <InsideField htmlFor={id} label={label} filled={filled}>
      {control}
    </InsideField>
  );
  const textInput = (key: TextKey, label: string) =>
    field(
      TEXT_IDS[key],
      label,
      filters[key] !== "",
      <input
        key={`${key}-${generation}`}
        id={TEXT_IDS[key]}
        type="text"
        defaultValue={filters[key]}
        maxLength={200}
        onBlur={(e) => commitText(key, e.currentTarget.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") commitText(key, e.currentTarget.value);
        }}
      />,
    );

  const drawer = (
    <div id="eoi-list-drawer" className={styles.drawer}>
      {g.statusList && (
        <nav
          id="eoi-list-status"
          className={styles.statuses}
          aria-label={t.statusList}
        >
          {view.statuses.map((s) => (
            <button
              key={s.value}
              id={`eoi-list-status-${idPart(s.value || "all")}`}
              type="button"
              className={s.value === filters.status ? styles.selected : ""}
              aria-current={s.value === filters.status ? "true" : undefined}
              onClick={() =>
                s.value !== filters.status &&
                apply({ ...filters, status: s.value })
              }
            >
              {s.label}
            </button>
          ))}
        </nav>
      )}
      <div id="eoi-list-filters" className={styles.filters}>
        {g.number && textInput("number", t.number)}
        {g.title && textInput("title", t.title)}
        {g.funder &&
          field(
            "eoi-list-funder-trigger",
            t.funder,
            filters.funder !== "",
            <Select
              id="eoi-list-funder"
              label={t.funder}
              emptyText="No funders available"
              options={view.funders}
              value={filters.funder}
              onChange={(funder) => patch({ funder })}
            />,
          )}
        {g.department && textInput("department", t.department)}
        {g.createdBy && textInput("createdBy", t.createdBy)}
        {g.dateSort && (
          <div className={styles.sort}>
            {field(
              "eoi-list-sort-field",
              t.dateSort,
              filters.sortBy !== "",
              <select
                id="eoi-list-sort-field"
                value={filters.sortBy}
                onChange={(e) => patch({ sortBy: e.target.value })}
              >
                <option value="" />
                {view.sorts.map((d) => (
                  <option key={d.value} value={d.value}>
                    {d.label}
                  </option>
                ))}
              </select>,
            )}
            <button
              type="button"
              id="eoi-list-sort-direction"
              className={styles.direction}
              aria-label={
                filters.dir === "ascending" ? "Ascending" : "Descending"
              }
              onClick={() =>
                patch({
                  dir: filters.dir === "ascending" ? "descending" : "ascending",
                })
              }
            >
              <Icon
                name={
                  filters.dir === "ascending"
                    ? "arrow-circle-up"
                    : "arrow-circle-down"
                }
                size={20}
              />
            </button>
          </div>
        )}
        {g.createdAfter &&
          field(
            "eoi-list-created-after",
            t.createdAfter,
            filters.createdAfter !== "",
            <DateInput
              id="eoi-list-created-after"
              value={filters.createdAfter}
              max={filters.createdBefore || undefined}
              onChange={(createdAfter) => patch({ createdAfter })}
            />,
          )}
        {g.createdBefore &&
          field(
            "eoi-list-created-before",
            t.createdBefore,
            filters.createdBefore !== "",
            <DateInput
              id="eoi-list-created-before"
              value={filters.createdBefore}
              min={filters.createdAfter || undefined}
              onChange={(createdBefore) => patch({ createdBefore })}
            />,
          )}
        {g.clear && (
          <button
            type="button"
            id="eoi-list-clear"
            className={`gn-btn gn-btn--outlined ${styles.clear}`}
            onClick={() => {
              setGeneration((n) => n + 1);
              apply(clearedEoiFilters(filters));
            }}
          >
            <Icon name="reset-filters" size={14} />
            {t.clear}
          </button>
        )}
      </div>
    </div>
  );

  const meta = (row: EoiListRow) =>
    [
      [t.createdBy, row.createdBy],
      [t.department, row.department],
      [t.createdOn, row.created && dateDisplay(row.created, format)],
      [t.updatedOn, row.updated && dateDisplay(row.updated, format)],
    ].filter((m): m is [string, string] => !!m[1]);

  return (
    <section id="eoi-list" className="page-fill" aria-label={t.pageTitle}>
      <FilterPanel
        id="eoi-filters"
        label="Application filters"
        page="opportunities-eoi"
        filters={drawer}
        // GN-Angular's EOI list has no collapse control.
        open
      >
        <div id="eoi-list-main" className={styles.main}>
          <h1 className="sr-only">{t.pageTitle}</h1>
          {error ? (
            <State
              title="Applications unavailable"
              message={error.message}
              action={error.action}
              code={error.code}
              retry={() => load(filters, false)}
            />
          ) : (
            <ul
              ref={list}
              id="eoi-list-rows"
              className={styles.list}
              aria-label={t.pageTitle}
              aria-busy={loading}
              onScroll={(e) => {
                const el = e.currentTarget;
                if (
                  el.scrollHeight - el.scrollTop - el.clientHeight <
                  LOAD_MORE_PX
                )
                  more();
              }}
            >
              {rows.map((row) => (
                <li
                  className={`${styles.row} enter-rise`}
                  key={row.id}
                  id={`eoi-${row.id}`}
                  data-eoi-row={row.id}
                >
                  {row.logo && !broken.has(row.id) ? (
                    <Image
                      id={`eoi-${row.id}-logo`}
                      className={styles.logo}
                      src={row.logo}
                      alt=""
                      width={100}
                      height={100}
                      unoptimized
                      onError={() =>
                        setBroken((prev) => new Set(prev).add(row.id))
                      }
                    />
                  ) : (
                    <span
                      className={`${styles.logo} ${styles.logoTile}`}
                      aria-hidden="true"
                    >
                      <Icon name="opportunity-logo" size={40} />
                    </span>
                  )}
                  <div id={`eoi-${row.id}-body`} className={styles.body}>
                    {(row.number || row.status) && (
                      <div className={styles.overline}>
                        {row.number && (
                          <>
                            <Icon name="data-document" size={16} />
                            <span
                              id={`eoi-${row.id}-number`}
                              className={styles.number}
                            >
                              {row.number}
                            </span>
                          </>
                        )}
                        {row.status && (
                          <span
                            id={`eoi-${row.id}-status`}
                            className={`gn-status ${styles.status}`}
                            data-tone={row.tone}
                          >
                            {row.status}
                          </span>
                        )}
                      </div>
                    )}
                    {row.title && (
                      <Link
                        id={`eoi-${row.id}-title`}
                        className={styles.title}
                        href={eoiHref(row.id)}
                        prefetch={false}
                      >
                        {row.title}
                      </Link>
                    )}
                    {row.funders.length > 0 && (
                      <div
                        id={`eoi-${row.id}-funders`}
                        className={styles.funders}
                      >
                        {row.funders.map((funder, i) => (
                          <span className={styles.funder} key={i}>
                            {funder}
                          </span>
                        ))}
                      </div>
                    )}
                    {meta(row).length > 0 && (
                      <dl id={`eoi-${row.id}-meta`} className={styles.meta}>
                        {meta(row).map(([term, value]) => (
                          <div key={term}>
                            <dt>{term}</dt>
                            <dd>{value}</dd>
                          </div>
                        ))}
                      </dl>
                    )}
                  </div>
                  {g.view && (
                    <button
                      type="button"
                      id={`eoi-${row.id}-view`}
                      className={`gn-btn gn-btn--borderless gn-btn--icon ${styles.view}`}
                      title={t.view}
                      aria-label={
                        row.number ? `${t.view} ${row.number}` : t.view
                      }
                      onClick={(e) => openRow(row, e)}
                    >
                      <Icon name="view" size={16} />
                    </button>
                  )}
                </li>
              ))}
              {rows.length === 0 && !loading && (
                <li id="eoi-list-empty" className={styles.empty}>
                  {t.empty}
                </li>
              )}
              {loading && (
                <li id="eoi-list-loading" className={styles.skeleton}>
                  <Skeleton
                    kind="list"
                    count={rows.length ? 1 : 4}
                    label="Loading applications"
                  />
                </li>
              )}
              {moreFailed && (
                <li className={styles.empty}>
                  <button
                    type="button"
                    id="eoi-list-retry"
                    className="gn-btn gn-btn--outlined"
                    onClick={() => {
                      setMoreFailed(false);
                      load({ ...filters, offset: rows.length }, true);
                    }}
                  >
                    Retry
                  </button>
                </li>
              )}
            </ul>
          )}
          {!error && (
            <p id="eoi-list-count" className={styles.total} aria-live="polite">
              {total !== null && rows.length < total ? (
                `${rows.length} of ${total}`
              ) : (
                <>
                  <span className={styles.totalTitle}>{t.total}:</span>{" "}
                  {total ?? rows.length}
                </>
              )}
            </p>
          )}
        </div>
      </FilterPanel>
    </section>
  );
}
