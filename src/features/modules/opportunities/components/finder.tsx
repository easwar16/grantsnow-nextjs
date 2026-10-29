"use client";
import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
import { type FormatSettings } from "@/lib/format";
import { RecordSkeleton } from "@/components/feedback/skeleton";
import { State } from "@/components/feedback/state";
import { useToast } from "@/components/feedback/toast";
import { FilterPanel } from "@/components/ui/filter-panel";
import {
  FilterChoices,
  FilterClear,
  FilterSection,
  FilterSectionAction,
  FilterStack,
  SortControl,
} from "@/components/ui/filter-section";
import { AnimatePresence } from "motion/react";
import { Icon } from "@/components/ui/icon";
import { Select } from "@/components/ui/select";
import { Announcements } from "@/features/modules/home/components/announcements";
import type {
  FinderContext,
  FinderOptions,
  FinderShell,
} from "@/server/modules/opportunities/service";
import { useStreamed } from "@/lib/hooks/use-streamed";
import { opportunities, usePagedApi } from "@/lib/api";
import { isOffline } from "@/lib/api/http";
import { listKey, type OpportunityQuery } from "../schemas";
import type { OpportunityCardModel, OpportunityRow } from "../types";
import { AdvancedFilter } from "../finder/advanced-filter";
import { FunderTree } from "../finder/funder-tree";
import { funderTree } from "../finder/funders";
import { remembered } from "../finder/remembered";
import {
  cleared,
  countStrip,
  DATE_SORTS,
  DEFAULT_FILTERS,
  entered,
  fromQuery,
  hasUrlFilters,
  MAX_FUNDER_KEYS,
  panelCleared,
  queryString,
  resolveTab,
  type DateSort,
  type FinderFilters,
  type FinderQuery,
  type FinderTab,
} from "../finder/state";
import { OpportunityCard } from "./opportunity-card";
import styles from "./finder.module.css";
import { constants } from "@/lib/constants";
import { functions } from "@/lib/functions";
type Failure = { code: string; message: string; action?: string };
type Page = {
  rows: OpportunityRow[];
  total: number;
  card: OpportunityCardModel;
  countsUnavailable?: true;
};
export type FinderResult =
  { ok: true; data: Page } | { ok: false; error: Failure };
const UNREACHABLE: Failure = {
  code: "UPSTREAM",
  message: "Opportunities could not be loaded. Please retry.",
};
// The list loads its next page within this distance of the bottom (GN-Angular constants.paging.loadMorePx).
const TOO_MANY = "Cannot add these many filter options";
type Section = keyof typeof remembered.sections;
/**
 * "All Opportunities" (opportunities-finder): the filter panel, search with Match All / Any, the advanced filter,
 * the tabs and the infinite card list. Every filter change applies at once; the server builds the SQL.
 */
// Stable empties while the streamed parts load, so effects and memoised children see no change.
const NO_OPTIONS: FinderOptions = {
    status: [],
    fundingType: [],
    funders: [],
    funderTypes: [],
    callCodes: [],
    operators: [],
  },
  NO_BANNER: FinderContext["announcements"] = { messages: [] },
  NO_FAILURES: string[] = [];
export function Finder({
  initial,
  initialRequest,
  urlQuery,
  shell,
  optionsRead,
  bannerRead,
  format,
}: {
  /** The first page, streaming from the server. */
  initial: Promise<FinderResult>;
  /** The request the server rendered `initial` for. */
  initialRequest: Pick<OpportunityQuery, "tab" | "filters">;
  urlQuery: Partial<FinderQuery>;
  /** What draws first: labels, gates, the Featured preference and the new-dots. */
  shell: FinderShell;
  /** The filter panel's options and the banner stream in after the shell; neither holds the page. */
  optionsRead: Promise<{ options: FinderOptions; failures: string[] }>;
  bannerRead: Promise<FinderContext["announcements"]>;
  format?: FormatSettings;
}) {
  const streamed = useStreamed(optionsRead),
    banner = useStreamed(bannerRead);
  const context: FinderContext = useMemo(
    () => ({
      ...shell,
      options: streamed?.options ?? NO_OPTIONS,
      announcements: banner ?? NO_BANNER,
      failures: streamed?.failures ?? NO_FAILURES,
    }),
    [shell, streamed, banner],
  );
  const { labels: t, gates, options } = context;
  const toast = useToast();
  // A link's filters replace the remembered ones; search, match and sort start over on entry (FinderState.enter).
  const [filters, setFilters] = useState<FinderFilters>(() => {
    const base = remembered.filters
      ? entered(remembered.filters)
      : DEFAULT_FILTERS;
    return hasUrlFilters(urlQuery) ? fromQuery(urlQuery, base) : base;
  });
  const [chosenTab, setChosenTab] = useState<FinderTab | null>(
    () => remembered.tab,
  );
  const [sections, setSections] = useState(() => ({ ...remembered.sections }));
  const [funderSearch, setFunderSearch] = useState(""),
    [searchText, setSearchText] = useState(filters.search),
    [shownSearch, setShownSearch] = useState(filters.search),
    [popup, setPopup] = useState(false),
    [panelOpen, setPanelOpen] = useState(true);
  const tab = resolveTab(chosenTab, context.hasPreferences),
    key = listKey({ tab, filters });
  // Held per tab and filters: a tab already seen shows at once and refreshes in the background. The server's first
  // page (still streaming) seeds only the request it was rendered for.
  const [seed] = useState(() =>
    key === listKey(initialRequest)
      ? initial.then((r) =>
          r.ok
            ? {
                ok: r.ok,
                data: {
                  ...r.data,
                  hasMore: r.data.rows.length >= constants.paging.opportunities,
                },
              }
            : r,
        )
      : undefined,
  );
  const paged = usePagedApi(
    opportunities.finder,
    { tab, filters },
    { initial: seed },
  );
  const seen = new Set<string>(),
    // Rows can move between pages while the list grows; each shows once.
    rows = paged.rows.filter((r) => !seen.has(r.id) && !!seen.add(r.id)),
    failed =
      paged.error && isOffline({ ok: false, error: paged.error })
        ? UNREACHABLE
        : paged.error,
    retry = paged.retry;
  const renderedInitial = useRef(initial),
    matchName = useId();
  // Clear and the advanced popup can change the search; the box follows the state.
  if (shownSearch !== filters.search) {
    setShownSearch(filters.search);
    setSearchText(filters.search);
  }
  const tree = useMemo(
    () => funderTree(options.funders, funderSearch),
    [options.funders, funderSearch],
  );
  // Each failure of the list read toasts once, as the original's toast.degrade.
  useEffect(() => {
    if (failed) toast.error(failed);
  }, [failed, toast]);
  // A preference save refreshes the page (router.refresh): Featured is re-read and the list reloads.
  useEffect(() => {
    if (renderedInitial.current === initial) return;
    renderedInitial.current = initial;
    paged.reload();
    // Only a new server render reloads; paged.reload is a new function each render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initial]);
  // manageFilterURL sync: the panel filters are written back to the address with replace-state.
  useEffect(() => {
    const query = queryString(filters);
    window.history.replaceState(
      null,
      "",
      `${window.location.pathname}${query ? `?${query}` : ""}`,
    );
    remembered.filters = filters;
  }, [filters]);
  useEffect(() => {
    remembered.tab = chosenTab;
    remembered.sections = sections;
  }, [chosenTab, sections]);
  // Read failures toast, as the original's toast.degrade (once per server render).
  useEffect(() => {
    for (const failure of context.failures) toast.show("error", failure);
  }, [context.failures, toast]);
  // Stable (functional updates only), so memoised children such as the funder tree skip re-rendering on every click.
  const patch = useCallback(
    (change: Partial<FinderFilters>) =>
      setFilters((f) => ({ ...f, ...change })),
    [],
  );
  const setFunders = useCallback(
      (funders: FinderFilters["funders"]) => patch({ funders }),
      [patch],
    ),
    tooMany = useCallback(() => toast.show("error", TOO_MANY), [toast]);
  const toggle = (
    field: "status" | "fundingType",
    value: string,
    on: boolean,
  ) =>
    patch({
      [field]: on
        ? [...filters[field], value]
        : filters[field].filter((v) => v !== value),
    });
  const search = (text: string) => {
    if (text !== filters.search) patch({ search: text });
  };
  const section = (name: Section) => ({
    id: `finder-${functions.ids.idPart(name)}`,
    open: sections[name],
    onToggle: (open: boolean) => setSections((s) => ({ ...s, [name]: open })),
  });
  const onScroll = (e: React.UIEvent<HTMLElement>) => {
    const el = e.currentTarget;
    if (
      !failed &&
      !paged.stale &&
      paged.total !== undefined &&
      rows.length < paged.total &&
      el.scrollHeight - el.scrollTop - el.clientHeight <
        constants.paging.loadMorePx
    )
      paged.loadMore();
  };
  const tabs: { id: FinderTab; label: string; isNew: boolean }[] = [
    ...(context.hasPreferences
      ? [
          {
            id: "featured" as const,
            label: t.tabFeatured,
            isNew: context.newFlags.featured,
          },
        ]
      : []),
    { id: "others", label: t.tabOthers, isNew: context.newFlags.others },
    { id: "bookmarked", label: t.tabBookmarked, isNew: false },
    { id: "shared", label: t.tabShared, isNew: false },
  ];
  const card = paged.last?.card,
    count = countStrip(rows.length, paged.total ?? null);
  const panel = (
    <FilterStack id="finder-panel">
      <FilterClear
        id="finder-clear"
        label={t.clear}
        onClick={() => {
          setFunderSearch("");
          setFilters(panelCleared);
        }}
      />
      {gates.funders && (tree.length > 0 || funderSearch) && (
        <FilterSection
          {...section("funders")}
          title={t.funders}
          action={
            <FilterSectionAction
              id="finder-funders-clear"
              label={`${t.advClear} ${t.funders}`}
              icon="close-circle"
              onClick={() => patch({ funders: [] })}
            />
          }
        >
          <input
            id="finder-funders-search"
            className={styles.searchFunders}
            type="search"
            placeholder="Search funders"
            aria-label="Search funders"
            value={funderSearch}
            onChange={(e) => setFunderSearch(e.target.value)}
          />
          <FunderTree
            id="funder-tree"
            nodes={tree}
            selected={filters.funders}
            searching={funderSearch.trim() !== ""}
            label={t.fundersTree}
            onChange={setFunders}
            onTooMany={tooMany}
          />
        </FilterSection>
      )}
      {gates.status && options.status.length > 0 && (
        <FilterSection {...section("status")} title={t.status}>
          <FilterChoices
            id="finder-status-options"
            label={t.status}
            type="checkbox"
            options={options.status}
            selected={filters.status}
            onChange={(value, checked) => toggle("status", value, checked)}
          />
        </FilterSection>
      )}
      {gates.funderType && options.funderTypes.length > 0 && (
        <FilterSection {...section("funderType")} title={t.funderType}>
          <Select
            id="finder-funder-type-select"
            label={t.funderType}
            options={options.funderTypes.map((type) => ({
              value: type,
              label: type,
            }))}
            value={filters.funderType ?? ""}
            onChange={(type) => patch({ funderType: type || null })}
          />
        </FilterSection>
      )}
      {gates.fundingType && options.fundingType.length > 0 && (
        <FilterSection {...section("fundingType")} title={t.fundingType}>
          <FilterChoices
            id="finder-funding-type-options"
            label={t.fundingType}
            type="checkbox"
            options={options.fundingType}
            selected={filters.fundingType}
            onChange={(value, checked) => toggle("fundingType", value, checked)}
          />
        </FilterSection>
      )}
      {gates.dateSort && (
        <FilterSection {...section("dateSort")} title={t.dateSort}>
          <SortControl
            id="finder-sort"
            label={t.dateSort}
            options={DATE_SORTS.map((d) => ({ value: d.code, label: d.label }))}
            value={filters.orderBy}
            dir={filters.dir}
            onChange={(orderBy) => patch({ orderBy: orderBy as DateSort })}
            onDirChange={(dir) => patch({ dir })}
          />
        </FilterSection>
      )}
    </FilterStack>
  );

  return (
    <section
      id="finder"
      className="page-fill"
      aria-label="Funding opportunities"
    >
      <FilterPanel
        id="opportunity-filters"
        label={t.filters}
        page="opportunities"
        filters={panel}
        open={panelOpen}
      >
        <div id="finder-main" className={styles.main}>
          <h1 className="sr-only">Funding opportunities</h1>
          {(context.announcements.messages.length > 0 ||
            context.announcements.error) && (
            <div id="finder-announcements" className={styles.announcements}>
              <Announcements
                id="finder-announcements-banner"
                title={t.announcements}
                messages={context.announcements.messages}
                error={context.announcements.error}
              />
            </div>
          )}
          <div id="finder-toolbar" className={styles.actions}>
            <button
              type="button"
              id="finder-panel-toggle"
              className={`gn-btn gn-btn--outlined gn-btn--icon ${styles.panelToggle}`}
              aria-label={t.toggle}
              aria-expanded={panelOpen}
              aria-controls="opportunity-filters"
              onClick={() => setPanelOpen((o) => !o)}
            >
              <Icon
                name={
                  panelOpen ? "chevron-double-left" : "chevron-double-right"
                }
                size={14}
              />
            </button>
            <div id="finder-search-box" className={styles.search}>
              <Icon className={styles.searchIcon} name="search" size={14} />
              <input
                id="finder-search"
                type="search"
                aria-label={t.searchAria}
                placeholder={t.search}
                maxLength={200}
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                onBlur={(e) => search(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") search(e.currentTarget.value);
                }}
              />
              <button
                type="button"
                id="finder-advanced-toggle"
                className={styles.advanced}
                data-advanced-toggle
                aria-label={t.advanced}
                aria-expanded={popup}
                onClick={() => setPopup((p) => !p)}
              >
                <Icon name="search-list" size={16} />
              </button>
              <AnimatePresence>
                {popup && (
                  <AdvancedFilter
                    filters={filters}
                    context={context}
                    onClose={() => setPopup(false)}
                    onClear={() => setFilters(cleared)}
                    onApply={(draft) => {
                      if (draft.funders.length > MAX_FUNDER_KEYS)
                        return toast.show("error", TOO_MANY);
                      setPopup(false);
                      setFilters(draft);
                    }}
                  />
                )}
              </AnimatePresence>
            </div>
            <div
              id="finder-match"
              className={styles.match}
              role="radiogroup"
              aria-label="When searching multiple words, match all or match any"
            >
              {(["all", "any"] as const).map((match) => (
                <label key={match}>
                  <input
                    id={`finder-match-${match}`}
                    type="radio"
                    name={matchName}
                    checked={filters.match === match}
                    onChange={() => patch({ match })}
                  />
                  {match === "all" ? t.matchAll : t.matchAny}
                </label>
              ))}
            </div>
          </div>
          <div
            id="finder-tabs"
            className={styles.tabs}
            role="tablist"
            aria-label="Opportunity views"
          >
            {tabs.map((item) => (
              <button
                key={item.id}
                id={`finder-tab-${item.id}`}
                type="button"
                role="tab"
                aria-selected={item.id === tab}
                onClick={() => setChosenTab(item.id)}
              >
                {item.label}
                {item.isNew && (
                  <span className={styles.newDot} role="img" aria-label="New" />
                )}
              </button>
            ))}
          </div>
          {!paged.stale && paged.last?.countsUnavailable && (
            <p
              id="finder-counts-notice"
              role="status"
              className={styles.notice}
            >
              Application and proposal counts could not be loaded.
            </p>
          )}
          <ul
            id="finder-list"
            className={styles.list}
            aria-label={t.list}
            aria-busy={paged.stale}
            // The previous tab's or filter's cards stay, dimmed, until the new ones arrive; they cannot be used meanwhile.
            inert={paged.stale}
            onScroll={onScroll}
          >
            {paged.loading && !paged.last ? (
              <li id="finder-list-loading">
                <RecordSkeleton
                  variant="opportunity"
                  label="Loading opportunities"
                />
              </li>
            ) : failed && rows.length === 0 ? (
              <li id="finder-list-error">
                <State
                  title={
                    failed.code === "FORBIDDEN"
                      ? "Access denied"
                      : "Opportunities unavailable"
                  }
                  message={failed.message}
                  action={failed.action}
                  code={failed.code}
                  retry={retry}
                />
              </li>
            ) : rows.length === 0 || !card ? (
              <li id="finder-list-empty" className={styles.empty}>
                {t.noData}
              </li>
            ) : (
              <>
                {rows.map((row) => (
                  <li key={row.id} className="enter-rise">
                    <OpportunityCard format={format} row={row} card={card} />
                  </li>
                ))}
                {paged.loadingMore && (
                  <li id="finder-list-loading-more">
                    <RecordSkeleton
                      variant="opportunity"
                      rows={1}
                      label="Loading more opportunities"
                    />
                  </li>
                )}
                {failed && !paged.loading && (
                  <li className={styles.empty}>
                    <button
                      type="button"
                      id="finder-list-retry"
                      className="gn-btn gn-btn--outlined"
                      onClick={retry}
                    >
                      Retry
                    </button>
                  </li>
                )}
              </>
            )}
          </ul>
          {/* The true count: everything loaded shows the total; otherwise loaded of total. */}
          <p
            id="finder-count"
            className={`listing-count ${styles.total}`}
            aria-live="polite"
          >
            {!paged.stale && paged.total !== undefined ? (
              count.partial ? (
                count.text
              ) : (
                <>
                  <span className={styles.totalTitle}>{t.total}:</span>{" "}
                  {count.text}
                </>
              )
            ) : null}
          </p>
        </div>
      </FilterPanel>
    </section>
  );
}
