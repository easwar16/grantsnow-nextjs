"use client";
import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  parseOpportunityQuery,
  serializeOpportunityQuery,
  type OpportunityQuery,
} from "../schemas";
import type { OpportunityPage, OpportunityRow } from "../types";
import { LatestRequest } from "@/lib/latest-request";
import { State } from "@/components/feedback/state";
import { dateDisplay, moneyDisplay } from "@/lib/format";
type Result =
  | { ok: true; data: OpportunityPage }
  | { ok: false; error: { code: string; message: string } };
export function Finder({
  initial,
  initialQuery,
}: {
  initial: Result;
  initialQuery: OpportunityQuery;
}) {
  const router = useRouter(),
    params = useSearchParams(),
    key = params.toString();
  const [result, setResult] = useState(initial),
    [loading, setLoading] = useState(false),
    [retry, setRetry] = useState(0),
    [filtersOpen, setFiltersOpen] = useState(true),
    [selected, setSelected] = useState<OpportunityRow>();
  const first = useRef(true),
    latest = useRef(new LatestRequest()),
    dialog = useRef<HTMLDialogElement>(null);
  let query = initialQuery,
    invalid = false;
  try {
    query = parseOpportunityQuery(new URLSearchParams(key));
  } catch {
    invalid = true;
  }
  useEffect(() => {
    if (first.current && retry === 0) {
      first.current = false;
      return;
    }
    const manager = latest.current,
      request = manager.begin();
    let parsed: OpportunityQuery;
    try {
      parsed = parseOpportunityQuery(new URLSearchParams(key));
    } catch {
      return () => manager.cancel();
    }
    const timer = setTimeout(() => {
      setLoading(true);
      fetch(`/api/opportunities?${serializeOpportunityQuery(parsed)}`, {
        signal: request.signal,
        cache: "no-store",
      })
        .then(async (response) => {
          const b = await response.json();
          if (request.current())
            setResult(
              response.ok
                ? { ok: true, data: b }
                : { ok: false, error: b.error },
            );
        })
        .catch(() => {
          if (request.current())
            setResult({
              ok: false,
              error: {
                code: "UPSTREAM",
                message: "Opportunities could not be loaded. Please retry.",
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
  }, [key, retry]);
  function update(patch: Partial<OpportunityQuery>) {
    router.push(
      `/opportunities?${serializeOpportunityQuery({ ...query, ...patch })}`,
      { scroll: false },
    );
  }
  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const b = Object.fromEntries(new FormData(event.currentTarget));
    try {
      update(
        parseOpportunityQuery(
          new URLSearchParams({
            ...Object.fromEntries(
              new URLSearchParams(serializeOpportunityQuery(query)),
            ),
            ...(b as Record<string, string>),
            page: "1",
          }),
        ),
      );
    } catch {
      /* HTML constraints expose invalid values before submission. */
    }
  }
  const stale =
    result.ok &&
    serializeOpportunityQuery(result.data.query) !==
      serializeOpportunityQuery(query);
  const data =
    result.ok && !stale && !loading && !invalid ? result.data : undefined;
  return (
    <section className="opportunity-layout" aria-label="Funding opportunities">
      <aside
        className="opportunity-filters"
        hidden={!filtersOpen}
        aria-label="Opportunity filters"
      >
        <button
          onClick={() => router.push("/opportunities", { scroll: false })}
        >
          Clear
        </button>
        <form key={key} onSubmit={submit}>
          <label>
            Filter By Funders
            <input
              name="funder"
              placeholder="Search funders"
              defaultValue={query.funder}
            />
          </label>
          <fieldset>
            <legend>Status</legend>
            {["OPEN", "UPCOMING", "CLOSED"].map((status) => (
              <label key={status}>
                <input
                  type="checkbox"
                  checked={query.status.split(",").includes(status)}
                  onChange={(e) =>
                    update({
                      status: e.target.checked
                        ? [
                            ...query.status.split(",").filter(Boolean),
                            status,
                          ].join(",")
                        : query.status
                            .split(",")
                            .filter((s) => s !== status)
                            .join(","),
                      page: 1,
                    })
                  }
                />
                {status.charAt(0) + status.slice(1).toLowerCase()}
              </label>
            ))}
          </fieldset>
          <label>
            Funding Type
            <input name="fundingType" defaultValue={query.fundingType} />
          </label>
          <label>
            Date Sort
            <select name="sort" defaultValue={query.sort}>
              <option value="publication_date">Publication date</option>
              <option value="opening_date">Opening date</option>
              <option value="closing_date">Closing date</option>
              <option value="opp_heading">Title</option>
            </select>
          </label>
          <label>
            Direction
            <select name="direction" defaultValue={query.direction}>
              <option value="DESC">Descending</option>
              <option value="ASC">Ascending</option>
            </select>
          </label>
          <button type="submit">Apply filters</button>
        </form>
      </aside>
      <div className="opportunity-results">
        <h1 className="sr-only">Funding opportunities</h1>
        <div className="opportunity-search">
          <button
            aria-label="Toggle opportunity filters"
            aria-expanded={filtersOpen}
            onClick={() => setFiltersOpen(!filtersOpen)}
          >
            «
          </button>
          <form key={key} onSubmit={submit}>
            <label>
              <span className="sr-only">Search opportunities</span>
              <input
                name="search"
                type="search"
                placeholder="Search"
                defaultValue={query.search}
              />
            </label>
            <button type="submit" className="sr-only">
              Search
            </button>
          </form>
          <fieldset>
            {["all", "any"].map((match) => (
              <label key={match}>
                <input
                  type="radio"
                  name="match"
                  checked={query.match === match}
                  onChange={() =>
                    update({ match: match as "all" | "any", page: 1 })
                  }
                />
                {match === "all" ? "Match All" : "Match Any"}
              </label>
            ))}
          </fieldset>
        </div>
        <div
          className="opportunity-tabs"
          role="tablist"
          aria-label="Opportunity views"
        >
          {["featured", "others", "bookmarked", "shared"].map((tab) => (
            <button
              key={tab}
              role="tab"
              aria-selected={query.tab === tab}
              onClick={() =>
                update({ tab: tab as OpportunityQuery["tab"], page: 1 })
              }
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </div>
        {invalid ? (
          <State title="Invalid opportunity filters" code="BAD_REQUEST" />
        ) : loading || stale ? (
          <State title="Loading opportunities…" />
        ) : !result.ok ? (
          <State
            title={
              result.error.code === "FORBIDDEN"
                ? "Access denied"
                : "Opportunities unavailable"
            }
            message={result.error.message}
            code={result.error.code}
            retry={() => setRetry((n) => n + 1)}
          />
        ) : !data?.rows.length ? (
          <State
            title="No matching opportunities"
            message="Clear filters or select another view."
          />
        ) : (
          <div className="opportunity-cards">
            {data.rows.map((row) => (
              <article
                key={row.id}
                className="opportunity-card"
                aria-label={row.title}
              >
                <div className="opportunity-card-heading">
                  {row.logo && (
                    <Image
                      src={row.logo}
                      alt=""
                      width={36}
                      height={36}
                      unoptimized
                    />
                  )}
                  <h2>
                    {row.url ? (
                      <a
                        href={row.url}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        {row.title}
                      </a>
                    ) : (
                      row.title
                    )}
                  </h2>
                  <button
                    className="icon-button"
                    aria-label={`More information: ${row.title}`}
                    onClick={() => {
                      setSelected(row);
                      dialog.current?.showModal();
                    }}
                  >
                    ⓘ
                  </button>
                  <span className="opportunity-status">● {row.status}</span>
                </div>
                <div className="opportunity-tags">
                  {row.site && <span>{row.site}</span>}
                  {row.funders && <span>{row.funders}</span>}
                  {row.coFunders && <span>{row.coFunders}</span>}
                </div>
                <div className="opportunity-financials">
                  {row.fundingType && (
                    <div>
                      <small>Funding Type</small>
                      {row.fundingType}
                    </div>
                  )}
                  {row.totalFund !== undefined && (
                    <div>
                      <small>Total Fund</small>
                      <strong>
                        {moneyDisplay(row.totalFund, row.currency).replace(
                          /\.00$/,
                          "",
                        )}
                      </strong>
                    </div>
                  )}
                </div>
                <div className="opportunity-dates">
                  {[
                    ["Publication Date", row.published],
                    ["Opening Date", row.opening],
                    ["Closing Date", row.closing],
                  ].map(([label, value]) => (
                    <div key={label}>
                      <small>{label}</small>
                      {value
                        ? dateDisplay(value)
                        : label === "Closing Date"
                          ? "Check website"
                          : "N/A"}
                    </div>
                  ))}
                </div>
                {[row.applications, row.proposals, row.outlines].some(
                  (n) => n !== undefined,
                ) && (
                  <div className="opportunity-counts">
                    {[
                      ["Number of Applications", row.applications],
                      ["Number of Proposals", row.proposals],
                      ["Number of Outline Proposals", row.outlines],
                    ]
                      .filter(([, n]) => n !== undefined)
                      .map(([label, n]) => (
                        <div key={String(label)}>
                          <small>{label}</small>
                          <strong>{n}</strong>
                        </div>
                      ))}
                  </div>
                )}
              </article>
            ))}
          </div>
        )}
        <p className="listing-count" aria-live="polite">
          {data ? `${data.rows.length} of ${data.total}` : ""}
        </p>
        <div className="pagination">
          <span>Page {query.page}</span>
          <button
            disabled={query.page === 1 || loading}
            onClick={() => update({ page: query.page - 1 })}
          >
            Previous
          </button>
          <button
            disabled={!data?.hasMore || loading}
            onClick={() => update({ page: query.page + 1 })}
          >
            Next
          </button>
        </div>
      </div>
      <dialog
        ref={dialog}
        className="opportunity-information"
        aria-label="Opportunity information"
      >
        <button
          className="dialog-close"
          aria-label="Close opportunity information"
          onClick={() => dialog.current?.close()}
        >
          ×
        </button>
        <h2>{selected?.title}</h2>
        {selected?.summary ? (
          <div
            className="announcement-content"
            dangerouslySetInnerHTML={{ __html: selected.summary }}
          />
        ) : (
          <p>No additional summary was returned.</p>
        )}
        {selected?.url && (
          <a href={selected.url} target="_blank" rel="noopener noreferrer">
            View funder website
          </a>
        )}
      </dialog>
    </section>
  );
}
