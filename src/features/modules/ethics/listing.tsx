"use client";
import { useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { ethics, useApi, usePagedApi } from "@/lib/api";
import { FilterPanel } from "@/components/ui/filter-panel";
import { StatusList } from "@/components/ui/status-list";
import { Select, type SelectOption } from "@/components/ui/select";
import { InsideField } from "@/components/ui/inside-field";
import { DateInput } from "@/components/ui/date-input";
import { Icon } from "@/components/ui/icon";
import { StatusBadge, type StatusTone } from "@/components/ui/status-badge";
import { RecordMetadata } from "@/components/ui/record-metadata";
import { useFormat } from "@/components/layout/shell-context";
import { functions } from "@/lib/functions";
import type { FormatSettings } from "@/lib/format";
import { State } from "@/components/feedback/state";
import { ActionDialog, useConfirm } from "@/components/dialog/action-dialog";
import { ListSkeleton } from "@/components/feedback/skeleton";
import {
  parseEthicsFilters,
  serializeEthicsFilters,
  defaultEthicsFilters,
  type EthicsFilters,
} from "./schema";
import type {
  EthicsListView,
  EthicsRow,
} from "@/server/modules/ethics/listing";
import styles from "./listing.module.css";

const EMPTY: SelectOption[] = [];
const DATE_KEYS = ["created", "deadline", "expiry"] as const;
const CHOICE_KEYS = [
  "createdBy",
  "responseStatus",
  "formType",
  "org",
  "risk",
  "sort",
] as const;

export function Listing({
  view,
  initialFilters,
}: {
  view: EthicsListView;
  initialFilters: EthicsFilters;
}) {
  const router = useRouter(),
    path = usePathname(),
    search = useSearchParams();
  const [open, setOpen] = useState(true);
  const [recycleOpen, setRecycleOpen] = useState(false);
  const [restoring, setRestoring] = useState<string | null>(null);
  const [restoreError, setRestoreError] = useState("");
  const confirm = useConfirm("ethics-restore-confirm");
  const key = search.toString();
  let filters = initialFilters;
  try {
    filters = parseEthicsFilters(new URLSearchParams(key));
  } catch {
    /* The server renders the query error. */
  }
  const access =
    filters.access && view.tabs.some((tab) => tab.value === filters.access)
      ? filters.access
      : view.tabs[0].value;
  const active = { ...filters, access, offset: 0 };
  const [draft, setDraft] = useState(active);
  const format = useFormat();
  const statuses = useApi(ethics.choices, { kind: "status", access });
  const creator = useApi(ethics.choices, { kind: "createdBy", access });
  const types = useApi(ethics.choices, { kind: "type", access });
  const responses = useApi(
    ethics.choices,
    access === "EA_ACCESS" ? { kind: "responseStatus", access } : null,
  );
  const forms = useApi(ethics.choices, { kind: "formType", access });
  const orgs = useApi(ethics.choices, { kind: "org", access });
  const risks = useApi(ethics.choices, { kind: "risk", access });
  const sorts = useApi(ethics.choices, { kind: "sort", access });
  const choices: Record<(typeof CHOICE_KEYS)[number], SelectOption[]> = {
    createdBy: creator.data ?? EMPTY,
    responseStatus: responses.data ?? EMPTY,
    formType: forms.data ?? EMPTY,
    org: orgs.data ?? EMPTY,
    risk: risks.data ?? EMPTY,
    sort: sorts.data ?? EMPTY,
  };
  const list = usePagedApi(ethics.list, active);
  const deleted = useApi(ethics.deleted, recycleOpen ? undefined : null);
  async function restore(id: string, number: string) {
    if (
      !(await confirm.ask({
        title: "Restore Ethics application",
        message: `Restore ${number}?`,
        confirm: "Restore",
        cancel: "Cancel",
      }))
    )
      return;
    setRestoring(id);
    setRestoreError("");
    const result = await ethics.restore(id);
    if (result.ok) {
      deleted.retry();
      list.reload();
    } else setRestoreError(result.error.message);
    setRestoring(null);
  }
  function navigate(next: EthicsFilters) {
    const query = serializeEthicsFilters({ ...next, offset: 0 });
    router.replace(query ? `${path}?${query}` : path, { scroll: false });
  }
  function change<K extends keyof EthicsFilters>(
    field: K,
    value: EthicsFilters[K],
  ) {
    setDraft((current) => ({ ...current, [field]: value }));
  }
  function applied<K extends keyof EthicsFilters>(
    field: K,
    value: EthicsFilters[K],
  ) {
    navigate({ ...active, [field]: value });
  }
  const statusOptions = statuses.data ?? [{ value: "", label: "All" }];
  const typeOptions = types.data ?? EMPTY;
  return (
    <FilterPanel
      id="ethics-filters"
      label="Ethics filters"
      page="ethics"
      open={open}
      filters={
        <>
          <StatusList
            id="ethics-statuses"
            label="Ethics status"
            options={statusOptions}
            value={active.status}
            onChange={(status) => navigate({ ...active, status })}
          />
          <form
            id="ethics-filter-form"
            className={styles.filters}
            onSubmit={(event) => {
              event.preventDefault();
              navigate(draft);
            }}
          >
            {view.gates.number && (
              <InsideField
                htmlFor="ethics-number"
                label={view.texts.number}
                filled={!!draft.number}
              >
                <input
                  id="ethics-number"
                  className="gn-control"
                  value={draft.number}
                  onChange={(event) => change("number", event.target.value)}
                  onBlur={() => {
                    if (draft.number !== active.number)
                      applied("number", draft.number);
                  }}
                />
              </InsideField>
            )}
            {view.gates.createdBy && (
              <Select
                id="ethics-createdBy"
                label={view.texts.createdBy}
                value={draft.createdBy}
                options={choices.createdBy}
                onChange={(value) => {
                  change("createdBy", value);
                  applied("createdBy", value);
                }}
                placeholder={view.texts.createdBy}
              />
            )}
            {view.gates.type && (
              <fieldset id="ethics-type-filter" className={styles.radios}>
                <legend>{view.texts.type}</legend>
                {[{ value: "", label: "All" }, ...typeOptions].map((option) => (
                  <label key={option.value}>
                    <input
                      type="radio"
                      name="ethics-type"
                      value={option.value}
                      checked={active.type === option.value}
                      onChange={() => applied("type", option.value)}
                    />
                    {option.label}
                  </label>
                ))}
              </fieldset>
            )}
            {CHOICE_KEYS.filter(
              (field) =>
                field !== "sort" &&
                field !== "createdBy" &&
                field !== "risk" &&
                view.gates[field] &&
                (field !== "responseStatus" || access === "EA_ACCESS"),
            ).map((field) => (
              <Select
                key={field}
                id={`ethics-${field}`}
                label={view.texts[field]}
                value={draft[field]}
                options={choices[field]}
                onChange={(value) => {
                  change(field, value);
                  applied(field, value);
                }}
                placeholder={view.texts[field]}
              />
            ))}
            {view.gates.title && (
              <InsideField
                htmlFor="ethics-title"
                label={view.texts.title}
                filled={!!draft.title}
              >
                <input
                  id="ethics-title"
                  className="gn-control"
                  value={draft.title}
                  onChange={(event) => change("title", event.target.value)}
                  onBlur={() => {
                    if (draft.title !== active.title)
                      applied("title", draft.title);
                  }}
                />
              </InsideField>
            )}
            {view.gates.risk && (
              <Select
                id="ethics-risk"
                label={view.texts.risk}
                value={draft.risk}
                options={choices.risk}
                onChange={(value) => {
                  change("risk", value);
                  applied("risk", value);
                }}
                placeholder={view.texts.risk}
              />
            )}
            {view.gates.sort && (
              <div className={styles.sort}>
                <Select
                  id="ethics-sort"
                  label={view.texts.sort}
                  value={draft.sort}
                  options={choices.sort}
                  onChange={(value) => {
                    change("sort", value);
                    applied("sort", value);
                  }}
                  placeholder={view.texts.sort}
                />
                <button
                  id="ethics-direction"
                  type="button"
                  aria-label={`Sort ${active.direction === "ascending" ? "descending" : "ascending"}`}
                  onClick={() =>
                    applied(
                      "direction",
                      active.direction === "ascending"
                        ? "descending"
                        : "ascending",
                    )
                  }
                >
                  <Icon
                    name={
                      active.direction === "ascending"
                        ? "arrow-circle-up"
                        : "arrow-circle-down"
                    }
                    size={20}
                  />
                </button>
              </div>
            )}
            {DATE_KEYS.filter((field) => view.gates[field]).map((field) => (
              <div key={field} className={styles.date}>
                <label htmlFor={`ethics-${field}`}>{view.texts[field]}</label>
                <DateInput
                  id={`ethics-${field}`}
                  value={draft[field]}
                  onChange={(value) => {
                    change(field, value);
                    applied(field, value);
                  }}
                />
              </div>
            ))}
            <div className={styles.filterActions}>
              <button
                id="ethics-clear-filters"
                type="button"
                onClick={() => navigate({ ...defaultEthicsFilters, access })}
              >
                <Icon name="reset-filters" size={16} /> {view.labels.clear}
              </button>
            </div>
          </form>
        </>
      }
    >
      <div className={styles.content}>
        <div className={styles.toolbar}>
          <div className={styles.toolbarStart}>
            <button
              id="ethics-toggle-filters"
              type="button"
              aria-label={open ? "Close filters" : "Open filters"}
              aria-expanded={open}
              aria-controls="ethics-filters"
              onClick={() => setOpen(!open)}
            >
              <Icon name="collapse-menu" size={18} />
            </button>
            {view.actions.create && (
              <Link id="ethics-create" href="/ethics/new">
                <Icon name="new-application" size={17} /> {view.labels.create}
              </Link>
            )}
          </div>
          {view.actions.recycle && (
            <button
              id="ethics-recycle"
              type="button"
              onClick={() => setRecycleOpen(true)}
            >
              <Icon name="trash" size={17} /> {view.labels.recycle}
            </button>
          )}
        </div>
        <div className={styles.tabs} role="tablist" aria-label="Ethics access">
          {view.tabs.map((tab) => (
            <button
              key={tab.value}
              id={`ethics-tab-${tab.value.toLowerCase()}`}
              type="button"
              role="tab"
              aria-selected={access === tab.value}
              onClick={() =>
                navigate({ ...defaultEthicsFilters, access: tab.value })
              }
            >
              {tab.label}
            </button>
          ))}
        </div>
        {list.error && !list.rows.length ? (
          <State
            title="Ethics unavailable"
            message={list.error.message}
            code={list.error.code}
            retry={list.retry}
          />
        ) : null}
        {list.loading && !list.rows.length ? <ListSkeleton /> : null}
        {!list.loading && !list.error && !list.rows.length ? (
          <State
            title="No ethics applications"
            message="No applications match these filters."
            code="EMPTY"
          />
        ) : null}
        <div
          id="ethics-applications"
          className={styles.cards}
          aria-busy={list.stale || list.loading}
        >
          {list.rows.map((row) => (
            <EthicsCard
              key={row.id}
              row={row}
              view={view}
              access={access}
              format={format}
            />
          ))}
        </div>
        {list.hasMore && (
          <button
            id="ethics-load-more"
            className={styles.more}
            disabled={list.loadingMore}
            onClick={list.loadMore}
          >
            {list.loadingMore ? "Loading…" : "Load more"}
          </button>
        )}
        {!!list.rows.length && (
          <div id="ethics-loaded-count" className={styles.count}>
            {list.rows.length} applications loaded
          </div>
        )}
      </div>
      {recycleOpen && (
        <ActionDialog
          id="ethics-recycle-dialog"
          title={view.labels.recycle}
          busy={restoring !== null}
          onClose={() => setRecycleOpen(false)}
        >
          {deleted.loading && <ListSkeleton />}
          {deleted.error && (
            <State
              title="Recycle bin unavailable"
              message={deleted.error.message}
              code={deleted.error.code}
              retry={deleted.retry}
            />
          )}
          {restoreError && (
            <p id="ethics-restore-error" role="alert">
              {restoreError}
            </p>
          )}
          {deleted.data?.length === 0 && (
            <p id="ethics-recycle-empty">No deleted Ethics applications.</p>
          )}
          <ul id="ethics-deleted-applications" className={styles.deleted}>
            {deleted.data?.map((row) => (
              <li key={row.id} id={`ethics-deleted-${row.id}`}>
                <span>
                  <strong>{row.number}</strong>
                  <br />
                  {row.title}
                </span>
                {row.canRestore && (
                  <button
                    id={`ethics-restore-${row.id}`}
                    type="button"
                    disabled={restoring !== null}
                    onClick={() => restore(row.id, row.number)}
                  >
                    Restore
                  </button>
                )}
              </li>
            ))}
          </ul>
        </ActionDialog>
      )}
      {confirm.element}
    </FilterPanel>
  );
}

function EthicsCard({
  row,
  view,
  access,
  format,
}: {
  row: EthicsRow;
  view: EthicsListView;
  access: string;
  format: FormatSettings | undefined;
}) {
  const statusTone: StatusTone =
    row.statusCode === "WIP"
      ? "info"
      : row.statusCode === "REWORK"
        ? "warning"
        : row.statusCode === "REJ"
          ? "danger"
          : row.statusCode === "DRFT"
            ? "neutral"
            : "success";
  const riskTone: StatusTone =
    row.riskCode === "HIGH" || row.riskCode === "CRITICAL"
      ? "danger"
      : row.riskCode === "MEDIUM"
        ? "warning"
        : row.riskCode === "LOW"
          ? "success"
          : "info";
  const fields = [
    {
      label: view.texts.createdBy,
      value: view.fields.createdBy ? row.createdBy : undefined,
    },
    {
      label: view.texts.updatedBy,
      value: view.fields.updatedBy ? row.updatedBy : undefined,
    },
    {
      label: view.texts.created,
      value:
        view.fields.created && row.created
          ? functions.format.dateDisplay(row.created, format)
          : undefined,
    },
    {
      label: view.texts.updated,
      value:
        view.fields.updated && row.updated
          ? functions.format.dateDisplay(row.updated, format)
          : undefined,
    },
    {
      label: view.texts.deadline,
      value:
        view.fields.deadline && row.deadline
          ? functions.format.dateDisplay(row.deadline, format)
          : undefined,
    },
    {
      label: view.texts.expiry,
      value:
        view.fields.expiry && row.expiry
          ? functions.format.dateDisplay(row.expiry, format)
          : undefined,
    },
    {
      label: view.texts.ethicsType,
      value: view.fields.ethicsType ? row.ethicsType : undefined,
    },
    {
      label: view.texts.formType,
      value: view.fields.formType ? row.formType : undefined,
    },
    { label: view.texts.org, value: view.fields.org ? row.org : undefined },
    {
      label: view.texts.reviewer,
      value: view.fields.reviewer ? row.reviewer : undefined,
    },
  ];
  return (
    <article id={`ethics-application-${row.id}`} className={styles.card}>
      <div className={styles.cardHead}>
        <Link
          id={`ethics-open-${row.id}`}
          href={`/ethics/${row.id}?access=${access}`}
        >
          <Icon name="certification" size={18} /> {row.number}
        </Link>
        {row.status && (
          <StatusBadge tone={statusTone}>{row.status}</StatusBadge>
        )}
        {row.risk && <StatusBadge tone={riskTone}>{row.risk}</StatusBadge>}
        {access === "EA_ACCESS" && row.responseStatus && (
          <span className={styles.response}>
            {view.texts.responseStatus} : {row.responseStatus}
          </span>
        )}
      </div>
      <h2>{row.title || row.number}</h2>
      <RecordMetadata id={`ethics-metadata-${row.id}`} fields={fields} />
    </article>
  );
}
