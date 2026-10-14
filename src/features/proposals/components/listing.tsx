"use client";
import { RecordSkeleton } from "@/components/feedback/skeleton";
import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { parseQuery, serializeQuery, type ProposalQuery } from "../schemas";
import type { Column, ProposalPage } from "../types";
import { State } from "@/components/feedback/state";
import { RecordCard } from "./record-card";
import type { ListingChoices } from "../lookups";
import { LatestRequest } from "@/lib/latest-request";
type Result =
  | { ok: true; data: ProposalPage }
  | { ok: false; error: { code: string; message: string } };
export function Listing({
  initial,
  columns,
  initialQuery,
  choices,
}: {
  initial: Result;
  columns: Column[];
  initialQuery: ProposalQuery;
  choices: ListingChoices;
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
    [open, setOpen] = useState(true),
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
      fetch(`/api/proposals?${serializeQuery(parsed)}`, {
        signal: request.signal,
        cache: "no-store",
      })
        .then(async (response) => {
          const body = await response.json();
          if (!request.current()) return;
          setResult(
            response.ok
              ? { ok: true, data: body }
              : {
                  ok: false,
                  error: body.error || {
                    code: "UPSTREAM",
                    message: "Listing could not be loaded.",
                  },
                },
          );
        })
        .catch(() => {
          if (request.current())
            setResult({
              ok: false,
              error: {
                code: "UPSTREAM",
                message: "Listing request failed. Please retry.",
              },
            });
        })
        .finally(() => {
          if (request.current()) setLoading(false);
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
    try {
      const response = await fetch(
        `/api/proposals?${serializeQuery({ ...query, page: nextPage })}`,
        { signal: request.signal, cache: "no-store" },
      );
      const body = await response.json();
      if (!request.current()) return;
      if (!response.ok) throw new Error("Load more failed");
      const next = body as ProposalPage;
      const ids = new Set(current.rows.map((row) => row.id));
      if (next.rows.some((row) => ids.has(row.id)))
        throw new Error("Repeated listing page");
      setResult({
        ok: true,
        data: {
          ...next,
          query: current.query,
          rows: [...current.rows, ...next.rows],
        },
      });
    } catch {
      if (request.current())
        setMoreError("More proposals could not be loaded. Retry to continue.");
    } finally {
      if (request.current()) setLoadingMore(false);
    }
  }
  return (
    <section aria-label="Proposal listing">
      <div className="proposal-layout">
        <aside
          className="proposal-filters"
          id="proposal-filters"
          hidden={!open}
          aria-label="Proposal filters"
        >
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
            onChange={(event) => {
              if (event.target instanceof HTMLSelectElement) submit(event);
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
              <select name="investigator" defaultValue={query.investigator}>
                <option value=""></option>
                {choices.investigators.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </select>
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
              <select name="department" defaultValue={query.department}>
                <option value=""></option>
                {choices.departments.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="inside-field">
              <span className="floating-label">Primary Sponsor</span>
              <select name="sponsor" defaultValue={query.sponsor}>
                <option value=""></option>
                {choices.sponsors.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="inside-field">
              <span className="floating-label">Assigned to</span>
              <select name="assignedTo" defaultValue={query.assignedTo}>
                <option value=""></option>
                {choices.assignees.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="inside-field">
              <span className="floating-label">Activity Type</span>
              <select name="activityType" defaultValue={query.activityType}>
                <option value=""></option>
                {choices.activities.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="inside-field">
              <span className="floating-label">Proposal Type</span>
              <select
                name="proposalCategory"
                defaultValue={query.proposalCategory}
              >
                <option value=""></option>
                {choices.proposalTypes.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </select>
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
            <div className="filter-actions">
              <button
                type="button"
                onClick={() => router.push(path, { scroll: false })}
              >
                Clear filters
              </button>
            </div>
          </form>
          {choices.errors.map((error) => (
            <p className="notice" role="status" key={error}>
              {error}
            </p>
          ))}
        </aside>
        <div className="proposal-results">
          <div className="proposal-list-actions">
            <button
              type="button"
              aria-expanded={open}
              aria-controls="proposal-filters"
              onClick={() => setOpen(!open)}
            >
              Filters
            </button>
            <h1 className="sr-only">Proposals</h1>
          </div>
          {formError && (
            <p className="notice" role="alert">
              {formError}
            </p>
          )}
          <details className="listing-query-controls">
            <summary>Advanced Query</summary>
            <div className="table-toolbar">
              <p aria-live="polite">
                {loading || stale
                  ? "Loading proposals…"
                  : current
                    ? `${current.rows.length} rows on this page${current.total === undefined ? "" : ` · ${current.total} API total`}`
                    : "Listing unavailable"}
              </p>
              <label>
                Sort by
                <select
                  value={query.sort}
                  onChange={(e) =>
                    update(
                      {
                        sort: e.target.value as ProposalQuery["sort"],
                        page: 1,
                      },
                      true,
                    )
                  }
                >
                  <option value="creation_date">Creation date</option>
                  <option value="proposal_id">Reference sequence</option>
                  <option value="proposal_title">Title</option>
                  <option value="full_name">Investigator</option>
                </select>
              </label>
              <label>
                Direction
                <select
                  value={query.direction}
                  onChange={(e) =>
                    update(
                      { direction: e.target.value as "ASC" | "DESC", page: 1 },
                      true,
                    )
                  }
                >
                  <option value="DESC">Descending</option>
                  <option value="ASC">Ascending</option>
                </select>
              </label>
            </div>
          </details>
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
                  <RecordCard key={row.id} row={row} columns={columns} />
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
                ? "Loading proposals…"
                : "Listing unavailable"}
          </p>
          <div className="pagination">
            <label>
              Rows per page
              <select
                value={query.pageSize}
                onChange={(e) =>
                  update({ pageSize: Number(e.target.value), page: 1 }, true)
                }
              >
                {[10, 20, 50].map((n) => (
                  <option key={n}>{n}</option>
                ))}
              </select>
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
      </div>
    </section>
  );
}
