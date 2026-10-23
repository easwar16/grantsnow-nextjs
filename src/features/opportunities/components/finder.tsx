"use client";
import { idPart } from "@/lib/ids";
import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
import type { FormatSettings } from "@/lib/format";
import { LatestRequest } from "@/lib/latest-request";
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
import { usePresence } from "@/lib/use-presence";
import { Icon } from "@/components/ui/icon";
import { Announcements } from "@/features/home/components/announcements";
import type { FinderContext } from "@/server/opportunities/service";
import {
  listKey,
  serializeOpportunityQuery,
  type OpportunityQuery,
} from "../schemas";
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
  PAGE_SIZE,
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
type Failure = { code: string; message: string; action?: string };
type Page = {
  rows: OpportunityRow[];
  total: number;
  card: OpportunityCardModel;
  countsUnavailable?: true;
};
export type FinderResult =
  { ok: true; data: Page } | { ok: false; error: Failure };
interface List {
  key: string;
  rows: OpportunityRow[];
  total: number | null;
  card?: OpportunityCardModel;
  countsUnavailable?: true;
  loading: boolean;
  /** The last page came back short: nothing more to load. */
  done: boolean;
  error?: Failure;
}
const UNREACHABLE: Failure = {
  code: "UPSTREAM",
  message: "Opportunities could not be loaded. Please retry.",
};
// The list loads its next page within this distance of the bottom (GN-Angular LOAD_MORE_PX).
const LOAD_MORE_PX = 80;
const TOO_MANY = "Cannot add these many filter options";
type Section = keyof typeof remembered.sections;
/**
 * "All Opportunities" (opportunities-finder): the filter panel, search with Match All / Any, the advanced filter,
 * the tabs and the infinite card list. Every filter change applies at once; the server builds the SQL.
 */
export function Finder({
  initial,
  initialRequest,
  urlQuery,
  context,
  format,
}: {
  initial: FinderResult;
  /** The request the server rendered `initial` for. */
  initialRequest: Pick<OpportunityQuery, "tab" | "filters">;
  urlQuery: Partial<FinderQuery>;
  context: FinderContext;
  format?: FormatSettings;
}) {
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
    [panelOpen, setPanelOpen] = useState(true),
    [reload, setReload] = useState(0);
  const advanced = usePresence(popup);
  const tab = resolveTab(chosenTab, context.hasPreferences),
    key = listKey({ tab, filters });
  const [list, setList] = useState<List>(() => ({
    key: listKey(initialRequest),
    rows: initial.ok ? initial.data.rows : [],
    total: initial.ok ? initial.data.total : null,
    card: initial.ok ? initial.data.card : undefined,
    countsUnavailable: initial.ok ? initial.data.countsUnavailable : undefined,
    loading: false,
    done: initial.ok && initial.data.rows.length < PAGE_SIZE,
    error: initial.ok ? undefined : initial.error,
  }));
  const latest = useRef(new LatestRequest()),
    renderedInitial = useRef(initial),
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
  // Sets list state only once the answer is in, so an effect may start it.
  function fetchPage(offset: number) {
    const request = latest.current.begin();
    fetch(
      `/api/opportunities?${serializeOpportunityQuery({ tab, filters, offset })}`,
      { signal: request.signal, cache: "no-store" },
    )
      .then(async (response) => {
        const body = await response.json();
        if (!request.current()) return;
        if (!response.ok) throw (body.error as Failure) ?? UNREACHABLE;
        const page = body as Page;
        setList((l) => {
          const seen = new Set(l.rows.map((r) => r.id));
          return {
            key,
            rows: [
              ...(offset ? l.rows : []),
              ...page.rows.filter((r) => offset === 0 || !seen.has(r.id)),
            ],
            total: page.total,
            card: page.card,
            countsUnavailable: page.countsUnavailable,
            loading: false,
            done: page.rows.length < PAGE_SIZE,
          };
        });
      })
      .catch((e: unknown) => {
        if (!request.current()) return;
        const error =
          e && typeof e === "object" && "message" in e && "code" in e
            ? (e as Failure)
            : UNREACHABLE;
        toast.error(error);
        setList((l) => ({ ...l, loading: false, error }));
      });
  }
  /** From an event: shows the loading state at once, then fetches. */
  function load(offset: number) {
    setList((l) =>
      offset === 0
        ? { key, rows: [], total: null, loading: true, done: false }
        : { ...l, loading: true, error: undefined },
    );
    fetchPage(offset);
  }
  // A new tab or filter starts the list over; the server's first page is used when it already matches.
  useEffect(() => {
    if (list.key === key && reload === 0) return;
    fetchPage(0);
    // fetchPage reads this render's tab and filters, which key already captures.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, reload]);
  useEffect(() => {
    const manager = latest.current;
    return () => manager.cancel();
  }, []);
  // A preference save refreshes the page (router.refresh): Featured is re-read and the list reloads.
  useEffect(() => {
    if (renderedInitial.current === initial) return;
    renderedInitial.current = initial;
    setReload((n) => n + 1);
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
    if (!initial.ok) toast.error(initial.error);
  }, [context.failures, initial, toast]);
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
    id: `finder-${idPart(name)}`,
    open: sections[name],
    onToggle: (open: boolean) => setSections((s) => ({ ...s, [name]: open })),
  });
  const onScroll = (e: React.UIEvent<HTMLElement>) => {
    const el = e.currentTarget;
    if (
      !list.loading &&
      !list.error &&
      !list.done &&
      list.key === key &&
      list.total !== null &&
      list.rows.length < list.total &&
      el.scrollHeight - el.scrollTop - el.clientHeight < LOAD_MORE_PX
    )
      load(list.rows.length);
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
  const current = list.key === key,
    count = countStrip(list.rows.length, list.total);
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
          <select
            id="finder-funder-type-select"
            className="gn-control"
            aria-label={t.funderType}
            value={filters.funderType ?? ""}
            onChange={(e) => patch({ funderType: e.target.value || null })}
          >
            <option value="" />
            {options.funderTypes.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>
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
              {advanced.mounted && (
                <AdvancedFilter
                  leaving={advanced.leaving}
                  onLeft={advanced.done}
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
          {current && list.countsUnavailable && (
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
            onScroll={onScroll}
          >
            {!current || (list.loading && list.rows.length === 0) ? (
              <li id="finder-list-loading">
                <RecordSkeleton
                  variant="opportunity"
                  label="Loading opportunities"
                />
              </li>
            ) : list.error && list.rows.length === 0 ? (
              <li id="finder-list-error">
                <State
                  title={
                    list.error.code === "FORBIDDEN"
                      ? "Access denied"
                      : "Opportunities unavailable"
                  }
                  message={list.error.message}
                  action={list.error.action}
                  code={list.error.code}
                  retry={() => load(0)}
                />
              </li>
            ) : list.rows.length === 0 || !list.card ? (
              <li id="finder-list-empty" className={styles.empty}>
                {t.noData}
              </li>
            ) : (
              <>
                {list.rows.map((row) => (
                  <li key={row.id} className="enter-rise">
                    <OpportunityCard
                      format={format}
                      row={row}
                      card={list.card!}
                    />
                  </li>
                ))}
                {list.loading && (
                  <li id="finder-list-loading-more">
                    <RecordSkeleton
                      variant="opportunity"
                      rows={1}
                      label="Loading more opportunities"
                    />
                  </li>
                )}
                {list.error && !list.loading && (
                  <li className={styles.empty}>
                    <button
                      type="button"
                      id="finder-list-retry"
                      className="gn-btn gn-btn--outlined"
                      onClick={() => load(list.rows.length)}
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
            {current && list.total !== null ? (
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
