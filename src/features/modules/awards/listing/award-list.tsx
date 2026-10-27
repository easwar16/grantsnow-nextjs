"use client";
import { StatusBadge } from "@/components/ui/status-badge";
import { idPart } from "@/lib/ids";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { dateDisplay, moneyDisplay, type FormatSettings } from "@/lib/format";
import { Icon } from "@/components/ui/icon";
import { FilterPanel } from "@/components/ui/filter-panel";
import { Select } from "@/components/ui/select";
import { MultiSelect } from "@/components/ui/multi-select";
import { InsideField } from "@/components/ui/inside-field";
import { StatusList } from "@/components/ui/status-list";
import listing from "@/components/ui/listing.module.css";
import { DateInput } from "@/components/ui/date-input";
import { RecordMetadata } from "@/components/ui/record-metadata";
import { Skeleton } from "@/components/feedback/skeleton";
import { State } from "@/components/feedback/state";
import { useToast } from "@/components/feedback/toast";
import { awards, useApi, usePagedApi } from "@/lib/api";
import { isOffline } from "@/lib/api/http";
import { awardHref } from "../links";
import {
  clearedAwardFilters,
  parseConditions,
  serializeAwardFilters,
  type AwardFilters,
} from "./schema";
import type { AwardListPage, AwardListRow, AwardListView } from "./types";
import styles from "./award-list.module.css";
import { CreateAwardDialog } from "./create-award-dialog";
import { CloneAwardDialog } from "./clone-award-dialog";
import { AwardLinksDialog } from "./award-links-dialog";
import { AdvancedQuery } from "./advanced-query";

type PublicError = { code: string; message: string; action?: string };
export type AwardListResult =
  { ok: true; data: AwardListPage } | { ok: false; error: PublicError };

/** Within this many pixels of the end, the next page loads (loadMoreOnScroll). */
const LOAD_MORE_PX = 80;
type TextKey = "number" | "name" | "proposal";
const TEXT_IDS: Record<TextKey, string> = {
  number: "awards-filter-number",
  name: "awards-filter-name",
  proposal: "awards-filter-proposal",
};

const UNREACHABLE: PublicError = {
  code: "UPSTREAM",
  message: "Awards could not be loaded.",
};

// Legacy filterAwardListing is app-scoped: the filters outlive the page for the tab; the date sort and Advanced Query do not.
let held: AwardFilters | undefined;

/**
 * Awards (legacy awards-start): every award with the status list and filters in the drawer, in list or card layout.
 * Create, Clone, Link and Advanced Query are not built yet.
 */
export function AwardList({
  view,
  entry,
  initial,
  format,
}: {
  view: AwardListView;
  /** The URL's entry filters, which the server's first page used. */
  entry: AwardFilters;
  initial: AwardListResult;
  format?: FormatSettings & { currency?: string };
}) {
  const { gates: g, texts: t } = view;
  const toast = useToast(),
    router = useRouter();
  const entered = serializeAwardFilters(entry) !== "";
  const [filters, setFilters] = useState<AwardFilters>(() =>
    entered || !held
      ? entry
      : { ...held, sortBy: "", dir: "descending", conditions: "" },
  );
  const [dialog, setDialog] = useState<
      { kind: "create" } | { kind: "clone" | "links"; awardId: string } | null
    >(null),
    [advancedOpen, setAdvancedOpen] = useState(false);
  const [panelOpen, setPanelOpen] = useState(true),
    [layout, setLayout] = useState<"list" | "card">("list"),
    // Bumped by Clear so the uncontrolled text inputs remount empty.
    [generation, setGeneration] = useState(0);
  const list = useRef<HTMLUListElement>(null);
  useEffect(() => {
    held = filters;
  }, [filters]);
  // The server rendered the entry filters' first page; it seeds only that list.
  const seeded =
    initial.ok &&
    serializeAwardFilters(filters) === serializeAwardFilters(entry)
      ? initial.data
      : null;
  const loaded = useApi(awards.choices, undefined).data;
  const choices = loaded ?? { orgs: [], people: [], parties: [], errors: [] };
  const paged = usePagedApi(awards.list, filters, {
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
    error = failed && rows.length === 0 ? failed : undefined,
    moreFailed = failed !== undefined && rows.length > 0;
  const filterKey = serializeAwardFilters(filters);

  useEffect(() => {
    list.current?.scrollTo({ top: 0 });
  }, [filterKey]);
  useEffect(() => {
    for (const message of view.errors) toast.show("error", message);
  }, [view.errors, toast]);
  useEffect(() => {
    for (const message of loaded?.errors ?? []) toast.show("error", message);
  }, [loaded, toast]);
  useEffect(() => {
    if (moreFailed && failed) toast.error(failed);
  }, [moreFailed, failed, toast]);

  const patch = (change: Partial<AwardFilters>) =>
    setFilters((f) => ({ ...f, ...change }));
  const commitText = (key: TextKey, value: string) => {
    if (value !== filters[key]) patch({ [key]: value });
  };
  const { loadMore } = paged;
  const more = useCallback(() => {
    if (!failed) loadMore();
  }, [failed, loadMore]);
  useEffect(() => {
    const el = list.current;
    if (el && el.scrollHeight <= el.clientHeight) more();
  }, [rows, more]);

  function openRow(row: AwardListRow, event: React.MouseEvent) {
    const href = awardHref(row.id);
    // Ctrl / Cmd-click opens the record in a new tab, as legacy's View does.
    if (event.ctrlKey || event.metaKey)
      window.open(href, "_blank", "noopener,noreferrer");
    else router.push(href);
  }

  const field = (
    id: string,
    label: string,
    filled: boolean,
    control: React.ReactNode,
    required?: boolean,
  ) => (
    <InsideField htmlFor={id} label={label} filled={filled} required={required}>
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
  const select = (
    key: "org" | "assignedTo" | "funder" | "billingParty",
    label: string,
    options: AwardListView["sorts"],
    required?: boolean,
  ) =>
    field(
      `awards-filter-${idPart(key)}-trigger`,
      label,
      filters[key] !== "",
      <Select
        id={`awards-filter-${idPart(key)}`}
        label={label}
        options={options}
        value={filters[key]}
        onChange={(value) => patch({ [key]: value })}
      />,
      required,
    );
  const pis = filters.pi ? filters.pi.split(",") : [];

  const drawer = (
    <div id="awards-drawer" className={listing.drawer}>
      {view.statuses.length > 0 && (
        <StatusList
          id="awards-status"
          label="Award status"
          options={view.statuses}
          value={filters.status}
          onChange={(status) => patch({ status })}
        />
      )}
      <div id="awards-filters" className={listing.filters}>
        {g.number && textInput("number", t.number)}
        {g.name && textInput("name", t.name)}
        {g.proposal && textInput("proposal", t.proposal)}
        {/* Legacy marks Org Unit required (a hint only: an empty one filters nothing). */}
        {g.org && select("org", t.org, choices.orgs, true)}
        {g.assignedTo && select("assignedTo", t.assignedTo, choices.people)}
        {g.funder && select("funder", t.funder, choices.parties)}
        {g.billingParty &&
          select("billingParty", t.billingParty, choices.parties)}
        {g.dateSort && (
          <div className={listing.sort}>
            {field(
              "awards-sort-field-trigger",
              t.dateSort,
              filters.sortBy !== "",
              <Select
                id="awards-sort-field"
                label={t.dateSort}
                options={view.sorts}
                value={filters.sortBy}
                onChange={(sortBy) => patch({ sortBy })}
              />,
            )}
            <button
              type="button"
              id="awards-sort-direction"
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
        {g.start &&
          field(
            "awards-filter-start",
            t.start,
            filters.start !== "",
            <DateInput
              id="awards-filter-start"
              value={filters.start}
              onChange={(start) => patch({ start })}
            />,
          )}
        {g.end &&
          field(
            "awards-filter-end",
            t.end,
            filters.end !== "",
            <DateInput
              id="awards-filter-end"
              value={filters.end}
              onChange={(end) => patch({ end })}
            />,
          )}
        {g.pi &&
          field(
            "awards-filter-pi-input",
            t.pi,
            pis.length > 0,
            <MultiSelect
              id="awards-filter-pi"
              label={t.pi}
              variant="chips"
              options={choices.people}
              value={pis}
              onChange={(next) => patch({ pi: next.join(",") })}
            />,
          )}
        <button
          type="button"
          id="awards-clear"
          className={`gn-btn gn-btn--outlined ${listing.clear}`}
          onClick={() => {
            setGeneration((n) => n + 1);
            setFilters(clearedAwardFilters(filters));
          }}
        >
          <Icon name="reset-filters" size={14} />
          {t.clear}
        </button>
      </div>
    </div>
  );

  const meta = (row: AwardListRow) => [
    { label: t.proposal, value: row.proposal },
    { label: t.start, value: row.start && dateDisplay(row.start, format) },
    { label: t.end, value: row.end && dateDisplay(row.end, format) },
    {
      label: t.awarded,
      value: row.awarded && dateDisplay(row.awarded, format),
    },
    {
      label: t.created,
      value: row.created && dateDisplay(row.created, format),
    },
    {
      label: t.updated,
      value: row.updated && dateDisplay(row.updated, format),
    },
    { label: t.assignedTo, value: row.assignedTo },
    { label: t.funder, value: row.funder },
    { label: t.billingParty, value: row.billingParty },
    { label: t.org, value: row.org },
    { label: t.pi, value: row.pi },
    {
      label: t.amount,
      value: row.amount && moneyDisplay(row.amount, format?.currency, format),
    },
  ];

  return (
    <section id="awards" className="page-fill" aria-label="Awards">
      <FilterPanel
        id="awards-filter-panel"
        label="Award filters"
        page="awards"
        filters={drawer}
        open={panelOpen}
      >
        <div id="awards-main" className={listing.main}>
          <h1 className="sr-only">Awards</h1>
          <div id="awards-toolbar" className={styles.toolbar}>
            <button
              type="button"
              id="awards-panel-toggle"
              className="gn-btn gn-btn--outlined gn-btn--icon"
              aria-label={t.toggle}
              title={t.toggle}
              aria-expanded={panelOpen}
              aria-controls="awards-filter-panel"
              onClick={() => setPanelOpen((o) => !o)}
            >
              <Icon name="collapse-menu" size={14} />
            </button>
            {view.actions.create && (
              <button
                type="button"
                id="awards-create"
                className="gn-btn gn-btn--outlined"
                onClick={() => setDialog({ kind: "create" })}
              >
                <Icon name="new-application" size={14} />
                {t.createAward}
              </button>
            )}
            {g.cardView && (
              <div
                id="awards-layout"
                className={styles.layouts}
                role="radiogroup"
                aria-label="Layout"
              >
                {(
                  [
                    ["list", "list", t.listView],
                    ["card", "grid-view", t.cardView],
                  ] as const
                ).map(([value, icon, text]) => (
                  <button
                    key={value}
                    type="button"
                    id={`awards-layout-${value}`}
                    role="radio"
                    aria-checked={layout === value}
                    className={layout === value ? styles.chosen : undefined}
                    onClick={() => setLayout(value)}
                  >
                    <Icon name={icon} size={16} />
                    {text}
                  </button>
                ))}
              </div>
            )}
            {view.actions.advanced && (
              <button
                type="button"
                id="awards-advanced-toggle"
                className={`gn-btn gn-btn--borderless${g.cardView ? "" : ` ${styles.push}`}`}
                aria-expanded={advancedOpen}
                aria-controls="awards-advanced"
                onClick={() => setAdvancedOpen((o) => !o)}
              >
                <Icon name="smart-filter" size={16} />
                {t.advanced}
              </button>
            )}
          </div>
          <div id="awards-content" className={styles.content}>
            <div className={styles.column}>
              {error ? (
                <State
                  title="Awards unavailable"
                  message={error.message}
                  action={error.action}
                  code={error.code}
                  retry={paged.retry}
                />
              ) : (
                <ul
                  ref={list}
                  id="awards-rows"
                  className={`${listing.list}${layout === "card" ? ` ${styles.cards}` : ""}`}
                  aria-label="Awards"
                  aria-busy={paged.stale}
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
                      className={`${listing.row} ${styles.row} enter-rise`}
                      key={row.id}
                      id={`award-${row.id}`}
                    >
                      <div id={`award-${row.id}-body`} className={listing.body}>
                        <div className={listing.overline}>
                          <Icon name="data-document" size={14} />
                          {row.number && (
                            <span
                              id={`award-${row.id}-number`}
                              className={listing.number}
                            >
                              {row.number}
                            </span>
                          )}
                          {row.status && (
                            <StatusBadge
                              id={`award-${row.id}-status`}
                              className={listing.status}
                              tone={row.tone}
                            >
                              {row.status}
                            </StatusBadge>
                          )}
                        </div>
                        {row.title && (
                          <Link
                            id={`award-${row.id}-title`}
                            className={listing.title}
                            href={awardHref(row.id)}
                            prefetch={false}
                          >
                            {row.title}
                          </Link>
                        )}
                        <RecordMetadata
                          id={`award-${row.id}-meta`}
                          fields={meta(row)}
                        />
                      </div>
                      <div className={styles.rowActions}>
                        {view.actions.link && (
                          <button
                            type="button"
                            id={`award-${row.id}-link`}
                            className="gn-btn gn-btn--borderless gn-btn--icon"
                            title={t.link}
                            aria-label={
                              row.number ? `${t.link} ${row.number}` : t.link
                            }
                            onClick={() =>
                              setDialog({ kind: "links", awardId: row.id })
                            }
                          >
                            <Icon name="link" size={16} />
                          </button>
                        )}
                        {view.actions.clone && (
                          <button
                            type="button"
                            id={`award-${row.id}-clone`}
                            className="gn-btn gn-btn--borderless gn-btn--icon"
                            title={t.clone}
                            aria-label={
                              row.number ? `${t.clone} ${row.number}` : t.clone
                            }
                            onClick={() =>
                              setDialog({ kind: "clone", awardId: row.id })
                            }
                          >
                            <Icon name="copy" size={16} />
                          </button>
                        )}
                        {g.view && (
                          <button
                            type="button"
                            id={`award-${row.id}-view`}
                            className="gn-btn gn-btn--borderless gn-btn--icon"
                            title={t.view}
                            aria-label={
                              row.number ? `${t.view} ${row.number}` : t.view
                            }
                            onClick={(e) => openRow(row, e)}
                          >
                            <Icon name="view" size={16} />
                          </button>
                        )}
                      </div>
                    </li>
                  ))}
                  {rows.length === 0 && paged.last !== undefined && (
                    <li id="awards-empty" className={listing.empty}>
                      <strong>No data to display</strong>
                      <span>{t.empty}</span>
                    </li>
                  )}
                  {((loading && !paged.last) || paged.loadingMore) && (
                    <li id="awards-loading" className={listing.skeleton}>
                      <Skeleton
                        kind="list"
                        count={rows.length ? 1 : 4}
                        label="Loading awards"
                      />
                    </li>
                  )}
                  {moreFailed && (
                    <li className={listing.empty}>
                      <button
                        type="button"
                        id="awards-retry"
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
                  id="awards-count"
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
            {advancedOpen && (
              <AdvancedQuery
                conditions={parseConditions(filters.conditions)}
                onChange={(next) =>
                  patch({ conditions: next.length ? JSON.stringify(next) : "" })
                }
                onClose={() => setAdvancedOpen(false)}
              />
            )}
          </div>
        </div>
      </FilterPanel>
      {dialog?.kind === "create" && (
        <CreateAwardDialog
          id="awards-create-dialog"
          onClose={() => setDialog(null)}
          onCreated={paged.reload}
        />
      )}
      {dialog?.kind === "clone" && (
        <CloneAwardDialog
          id="awards-clone-dialog"
          awardId={dialog.awardId}
          onClose={() => setDialog(null)}
          onCloned={paged.reload}
        />
      )}
      {dialog?.kind === "links" && (
        <AwardLinksDialog
          id="awards-links-dialog"
          awardId={dialog.awardId}
          format={format}
          onClose={() => setDialog(null)}
          onLinked={paged.reload}
        />
      )}
    </section>
  );
}
