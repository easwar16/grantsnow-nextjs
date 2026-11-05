"use client";
import type { FormatSettings } from "@/lib/format";
import { ListSkeleton } from "@/components/feedback/skeleton";
import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  parseConditions,
  parseQuery,
  serializeQuery,
  type ProposalQuery,
} from "../schemas";
import type { Column, FilterLabels, ProposalPage } from "../types";
import { State } from "@/components/feedback/state";
import { RecordCard } from "./record-card";
import { AdvancedQuery } from "./advanced-query";
import type { ListingChoices } from "../lookups";
import { LatestRequest } from "@/lib/store/latest-request";
import { proposals, session, useApi } from "@/lib/api";
import { FilterPanel } from "@/components/ui/filter-panel";
import { InsideField } from "@/components/ui/inside-field";
import { Select, type SelectOption } from "@/components/ui/select";
import { MultiSelect } from "@/components/ui/multi-select";
import { Icon } from "@/components/ui/icon";
import Image from "next/image";
import { ReadonlyField } from "@/components/ui/readonly-field";
import { StatusBadge } from "@/components/ui/status-badge";
import { functions } from "@/lib/functions";
import { ActionDialog, useConfirm } from "@/components/dialog/action-dialog";
import { LinkedObjectsDialog } from "@/features/record/linked/linked-dialog";
import type { LinkedObjects } from "@/features/record/linked/model";
import type { ProposalRow } from "../types";
import type {
  CopyOption,
  DeletedProposal,
  ShareOptions,
  ApprovedAoiPage,
} from "@/lib/api/endpoints/proposals";
import { useToast } from "@/components/feedback/toast";
import { useInFlight } from "@/lib/hooks/use-in-flight";
import Link from "next/link";
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
  actions,
}: {
  /** The URL query's first page, streaming from the server. */
  initial: Promise<Result>;
  columns: Column[];
  filters: FilterLabels;
  initialQuery: ProposalQuery;
  format?: FormatSettings;
  actions: {
    create: string | null;
    createOutline: string | null;
    advanced: string | null;
    recycle: string | null;
    view: string | null;
    link: string | null;
    share: string | null;
    clone: string | null;
    delete: string | null;
  };
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
    [formError, setFormError] = useState(""),
    [filtersOpen, setFiltersOpen] = useState(true),
    [advancedOpen, setAdvancedOpen] = useState(false),
    [outlineOpen, setOutlineOpen] = useState(false),
    [aoiOpen, setAoiOpen] = useState(false),
    [aoiPage, setAoiPage] = useState<ApprovedAoiPage | null>(null),
    [aoiLoading, setAoiLoading] = useState(false),
    [aoiError, setAoiError] = useState(""),
    [aoiSelecting, setAoiSelecting] = useState("");
  const [recycleOpen, setRecycleOpen] = useState(false),
    [deleted, setDeleted] = useState<DeletedProposal[] | null>(null),
    [linked, setLinked] = useState<LinkedObjects | null>(null),
    [copyRow, setCopyRow] = useState<ProposalRow | null>(null),
    [shareRow, setShareRow] = useState<ProposalRow | null>(null),
    [shareDocumentOpen, setShareDocumentOpen] = useState(false),
    [shareOptions, setShareOptions] = useState<ShareOptions | null>(null),
    [shareReport, setShareReport] = useState(""),
    [shareEmails, setShareEmails] = useState<string[]>([]),
    [copyOptions, setCopyOptions] = useState<CopyOption[] | null>(null),
    [copySelection, setCopySelection] = useState<string[]>([]);
  const toast = useToast(),
    confirm = useConfirm("proposals-list-confirm"),
    { run, isActive } = useInFlight();
  const leftInitialQuery = useRef(false),
    latest = useRef(new LatestRequest()),
    aoiLatest = useRef(new LatestRequest()),
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
  async function loadApprovedAois(offset = 0) {
    const request = aoiLatest.current.begin();
    setAoiLoading(true);
    setAoiError("");
    const result = await proposals.approvedAois(offset, request.signal);
    if (!request.current()) return;
    if (result.ok) {
      setAoiPage((current) =>
        offset === 0 || !current
          ? result.data
          : { ...result.data, rows: [...current.rows, ...result.data.rows] },
      );
    } else setAoiError(result.error.message);
    setAoiLoading(false);
  }
  async function chooseApprovedAoi(id: string) {
    setAoiSelecting(id);
    setAoiError("");
    const result = await proposals.approvedAoiSource(id);
    if (result.ok) {
      setAoiOpen(false);
      router.push(
        `/proposals/new/OUTLINE_PROPOSAL?sourceRequestId=${encodeURIComponent(id)}`,
      );
    } else setAoiError(result.error.message);
    setAoiSelecting("");
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
  async function refreshRows() {
    setLoading(true);
    const response = await proposals.page(query);
    setResult(response);
    setLoading(false);
  }
  async function openRecycle() {
    setRecycleOpen(true);
    setDeleted(null);
    const response = await proposals.recycle();
    if (response.ok) setDeleted(response.data);
    else {
      toast.error(response.error);
      setRecycleOpen(false);
    }
  }
  async function rowAction(
    action: "link" | "share" | "clone" | "delete",
    row: ProposalRow,
  ) {
    const [type, id] = row.id.split(":");
    if (action === "share") {
      setShareRow(row);
      return;
    }
    if (action === "link") {
      const response = await proposals.links(type, id);
      if (!response.ok) return toast.error(response.error);
      if (!response.data.groups.length)
        return toast.show("info", response.data.texts.none);
      setLinked(response.data);
      return;
    }
    if (action === "clone") {
      setCopyRow(row);
      setCopyOptions(null);
      const response = await proposals.copyOptions(type, id);
      if (!response.ok) {
        toast.error(response.error);
        setCopyRow(null);
        return;
      }
      setCopyOptions(response.data);
      setCopySelection(
        response.data
          .filter((option) => option.required)
          .map((option) => option.value),
      );
      return;
    }
    if (
      !(await confirm.ask({
        title: "Warning",
        message: `Permanently delete ${row.reference}?`,
        confirm: "Delete",
        cancel: "Cancel",
        danger: true,
      }))
    )
      return;
    await run(async () => {
      const response = await proposals.removeFromList(type, id);
      if (!response.ok) return toast.error(response.error);
      toast.show("success", "Proposal deleted.");
      await refreshRows();
    }, `delete-${row.id}`);
  }
  async function restore(row: DeletedProposal) {
    if (
      !(await confirm.ask({
        title: "Restore proposal",
        message: `Restore ${row.reference}?`,
        confirm: "Restore",
        cancel: "Cancel",
      }))
    )
      return;
    await run(async () => {
      const response = await proposals.restoreFromRecycle(row.id);
      if (!response.ok) return toast.error(response.error);
      toast.show("success", "Proposal restored.");
      setRecycleOpen(false);
      await refreshRows();
    }, `restore-${row.id}`);
  }
  async function cloneSelected() {
    if (!copyRow) return;
    const [type, id] = copyRow.id.split(":");
    await run(async () => {
      const response = await proposals.clone(type, id, copySelection);
      if (!response.ok) return toast.error(response.error);
      setCopyRow(null);
      router.push(`/proposals/${response.data.type}/${response.data.id}`);
    }, "clone");
  }
  async function openShareDocument() {
    if (!shareRow) return;
    const [type, id] = shareRow.id.split(":");
    setShareOptions(null);
    const response = await proposals.shareOptions(type, id);
    if (!response.ok) return toast.error(response.error);
    setShareOptions(response.data);
    setShareReport("");
    setShareEmails([]);
    setShareDocumentOpen(true);
  }
  async function sendShareDocument() {
    if (!shareRow || !shareReport || !shareEmails.length) return;
    const [type, id] = shareRow.id.split(":");
    await run(async () => {
      const response = await proposals.shareDocument(
        type,
        id,
        shareReport,
        shareEmails,
      );
      if (!response.ok) return toast.error(response.error);
      toast.show("success", "Report shared.");
      setShareDocumentOpen(false);
      setShareRow(null);
    }, "share-document");
  }
  return (
    <section className="page-fill" aria-label="Proposal listing">
      <FilterPanel
        id="proposal-filters"
        label="Proposal filters"
        page="proposals"
        open={filtersOpen}
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
                  event.target instanceof Element &&
                  event.target.closest("#proposals-sort, #proposals-direction")
                )
                  return;
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
                  event.target instanceof Element &&
                  event.target.closest("#proposals-sort, #proposals-direction")
                )
                  return;
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
              <div className={styles.query} aria-label="Date Sort">
                <InsideField
                  htmlFor="proposals-sort-trigger"
                  label="Date Sort"
                  filled={query.sort !== ""}
                >
                  <Select
                    id="proposals-sort"
                    label="Date Sort"
                    value={query.sort}
                    options={choices.sorts}
                    onChange={(next) =>
                      update(
                        { sort: next as ProposalQuery["sort"], page: 1 },
                        true,
                      )
                    }
                  />
                </InsideField>
                <button
                  type="button"
                  id="proposals-direction"
                  className={styles.sortDirection}
                  aria-label={`Sort ${query.direction === "DESC" ? "ascending" : "descending"}`}
                  title={`Sort ${query.direction === "DESC" ? "ascending" : "descending"}`}
                  onClick={() =>
                    update(
                      {
                        direction: query.direction === "DESC" ? "ASC" : "DESC",
                        page: 1,
                      },
                      true,
                    )
                  }
                >
                  <Icon
                    name={
                      query.direction === "DESC"
                        ? "arrow-circle-down"
                        : "arrow-circle-up"
                    }
                  />
                </button>
              </div>
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
          <div className={styles.toolbar}>
            <div className={styles.toolbarGroup}>
              <button
                id="proposal-filters-toggle"
                type="button"
                className={styles.toggleButton}
                aria-label={filtersOpen ? "Close filters" : "Open filters"}
                aria-expanded={filtersOpen}
                aria-controls="proposal-filters"
                onClick={() => setFiltersOpen((shown) => !shown)}
              >
                <Icon name="collapse-menu" />
              </button>
              {actions.create && (
                <Link
                  id="proposals-create"
                  href="/proposals/new/PROPOSAL"
                  prefetch={false}
                  className="gn-btn gn-btn--outlined"
                >
                  <Icon name="new-application" /> {actions.create}
                </Link>
              )}
              {actions.createOutline && (
                <button
                  id="proposals-create-outline"
                  type="button"
                  className="gn-btn gn-btn--outlined"
                  onClick={() => setOutlineOpen(true)}
                >
                  <Icon name="draft" /> {actions.createOutline}
                </button>
              )}
            </div>
            <div className={styles.toolbarGroup}>
              {actions.recycle && (
                <button
                  id="proposals-recycle-bin"
                  type="button"
                  className="gn-btn gn-btn--borderless"
                  onClick={() => void openRecycle()}
                >
                  <Icon name="trash" /> {actions.recycle}
                </button>
              )}
              {actions.advanced && (
                <button
                  id="proposals-advanced-toggle"
                  type="button"
                  className="gn-btn gn-btn--borderless"
                  aria-expanded={advancedOpen}
                  aria-controls="proposals-advanced"
                  onClick={() => setAdvancedOpen((open) => !open)}
                >
                  <Icon name="smart-filter" /> {actions.advanced}
                </button>
              )}
            </div>
          </div>
          {advancedOpen && (
            <AdvancedQuery
              conditions={parseConditions(query.conditions)}
              onChange={(conditions) =>
                update(
                  {
                    conditions: conditions.length
                      ? JSON.stringify(conditions)
                      : "",
                    page: 1,
                  },
                  true,
                )
              }
              onClose={() => setAdvancedOpen(false)}
            />
          )}
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
                query.conditions ||
                query.from ||
                query.to
                  ? "No matching proposals"
                  : "No proposals on this page"
              }
              message="Clear filters to adjust your view."
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
                    actions={actions}
                    onAction={(action, selected) =>
                      void rowAction(action, selected)
                    }
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
        </div>
      </FilterPanel>
      {confirm.element}
      {outlineOpen && (
        <ActionDialog
          id="proposals-outline-options"
          title="Create outline proposal"
          width="66.667vw"
          onClose={() => setOutlineOpen(false)}
        >
          <p id="proposals-outline-options-message">
            Do you want to create a new Outline or from AOI?
          </p>
          <div className={styles.dialogActions}>
            <Link
              id="proposals-outline-new"
              href="/proposals/new/OUTLINE_PROPOSAL"
              prefetch={false}
              className="gn-btn gn-btn--outlined"
              onClick={() => setOutlineOpen(false)}
            >
              Create New Outline
            </Link>
            <button
              type="button"
              id="proposals-outline-from-aoi"
              className="gn-btn gn-btn--primary"
              onClick={() => {
                setOutlineOpen(false);
                setAoiPage(null);
                setAoiOpen(true);
                void loadApprovedAois();
              }}
            >
              Create Outline from AOI
            </button>
          </div>
        </ActionDialog>
      )}
      {aoiOpen && (
        <ActionDialog
          id="proposals-approved-aoi"
          title="Create Outline From AOI"
          width="66.667vw"
          onClose={() => {
            aoiLatest.current.cancel();
            setAoiLoading(false);
            setAoiOpen(false);
          }}
        >
          {aoiError && (
            <div id="proposals-approved-aoi-error" role="alert">
              {aoiError}
              {!aoiPage && (
                <button type="button" onClick={() => void loadApprovedAois()}>
                  Retry
                </button>
              )}
            </div>
          )}
          {!aoiPage && aoiLoading ? (
            <ListSkeleton label="Loading approved AOIs" rows={3} />
          ) : aoiPage?.rows.length === 0 ? (
            <p id="proposals-approved-aoi-empty">No data to display.</p>
          ) : (
            <div
              id="proposals-approved-aoi-list"
              className={styles.approvedAoiList}
            >
              {aoiPage?.rows.map((row) => (
                <article
                  key={row.id}
                  id={`proposals-approved-aoi-${row.id}`}
                  className={styles.approvedAoiCard}
                >
                  <div
                    id={`proposals-approved-aoi-logo-${row.id}`}
                    className={styles.approvedAoiLogo}
                  >
                    {functions.security.safeImageUrl(row.logo) && (
                      <Image
                        src={functions.security.safeImageUrl(row.logo)!}
                        alt=""
                        width={100}
                        height={100}
                        unoptimized
                      />
                    )}
                  </div>
                  <div className={styles.approvedAoiBody}>
                    <div className={styles.approvedAoiOverline}>
                      <Icon name="data-document" label="AOI" />
                      <strong>{row.number}</strong>
                      <StatusBadge
                        id={`proposals-approved-aoi-status-${row.id}`}
                        tone="info"
                      >
                        {row.status}
                      </StatusBadge>
                    </div>
                    <h3>{row.title}</h3>
                    {row.funders && (
                      <div
                        id={`proposals-approved-aoi-funders-${row.id}`}
                        className={styles.approvedAoiFunders}
                      >
                        {row.funders
                          .split(",")
                          .map((funder) => funder.trim())
                          .filter(Boolean)
                          .map((funder, index) => (
                            <StatusBadge
                              key={`${funder}-${index}`}
                              id={`proposals-approved-aoi-funder-${row.id}-${index}`}
                              tone="info"
                            >
                              {funder}
                            </StatusBadge>
                          ))}
                      </div>
                    )}
                    <div className={styles.approvedAoiMeta}>
                      <ReadonlyField
                        id={`proposals-approved-aoi-creator-${row.id}`}
                        label="Created by"
                        value={row.creator}
                      />
                      <ReadonlyField
                        id={`proposals-approved-aoi-department-${row.id}`}
                        label="Department"
                        value={row.department}
                      />
                      <ReadonlyField
                        id={`proposals-approved-aoi-created-${row.id}`}
                        label="Created on"
                        value={functions.format.dateDisplay(
                          row.created,
                          format,
                        )}
                      />
                    </div>
                  </div>
                  <button
                    type="button"
                    id={`proposals-approved-aoi-create-${row.id}`}
                    className={styles.approvedAoiCreate}
                    aria-label={`Create outline from ${row.number}`}
                    title={`Create outline from ${row.number}`}
                    disabled={Boolean(aoiSelecting)}
                    onClick={() => void chooseApprovedAoi(row.id)}
                  >
                    <Icon name="invoice-create" />
                  </button>
                </article>
              ))}
              {aoiPage?.hasMore && (
                <button
                  type="button"
                  id="proposals-approved-aoi-more"
                  className="gn-btn gn-btn--outlined"
                  disabled={aoiLoading || Boolean(aoiSelecting)}
                  onClick={() => void loadApprovedAois(aoiPage.rows.length)}
                >
                  Load more
                </button>
              )}
            </div>
          )}
        </ActionDialog>
      )}
      {linked && (
        <LinkedObjectsDialog
          id="proposals-list-linked"
          linked={linked}
          format={format}
          onClose={() => setLinked(null)}
        />
      )}
      {recycleOpen && (
        <ActionDialog
          id="proposals-recycle-dialog"
          title={actions.recycle ?? "Recycle bin"}
          onClose={() => setRecycleOpen(false)}
        >
          {deleted === null ? (
            <ListSkeleton label="Loading deleted proposals" rows={2} />
          ) : deleted.length === 0 ? (
            <p>No data to display.</p>
          ) : (
            <ul className={styles.deletedList}>
              {deleted.map((row) => (
                <li key={row.id} id={`proposals-deleted-${row.id}`}>
                  <div>
                    <strong>{row.reference}</strong> {row.status}
                    <br />
                    {row.title}
                  </div>
                  <button
                    id={`proposals-restore-${row.id}`}
                    type="button"
                    className="gn-btn gn-btn--borderless gn-btn--icon"
                    title="Restore"
                    aria-label={`Restore ${row.reference}`}
                    disabled={!row.canRestore || isActive(`restore-${row.id}`)}
                    onClick={() => void restore(row)}
                  >
                    <Icon name="undo" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </ActionDialog>
      )}
      {copyRow && (
        <ActionDialog
          id="proposals-clone-dialog"
          title="Clone proposal"
          busy={isActive("clone")}
          onClose={() => setCopyRow(null)}
        >
          {copyOptions === null ? (
            <ListSkeleton label="Loading clone options" rows={2} />
          ) : (
            <>
              <fieldset className={styles.copyOptions}>
                <legend>Include in copied proposal</legend>
                <label>
                  <input
                    type="checkbox"
                    checked={copySelection.length === copyOptions.length}
                    onChange={(event) =>
                      setCopySelection(
                        event.target.checked
                          ? copyOptions.map((option) => option.value)
                          : copyOptions
                              .filter((option) => option.required)
                              .map((option) => option.value),
                      )
                    }
                  />
                  Entire proposal
                </label>
                {copyOptions.map((option) => (
                  <label key={option.value}>
                    <input
                      type="checkbox"
                      checked={copySelection.includes(option.value)}
                      disabled={option.required}
                      onChange={(event) =>
                        setCopySelection((values) =>
                          event.target.checked
                            ? [...values, option.value]
                            : values.filter((value) => value !== option.value),
                        )
                      }
                    />
                    {option.label}
                  </label>
                ))}
              </fieldset>
              <div className={styles.dialogActions}>
                <button
                  type="button"
                  className="gn-btn gn-btn--outlined"
                  onClick={() => setCopyRow(null)}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="gn-btn gn-btn--primary"
                  disabled={isActive("clone")}
                  onClick={() => void cloneSelected()}
                >
                  <Icon name="copy" /> Clone
                </button>
              </div>
            </>
          )}
        </ActionDialog>
      )}
      {shareRow && !shareDocumentOpen && (
        <ActionDialog
          id="proposals-share-dialog"
          title="Share options"
          onClose={() => setShareRow(null)}
        >
          <div className={styles.dialogActions}>
            <button
              id="proposals-share-as-document"
              type="button"
              className="gn-btn gn-btn--outlined"
              onClick={() => void openShareDocument()}
            >
              Share as document
            </button>
            <Link
              href={`/proposals/${shareRow.id.replace(":", "/")}/delegation`}
              className="gn-btn gn-btn--primary"
              onClick={() => setShareRow(null)}
            >
              Share access
            </Link>
          </div>
        </ActionDialog>
      )}
      {shareRow && shareDocumentOpen && (
        <ActionDialog
          id="proposals-share-document-dialog"
          title="Share as document"
          busy={isActive("share-document")}
          onClose={() => {
            setShareDocumentOpen(false);
            setShareRow(null);
          }}
        >
          {shareOptions && (
            <>
              <MultiSelect
                id="proposals-share-recipients"
                label="Search by name"
                variant="control"
                options={shareOptions.people}
                value={shareEmails}
                onChange={setShareEmails}
              />
              <Select
                id="proposals-share-report"
                label="Report"
                options={shareOptions.reports}
                value={shareReport}
                onChange={setShareReport}
              />
              <div className={styles.dialogActions}>
                <button
                  type="button"
                  className="gn-btn gn-btn--outlined"
                  onClick={() => {
                    setShareDocumentOpen(false);
                    setShareRow(null);
                  }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="gn-btn gn-btn--primary"
                  disabled={
                    !shareReport ||
                    !shareEmails.length ||
                    isActive("share-document")
                  }
                  onClick={() => void sendShareDocument()}
                >
                  Share
                </button>
              </div>
            </>
          )}
        </ActionDialog>
      )}
    </section>
  );
}
