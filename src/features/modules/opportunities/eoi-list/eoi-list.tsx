"use client";
import { StatusBadge } from "@/components/ui/status-badge";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import type { FormatSettings } from "@/lib/format";
import { dateDisplay } from "@/lib/format";
import { Icon } from "@/components/ui/icon";
import { FilterPanel } from "@/components/ui/filter-panel";
import { Select } from "@/components/ui/select";
import { InsideField } from "@/components/ui/inside-field";
import { StatusList } from "@/components/ui/status-list";
import listing from "@/components/ui/listing.module.css";
import { DateInput } from "@/components/ui/date-input";
import { Skeleton } from "@/components/feedback/skeleton";
import { State } from "@/components/feedback/state";
import { useToast } from "@/components/feedback/toast";
import { eoi, usePagedApi } from "@/lib/api";
import { isOffline } from "@/lib/api/http";
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

// The original's text when the list never answered (a route's own error is shown as sent).
const UNREACHABLE: PublicError = {
  code: "UPSTREAM",
  message: "Applications could not be loaded.",
};

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
    [broken, setBroken] = useState<ReadonlySet<string>>(new Set()),
    // Bumped by Clear so the uncontrolled text inputs remount empty.
    [generation, setGeneration] = useState(0);
  const list = useRef<HTMLUListElement>(null);
  // The server rendered the default filters' first page; it seeds only that list.
  const seeded =
    initial.ok && serializeEoiFilters(filters) === "" ? initial.data : null;
  const paged = usePagedApi(eoi.list, filters, {
    initial: seeded
      ? { ...seeded, total: seeded.total ?? undefined }
      : undefined,
  });
  const { rows, loading } = paged,
    total = paged.total ?? null,
    failed =
      paged.error && isOffline({ ok: false, error: paged.error })
        ? UNREACHABLE
        : paged.error,
    // The first page failing is the page's error; a later one keeps the rows and offers a retry.
    error = failed && rows.length === 0 ? failed : undefined,
    moreFailed = failed !== undefined && rows.length > 0;
  const filterKey = serializeEoiFilters(filters);

  // A new filter's list starts at its top (the previous rows stay on screen, dimmed, until it arrives).
  useEffect(() => {
    list.current?.scrollTo({ top: 0 });
  }, [filterKey]);

  useEffect(() => {
    for (const message of view.errors) toast.show("error", message);
  }, [view.errors, toast]);

  // A later page's failure toasts once, as the original's.
  useEffect(() => {
    if (moreFailed && failed) toast.error(failed);
  }, [moreFailed, failed, toast]);

  function apply(next: EoiFilters) {
    setFilters(next);
  }
  const patch = (change: Partial<EoiFilters>) =>
    apply({ ...filters, ...change });
  /** Text filters apply when committed (blur / Enter), as an oj-input-text value does; unchanged does nothing. */
  const commitText = (key: TextKey, value: string) => {
    if (value !== filters[key]) patch({ [key]: value });
  };
  const { loadMore } = paged;
  const more = useCallback(() => {
    if (!failed) loadMore();
  }, [failed, loadMore]);

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
    <div id="eoi-list-drawer" className={listing.drawer}>
      {g.statusList && (
        <StatusList
          id="eoi-list-status"
          label={t.statusList}
          options={view.statuses}
          value={filters.status}
          onChange={(status) => apply({ ...filters, status })}
        />
      )}
      <div id="eoi-list-filters" className={listing.filters}>
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
          <div className={listing.sort}>
            {field(
              "eoi-list-sort-field-trigger",
              t.dateSort,
              filters.sortBy !== "",
              <Select
                id="eoi-list-sort-field"
                label={t.dateSort}
                options={view.sorts}
                value={filters.sortBy}
                onChange={(sortBy) => patch({ sortBy })}
              />,
            )}
            <button
              type="button"
              id="eoi-list-sort-direction"
              className={listing.direction}
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
            className={`gn-btn gn-btn--outlined ${listing.clear}`}
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
        <div id="eoi-list-main" className={listing.main}>
          <h1 className="sr-only">{t.pageTitle}</h1>
          {error ? (
            <State
              title="Applications unavailable"
              message={error.message}
              action={error.action}
              code={error.code}
              retry={paged.retry}
            />
          ) : (
            <ul
              ref={list}
              id="eoi-list-rows"
              className={listing.list}
              aria-label={t.pageTitle}
              aria-busy={paged.stale}
              // The previous filter's rows stay, dimmed, until the new ones arrive; they cannot be opened meanwhile.
              inert={paged.stale}
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
                  className={`${listing.row} enter-rise`}
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
                  <div id={`eoi-${row.id}-body`} className={listing.body}>
                    {(row.number || row.status) && (
                      <div className={listing.overline}>
                        {row.number && (
                          <>
                            <Icon name="data-document" size={16} />
                            <span
                              id={`eoi-${row.id}-number`}
                              className={listing.number}
                            >
                              {row.number}
                            </span>
                          </>
                        )}
                        {row.status && (
                          <StatusBadge
                            id={`eoi-${row.id}-status`}
                            className={listing.status}
                            tone={row.tone}
                          >
                            {row.status}
                          </StatusBadge>
                        )}
                      </div>
                    )}
                    {row.title && (
                      <Link
                        id={`eoi-${row.id}-title`}
                        className={listing.title}
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
                      className={`gn-btn gn-btn--borderless gn-btn--icon ${listing.view}`}
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
              {rows.length === 0 && paged.last !== undefined && (
                <li id="eoi-list-empty" className={listing.empty}>
                  {t.empty}
                </li>
              )}
              {/* Nothing held yet, or the next page: a held list refreshing in the background shows as it is. */}
              {((loading && !paged.last) || paged.loadingMore) && (
                <li id="eoi-list-loading" className={listing.skeleton}>
                  <Skeleton
                    kind="list"
                    count={rows.length ? 1 : 4}
                    label="Loading applications"
                  />
                </li>
              )}
              {moreFailed && (
                <li className={listing.empty}>
                  <button
                    type="button"
                    id="eoi-list-retry"
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
            <p id="eoi-list-count" className={listing.total} aria-live="polite">
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
    </section>
  );
}
