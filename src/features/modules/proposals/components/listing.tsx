"use client";
import type { FormatSettings } from "@/lib/format";
import { RecordSkeleton } from "@/components/feedback/skeleton";
import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { parseQuery, serializeQuery, type ProposalQuery } from "../schemas";
import type { Column, ProposalPage } from "../types";
import { State } from "@/components/feedback/state";
import { RecordCard } from "./record-card";
import type { ListingChoices } from "../lookups";
import { LatestRequest } from "@/lib/store/latest-request";
import { proposals, session } from "@/lib/api";
import { FilterPanel } from "@/components/ui/filter-panel";
import { Select, type SelectOption } from "@/components/ui/select";
import styles from "./listing.module.css";
type Result =
  | { ok: true; data: ProposalPage }
  | { ok: false; error: { code: string; message: string; action?: string } };
const LABELS = {
  investigator: "Investigator",
  department: "Department",
  sponsor: "Primary Sponsor",
  assignedTo: "Assigned to",
  activityType: "Activity Type",
  proposalCategory: "Proposal Type",
} as const;
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
export function Listing({
  initial,
  columns,
  initialQuery,
  choices,
  format,
}: {
  initial: Result;
  columns: Column[];
  initialQuery: ProposalQuery;
  choices: ListingChoices;
  format?: FormatSettings;
}) {
  const router = useRouter(),
    path = usePathname(),
    params = useSearchParams(),
    queryKey = params.toString();
  const [result, setResult] = useState(initial),
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
    result.ok && serializeQuery(result.data.query) !== serializeQuery(query);
  const current =
    result.ok && !stale && !loading && !invalid ? result.data : undefined;
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
              <label className="inside-field">
                <span className="floating-label">Investigator</span>
                <FormSelect
                  id="proposals-filter-investigator"
                  name="investigator"
                  label={LABELS.investigator}
                  defaultValue={query.investigator}
                  options={choices.investigators}
                />
              </label>
              <fieldset className="category-options">
                <legend>Category</legend>
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
              <label className="inside-field">
                <span className="floating-label">Proposal Number</span>
                <input
                  name="reference"
                  aria-label="Reference"
                  defaultValue={query.reference}
                  placeholder=" "
                  maxLength={200}
                />
              </label>
              <label className="inside-field">
                <span className="floating-label">Title</span>
                <input
                  name="search"
                  aria-label="Search proposal titles"
                  type="search"
                  defaultValue={query.search}
                  placeholder=" "
                  maxLength={200}
                />
              </label>
              <label className="inside-field">
                <span className="floating-label">Department</span>
                <FormSelect
                  id="proposals-filter-department"
                  name="department"
                  label={LABELS.department}
                  defaultValue={query.department}
                  options={choices.departments}
                />
              </label>
              <label className="inside-field">
                <span className="floating-label">Primary Sponsor</span>
                <FormSelect
                  id="proposals-filter-sponsor"
                  name="sponsor"
                  label={LABELS.sponsor}
                  defaultValue={query.sponsor}
                  options={choices.sponsors}
                />
              </label>
              <label className="inside-field">
                <span className="floating-label">Assigned to</span>
                <FormSelect
                  id="proposals-filter-assignedTo"
                  name="assignedTo"
                  label={LABELS.assignedTo}
                  defaultValue={query.assignedTo}
                  options={choices.assignees}
                />
              </label>
              <label className="inside-field">
                <span className="floating-label">Activity Type</span>
                <FormSelect
                  id="proposals-filter-activityType"
                  name="activityType"
                  label={LABELS.activityType}
                  defaultValue={query.activityType}
                  options={choices.activities}
                />
              </label>
              <label className="inside-field">
                <span className="floating-label">Proposal Type</span>
                <FormSelect
                  id="proposals-filter-proposalCategory"
                  name="proposalCategory"
                  label={LABELS.proposalCategory}
                  defaultValue={query.proposalCategory}
                  options={choices.proposalTypes}
                />
              </label>
              <label className="inside-field">
                <span className="floating-label">Tags</span>
                <input name="tags" defaultValue={query.tags} maxLength={200} />
              </label>
              <label className="inside-field">
                <span className="floating-label">Created from</span>
                <input name="from" type="date" defaultValue={query.from} />
              </label>
              <label className="inside-field">
                <span className="floating-label">Created through</span>
                <input name="to" type="date" defaultValue={query.to} />
              </label>
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
          ) : loading || stale ? (
            <RecordSkeleton variant="proposal" label="Loading proposals" />
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
                  <RecordSkeleton label="Loading more proposals" rows={1} />
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
