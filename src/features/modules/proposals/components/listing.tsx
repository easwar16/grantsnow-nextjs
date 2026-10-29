"use client";
import type { FormatSettings } from "@/lib/format";
import { ListSkeleton } from "@/components/feedback/skeleton";
import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { parseQuery, serializeQuery, type ProposalQuery } from "../schemas";
import type { Column, FilterLabels, ProposalPage } from "../types";
import { State } from "@/components/feedback/state";
import { RecordCard } from "./record-card";
import type { ListingChoices } from "../lookups";
import { LatestRequest } from "@/lib/store/latest-request";
import { proposals, session, useApi } from "@/lib/api";
import { FilterPanel } from "@/components/ui/filter-panel";
import { Select, type SelectOption } from "@/components/ui/select";
import styles from "./listing.module.css";
type Result =
  | { ok: true; data: ProposalPage }
  | { ok: false; error: { code: string; message: string; action?: string } };
/** A filter dropdown in the listing's form: its value submits through `name`, and a pick submits the form. */
function FormSelect({
  id,
  name,
  label,
  defaultValue,
  options,
}: {
  id: string;
  name: string;
  label: string;
  defaultValue: string;
  options: SelectOption[];
}) {
  const [value, setValue] = useState(defaultValue),
    box = useRef<HTMLSpanElement>(null),
    picked = useRef(false);
  // Submit once the hidden input holds the pick, so the form reads it as it reads every other field.
  useEffect(() => {
    if (!picked.current) return;
    picked.current = false;
    box.current?.closest("form")?.requestSubmit();
  }, [value]);
  return (
    <span ref={box}>
      <Select
        id={id}
        name={name}
        label={label}
        value={value}
        options={options}
        onChange={(next) => {
          picked.current = true;
          setValue(next);
        }}
      />
    </span>
  );
}
const NONE: ListingChoices = {
  statuses: [],
  categories: [],
  investigators: [],
  assignees: [],
  departments: [],
  sponsors: [],
  activities: [],
  proposalTypes: [],
  sorts: [],
  errors: [],
};
export function Listing({
  initial,
  columns,
  filters,
  initialQuery,
  format,
}: {
  /** The URL query's first page, streaming from the server. */
  initial: Promise<Result>;
  columns: Column[];
  filters: FilterLabels;
  initialQuery: ProposalQuery;
  format?: FormatSettings;
}) {
  // Each choice group fills its filters as it arrives; a slow lookup never holds the others.
  const groups = [
    useApi(proposals.choices, "codes").data,
    useApi(proposals.choices, "people").data,
    useApi(proposals.choices, "sponsors").data,
    useApi(proposals.choices, "departments").data,
    useApi(proposals.choices, "sorts").data,
  ];
  const choices: ListingChoices = {
    ...NONE,
    ...Object.assign({}, ...groups),
    errors: groups.flatMap((g) => g?.errors ?? []),
  };
  const router = useRouter(),
    path = usePathname(),
    params = useSearchParams(),
    queryKey = params.toString();
  const [result, setResult] = useState<Result | null>(null),
    [loading, setLoading] = useState(false),
    [loadingMore, setLoadingMore] = useState(false),
    [moreError, setMoreError] = useState(""),
    [retry, setRetry] = useState(0),
    [formError, setFormError] = useState("");
  const leftInitialQuery = useRef(false),
    latest = useRef(new LatestRequest()),
    initialKey = useRef(queryKey);
  let query = initialQuery;
  let invalid = false;
  try {
    query = parseQuery(new URLSearchParams(queryKey));
  } catch {
    invalid = true;
  }
  // The server's page lands only while the query it was rendered for is still the one shown.
  useEffect(() => {
    void initial.then((r) => {
      if (!leftInitialQuery.current) setResult(r);
    });
  }, [initial]);
  useEffect(() => {
    if (
      !leftInitialQuery.current &&
      initialKey.current === queryKey &&
      retry === 0
    ) {
      return;
    }
    leftInitialQuery.current = true;
    const manager = latest.current,
      request = manager.begin();
    let parsed: ProposalQuery;
    try {
      parsed = parseQuery(new URLSearchParams(queryKey));
    } catch {
      return () => manager.cancel();
    }
    const timer = setTimeout(() => {
      setLoading(true);
      setLoadingMore(false);
      setMoreError("");
      void proposals.page(parsed, request.signal).then((r) => {
        if (!request.current()) return;
        setResult(
          r.ok || !session.offline(r.error)
            ? r
            : {
                ok: false,
                error: {
                  code: "UPSTREAM",
                  message: "Listing request failed. Please retry.",
                },
              },
        );
        setLoading(false);
      });
    }, 180);
    return () => {
      clearTimeout(timer);
      manager.cancel();
    };
  }, [queryKey, retry]);
  function update(patch: Partial<ProposalQuery>, push = false) {
    const next = { ...query, ...patch };
    const url = `${path}?${serializeQuery(next)}`;
    if (push) router.push(url, { scroll: false });
    else router.replace(url, { scroll: false });
  }
  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const patch = Object.fromEntries(
      [...data.entries()].map(([k, v]) => [k, String(v)]),
    );
    try {
      const parsed = parseQuery(
        new URLSearchParams({
          ...Object.fromEntries(new URLSearchParams(serializeQuery(query))),
          ...patch,
          page: "1",
        }),
      );
      setFormError("");
      if (serializeQuery(parsed) !== serializeQuery(query))
        update(parsed, true);
    } catch {
      setFormError(
        "Check your filters. Created from must be on or before Created through.",
      );
    }
  }
  const stale =
    result?.ok && serializeQuery(result.data.query) !== serializeQuery(query);
  const current =
    result?.ok && !stale && !loading && !invalid ? result.data : undefined;
  async function loadMore() {
    if (!current?.hasMore || loadingMore || loading) return;
    const request = latest.current.begin();
    setLoadingMore(true);
    setMoreError("");
    const nextPage =
      query.page + Math.ceil(current.rows.length / query.pageSize);
    const r = await proposals.page(
      { ...query, page: nextPage },
      request.signal,
    );
    if (!request.current()) return;
    setLoadingMore(false);
    const ids = new Set(current.rows.map((row) => row.id));
    if (!r.ok || r.data.rows.some((row) => ids.has(row.id))) {
      setMoreError("More proposals could not be loaded. Retry to continue.");
      return;
    }
    setResult({
      ok: true,
      data: {
        ...r.data,
        query: current.query,
        rows: [...current.rows, ...r.data.rows],
      },
    });
  }
  return (
    <section className="page-fill" aria-label="Proposal listing">
      <FilterPanel
        id="proposal-filters"
        label="Proposal filters"
        page="proposals"
        filters={
          <>
            <div
              role="tablist"
              aria-label="Filter by Proposal Status"
              className="status-tabs"
            >
              {[
                { value: "", label: "All" },
                ...choices.statuses.filter((c) => c.value),
              ].map((c) => (
                <button
                  type="button"
                  role="tab"
                  key={c.value}
                  aria-selected={query.status === c.value}
                  onClick={() => update({ status: c.value, page: 1 }, true)}
                >
                  {c.label}
                </button>
              ))}
            </div>
            <form
              onSubmit={submit}
              onKeyDown={(event) => {
                if (
                  event.key === "Enter" &&
                  event.target instanceof HTMLInputElement &&
                  event.target.type !== "radio"
                ) {
                  event.preventDefault();
                  event.currentTarget.requestSubmit();
                }
              }}
              onBlur={(event) => {
                if (
                  event.target instanceof HTMLInputElement &&
                  event.target.type !== "radio"
                )
                  submit(event);
              }}
              key={queryKey}
              className="filter-panel"
            >
              {filters.investigator !== null && (
                <label className="inside-field">
                  <span className="floating-label">{filters.investigator}</span>
                  <FormSelect
                    id="proposals-filter-investigator"
                    name="investigator"
                    label={filters.investigator}
                    defaultValue={query.investigator}
                    options={choices.investigators}
                  />
                </label>
              )}
              {filters.category !== null && (
                <fieldset className="category-options">
                  <legend>{filters.category}</legend>
                  {[
                    { value: "", label: "All" },
                    ...choices.categories.filter((c) =>
                      [
                        "PROPOSAL",
                        "OUTLINE_PROPOSAL",
                        "SUB_PROPOSAL",
                        "EXTENSION_PROPOSAL",
                      ].includes(c.value),
                    ),
                  ].map((c) => (
                    <label key={c.value}>
                      <input
                        type="radio"
                        name="type"
                        value={c.value}
                        defaultChecked={query.type === c.value}
                        onChange={() =>
                          update(
                            { type: c.value as ProposalQuery["type"], page: 1 },
                            true,
                          )
                        }
                      />
                      {c.label}
                    </label>
                  ))}
                </fieldset>
              )}
              {filters.reference !== null && (
                <label className="inside-field">
                  <span className="floating-label">{filters.reference}</span>
                  <input
                    name="reference"
                    defaultValue={query.reference}
                    placeholder=" "
                    maxLength={200}
                  />
                </label>
              )}
              {filters.search !== null && (
                <label className="inside-field">
                  <span className="floating-label">{filters.search}</span>
                  <input
                    name="search"
                    type="search"
                    defaultValue={query.search}
                    placeholder=" "
                    maxLength={200}
                  />
                </label>
              )}
              {filters.department !== null && (
                <label className="inside-field">
                  <span className="floating-label">{filters.department}</span>
                  <FormSelect
                    id="proposals-filter-department"
                    name="department"
                    label={filters.department}
                    defaultValue={query.department}
                    options={choices.departments}
                  />
                </label>
              )}
              {filters.sponsor !== null && (
                <label className="inside-field">
                  <span className="floating-label">{filters.sponsor}</span>
                  <FormSelect
                    id="proposals-filter-sponsor"
                    name="sponsor"
                    label={filters.sponsor}
                    defaultValue={query.sponsor}
                    options={choices.sponsors}
                  />
                </label>
              )}
              {filters.assignedTo !== null && (
                <label className="inside-field">
                  <span className="floating-label">{filters.assignedTo}</span>
                  <FormSelect
                    id="proposals-filter-assignedTo"
                    name="assignedTo"
                    label={filters.assignedTo}
                    defaultValue={query.assignedTo}
                    options={choices.assignees}
                  />
                </label>
              )}
              {filters.activityType !== null && (
                <label className="inside-field">
                  <span className="floating-label">{filters.activityType}</span>
                  <FormSelect
                    id="proposals-filter-activityType"
                    name="activityType"
                    label={filters.activityType}
                    defaultValue={query.activityType}
                    options={choices.activities}
                  />
                </label>
              )}
              {filters.proposalCategory !== null && (
                <label className="inside-field">
                  <span className="floating-label">
                    {filters.proposalCategory}
                  </span>
                  <FormSelect
                    id="proposals-filter-proposalCategory"
                    name="proposalCategory"
                    label={filters.proposalCategory}
                    defaultValue={query.proposalCategory}
                    options={choices.proposalTypes}
                  />
                </label>
              )}
              {filters.tags !== null && (
                <label className="inside-field">
                  <span className="floating-label">{filters.tags}</span>
                  <input
                    name="tags"
                    defaultValue={query.tags}
                    maxLength={200}
                  />
                </label>
              )}
              {filters.from !== null && (
                <label className="inside-field">
                  <span className="floating-label">{filters.from}</span>
                  <input name="from" type="date" defaultValue={query.from} />
                </label>
              )}
              {filters.to !== null && (
                <label className="inside-field">
                  <span className="floating-label">{filters.to}</span>
                  <input name="to" type="date" defaultValue={query.to} />
                </label>
              )}
            </form>
            {formError && (
              <p className="notice" role="alert">
                {formError}
              </p>
            )}
            <fieldset className={styles.query}>
              <legend>Advanced Query</legend>
              <label>
                Sort by
                <Select
                  id="proposals-sort"
                  label="Sort by"
                  value={query.sort}
                  clearable={false}
                  options={[
                    { value: "", label: "Default order" },
                    ...choices.sorts,
                  ]}
                  onChange={(next) =>
                    update(
                      { sort: next as ProposalQuery["sort"], page: 1 },
                      true,
                    )
                  }
                />
              </label>
              <label>
                Direction
                <Select
                  id="proposals-direction"
                  label="Direction"
                  value={query.direction}
                  clearable={false}
                  disabled={query.sort === ""}
                  options={[
                    { value: "DESC", label: "Descending" },
                    { value: "ASC", label: "Ascending" },
                  ]}
                  onChange={(next) =>
                    update({ direction: next as "ASC" | "DESC", page: 1 }, true)
                  }
                />
              </label>
            </fieldset>
            <div className="filter-actions">
              <button
                type="button"
                onClick={() => router.push(path, { scroll: false })}
              >
                Clear filters
              </button>
            </div>
            {choices.errors.map((error) => (
              <p className="notice" role="status" key={error}>
                {error}
              </p>
            ))}
          </>
        }
      >
        <div className="proposal-results">
          <h1 className="sr-only">Proposals</h1>
          {invalid ? (
            <State
              title="Invalid listing filters"
              message="Clear filters to recover."
              code="BAD_REQUEST"
            />
          ) : !result || loading || stale ? (
            <ListSkeleton variant="proposal" label="Loading proposals" />
          ) : !result.ok ? (
            <State
              title={
                result.error.code === "FORBIDDEN"
                  ? "Access denied"
                  : "Proposals unavailable"
              }
              code={result.error.code}
              message={result.error.message}
              action={result.error.action}
              retry={() => setRetry((n) => n + 1)}
            />
          ) : current?.rows.length === 0 ? (
            <State
              title={
                query.search ||
                query.reference ||
                query.status ||
                query.type ||
                query.faculty ||
                query.sponsor ||
                query.from ||
                query.to
                  ? "No matching proposals"
                  : "No proposals on this page"
              }
              message="Clear filters or select a previous page to adjust your view."
            />
          ) : (
            current && (
              <div
                className="proposal-cards"
                aria-label="Authorized proposals"
                onScroll={(e) => {
                  const list = e.currentTarget;
                  if (
                    list.scrollHeight - list.scrollTop - list.clientHeight <
                      80 &&
                    !moreError
                  )
                    void loadMore();
                }}
              >
                {current.rows.map((row) => (
                  <RecordCard
                    key={row.id}
                    row={row}
                    columns={columns}
                    format={format}
                  />
                ))}
                {loadingMore && (
                  <ListSkeleton label="Loading more proposals" rows={1} />
                )}
                {moreError && (
                  <div className="notice" role="alert">
                    {moreError}
                    <button onClick={() => void loadMore()}>
                      Retry load more
                    </button>
                  </div>
                )}
              </div>
            )
          )}
          <p className="listing-count" aria-live="polite">
            {current
              ? `${current.rows.length} of ${current.total ?? "unknown total"}`
              : loading || stale
                ? null
                : "Listing unavailable"}
          </p>
          <div className="pagination">
            <label>
              Rows per page
              <Select
                id="proposals-page-size"
                label="Rows per page"
                value={String(query.pageSize)}
                clearable={false}
                options={[10, 20, 50].map((n) => ({
                  value: String(n),
                  label: String(n),
                }))}
                onChange={(next) =>
                  update({ pageSize: Number(next), page: 1 }, true)
                }
              />
            </label>
            <span>Page {query.page}</span>
            <button
              disabled={query.page === 1 || loading}
              onClick={() => update({ page: query.page - 1 }, true)}
            >
              Previous
            </button>
            <button
              disabled={!current?.hasMore || loading}
              onClick={() => update({ page: query.page + 1 }, true)}
            >
              Next
            </button>
          </div>
        </div>
      </FilterPanel>
    </section>
  );
}
