"use client";
import { useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { dueDiligence, useApi, usePagedApi } from "@/lib/api";
import { FilterPanel } from "@/components/ui/filter-panel";
import { StatusList } from "@/components/ui/status-list";
import { Select, type SelectOption } from "@/components/ui/select";
import { InsideField } from "@/components/ui/inside-field";
import { DateInput } from "@/components/ui/date-input";
import { Icon } from "@/components/ui/icon";
import { TabBar } from "@/components/ui/tab-bar";
import { State } from "@/components/feedback/state";
import { ActionDialog, useConfirm } from "@/components/dialog/action-dialog";
import { ListSkeleton } from "@/components/feedback/skeleton";
import { LinkedObjectsDialog } from "@/features/record/linked/linked-dialog";
import {
  parseDueDiligenceFilters,
  serializeDueDiligenceFilters,
  defaultDueDiligenceFilters,
  type DueDiligenceFilters,
} from "./schema";
import type {
  DueDiligenceListView,
  DueDiligenceRow,
} from "@/server/modules/due-diligence/listing";
import styles from "./due-diligence-list.module.css";

const EMPTY: SelectOption[] = [];
const DATE_KEYS = ["created", "deadline", "expiry"] as const;
const CHOICE_KEYS = [
  "createdBy",
  "type",
  "responseStatus",
  "formType",
  "org",
  "risk",
  "sort",
] as const;

export function DueDiligenceList({
  view,
  initialFilters,
}: {
  view: DueDiligenceListView;
  initialFilters: DueDiligenceFilters;
}) {
  const router = useRouter(),
    path = usePathname(),
    search = useSearchParams();
  const [open, setOpen] = useState(true);
  const [recycleOpen, setRecycleOpen] = useState(false);
  const [restoring, setRestoring] = useState<string | null>(null);
  const [restoreError, setRestoreError] = useState("");
  const [linkedId, setLinkedId] = useState<string | null>(null);
  const [cloneId, setCloneId] = useState<string | null>(null);
  const [cloneSelected, setCloneSelected] = useState<string[] | null>(null);
  const [cloneBusy, setCloneBusy] = useState(false);
  const [deleteBusy, setDeleteBusy] = useState<string | null>(null);
  const [actionError, setActionError] = useState("");
  const restoreConfirm = useConfirm("due-diligence-restore-confirm");
  const deleteConfirm = useConfirm("due-diligence-delete-confirm");
  const key = search.toString();
  let filters = initialFilters;
  try {
    filters = parseDueDiligenceFilters(new URLSearchParams(key));
  } catch {
    /* The server renders the query error. */
  }
  const access =
    filters.access && view.tabs.some((tab) => tab.value === filters.access)
      ? filters.access
      : view.tabs[0].value;
  const active = { ...filters, access, offset: 0 };
  const [draft, setDraft] = useState(active);
  const statuses = useApi(dueDiligence.choices, { kind: "status", access });
  const creator = useApi(dueDiligence.choices, { kind: "createdBy", access });
  const types = useApi(dueDiligence.choices, { kind: "type", access });
  const responses = useApi(
    dueDiligence.choices,
    access === "DDA_ACCESS" ? { kind: "responseStatus", access } : null,
  );
  const forms = useApi(dueDiligence.choices, { kind: "formType", access });
  const orgs = useApi(dueDiligence.choices, { kind: "org", access });
  const risks = useApi(dueDiligence.choices, { kind: "risk", access });
  const sorts = useApi(dueDiligence.choices, { kind: "sort", access });
  const choices: Record<(typeof CHOICE_KEYS)[number], SelectOption[]> = {
    createdBy: creator.data ?? EMPTY,
    type: types.data ?? EMPTY,
    responseStatus: responses.data ?? EMPTY,
    formType: forms.data ?? EMPTY,
    org: orgs.data ?? EMPTY,
    risk: risks.data ?? EMPTY,
    sort: sorts.data ?? EMPTY,
  };
  const list = usePagedApi(dueDiligence.list, active);
  const deleted = useApi(dueDiligence.deleted, recycleOpen ? undefined : null);
  const linked = useApi(dueDiligence.links, linkedId ? { id: linkedId, access } : null);
  const cloneOptions = useApi(
    dueDiligence.cloneOptions,
    cloneId ? { id: cloneId, access } : null,
  );
  const selectedObjects = cloneSelected ??
    cloneOptions.data?.filter((option) => option.selected).map((option) => option.value) ?? [];
  async function clone() {
    if (!cloneId || cloneBusy) return;
    setCloneBusy(true);
    setActionError("");
    const result = await dueDiligence.clone(cloneId, access, selectedObjects);
    setCloneBusy(false);
    if (!result.ok) return setActionError(result.error.message);
    setCloneId(null);
    setCloneSelected(null);
    list.reload();
  }
  async function remove(id: string, number: string) {
    if (deleteBusy || !(await deleteConfirm.ask({
      title: "Delete Due Diligence application",
      message: `Delete Draft ${number}?`,
      confirm: "Delete",
      cancel: "Cancel",
    }))) return;
    setDeleteBusy(id);
    setActionError("");
    const result = await dueDiligence.remove(id, access);
    setDeleteBusy(null);
    if (!result.ok) return setActionError(result.error.message);
    list.reload();
  }
  async function restore(id: string, number: string) {
    if (
      !(await restoreConfirm.ask({
        title: "Restore Due Diligence application",
        message: `Restore ${number}?`,
        confirm: "Restore",
        cancel: "Cancel",
      }))
    )
      return;
    setRestoring(id);
    setRestoreError("");
    const result = await dueDiligence.restore(id);
    if (result.ok) {
      deleted.retry();
      list.reload();
    } else setRestoreError(result.error.message);
    setRestoring(null);
  }
  function navigate(next: DueDiligenceFilters) {
    const query = serializeDueDiligenceFilters({ ...next, offset: 0 });
    router.replace(query ? `${path}?${query}` : path, { scroll: false });
  }
  function change<K extends keyof DueDiligenceFilters>(
    field: K,
    value: DueDiligenceFilters[K],
  ) {
    setDraft((current) => ({ ...current, [field]: value }));
  }
  function applied<K extends keyof DueDiligenceFilters>(
    field: K,
    value: DueDiligenceFilters[K],
  ) {
    navigate({ ...active, [field]: value });
  }
  const statusOptions = statuses.data ?? [{ value: "", label: "All" }];
  return (
    <FilterPanel
      id="due-diligence-filters"
      label="Due Diligence filters"
      page="due-diligence"
      open={open}
      filters={
        <>
          <StatusList
            id="due-diligence-statuses"
            label="Due Diligence status"
            options={statusOptions}
            value={active.status}
            onChange={(status) => navigate({ ...active, status })}
          />
          <form
            id="due-diligence-filter-form"
            className={styles.filters}
            onSubmit={(event) => {
              event.preventDefault();
              navigate(draft);
            }}
          >
            {view.gates.number && (
              <InsideField
                htmlFor="due-diligence-number"
                label={view.texts.number}
                filled={!!draft.number}
              >
                <input
                  id="due-diligence-number"
                  className="gn-control"
                  value={draft.number}
                  onChange={(event) => change("number", event.target.value)}
                />
              </InsideField>
            )}
            {view.gates.title && (
              <InsideField
                htmlFor="due-diligence-title"
                label={view.texts.title}
                filled={!!draft.title}
              >
                <input
                  id="due-diligence-title"
                  className="gn-control"
                  value={draft.title}
                  onChange={(event) => change("title", event.target.value)}
                />
              </InsideField>
            )}
            {CHOICE_KEYS.filter(
              (field) =>
                field !== "sort" &&
                view.gates[field] &&
                (field !== "responseStatus" || access === "DDA_ACCESS"),
            ).map((field) => (
              <Select
                key={field}
                id={`due-diligence-${field}`}
                label={view.texts[field]}
                value={draft[field]}
                options={choices[field]}
                onChange={(value) => change(field, value)}
                placeholder={view.texts[field]}
              />
            ))}
            {view.gates.sort && (
              <div className={styles.sort}>
                <Select
                  id="due-diligence-sort"
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
                  id="due-diligence-direction"
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
                <label htmlFor={`due-diligence-${field}`}>
                  {view.texts[field]}
                </label>
                <DateInput
                  id={`due-diligence-${field}`}
                  value={draft[field]}
                  onChange={(value) => change(field, value)}
                />
              </div>
            ))}
            <div className={styles.filterActions}>
              <button id="due-diligence-apply-filters" type="submit">
                Apply filters
              </button>
              <button
                id="due-diligence-clear-filters"
                type="button"
                onClick={() =>
                  navigate({ ...defaultDueDiligenceFilters, access })
                }
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
          <button
            id="due-diligence-toggle-filters"
            type="button"
            aria-label={open ? "Close filters" : "Open filters"}
            aria-expanded={open}
            aria-controls="due-diligence-filters"
            onClick={() => setOpen(!open)}
          >
            <Icon name="collapse-menu" size={18} />
          </button>
          {view.actions.create && (
            <Link id="due-diligence-create" href="/due-diligence/new">
              <Icon name="file-stage" size={17} /> {view.labels.create}
            </Link>
          )}
          {view.actions.recycle && (
            <button
              id="due-diligence-recycle"
              type="button"
              onClick={() => setRecycleOpen(true)}
            >
              <Icon name="trash" size={17} /> {view.labels.recycle}
            </button>
          )}
        </div>
        <TabBar
          id="due-diligence"
          label="Due Diligence access"
          align="start"
          tabs={view.tabs.map((tab) => ({
            key: tab.value.toLowerCase(),
            name: tab.label,
          }))}
          selected={access.toLowerCase()}
          onSelect={(key) =>
            navigate({
              ...defaultDueDiligenceFilters,
              access:
                view.tabs.find((tab) => tab.value.toLowerCase() === key)
                  ?.value ?? access,
            })
          }
        />
        {list.error && !list.rows.length ? (
          <State
            title="Due Diligence unavailable"
            message={list.error.message}
            code={list.error.code}
            retry={list.retry}
          />
        ) : null}
        {list.loading && !list.rows.length ? <ListSkeleton /> : null}
        {!list.loading && !list.error && !list.rows.length ? (
          <State
            title="No due diligence applications"
            message="No applications match these filters."
            code="EMPTY"
          />
        ) : null}
        <div
          id="due-diligence-applications"
          className={styles.cards}
          aria-busy={list.stale || list.loading}
        >
          {list.rows.map((row) => (
            <DueDiligenceCard
              key={row.id}
              row={row}
              view={view}
              access={access}
              onLinks={() => setLinkedId(row.id)}
              onClone={() => {
                setActionError("");
                setCloneSelected(null);
                setCloneId(row.id);
              }}
              onDelete={() => remove(row.id, row.number)}
              busy={deleteBusy !== null}
            />
          ))}
        </div>
        {list.hasMore && (
          <button
            id="due-diligence-load-more"
            className={styles.more}
            disabled={list.loadingMore}
            onClick={list.loadMore}
          >
            {list.loadingMore ? "Loading…" : "Load more"}
          </button>
        )}
        {!!list.rows.length && (
          <div id="due-diligence-loaded-count" className={styles.count}>
            {list.rows.length} applications loaded
          </div>
        )}
      </div>
      {actionError && !cloneId && (
        <p id="due-diligence-action-error" role="alert">{actionError}</p>
      )}
      {cloneId && (
        <ActionDialog
          id="due-diligence-clone-dialog"
          title="Clone Due Diligence application"
          busy={cloneBusy}
          onClose={() => {
            setCloneId(null);
            setCloneSelected(null);
          }}
        >
          {cloneOptions.loading && <ListSkeleton />}
          {cloneOptions.error && (
            <State title="Clone options unavailable" message={cloneOptions.error.message} code={cloneOptions.error.code} retry={cloneOptions.retry} />
          )}
          {cloneOptions.data?.map((option) => (
            <label key={option.value} htmlFor={`due-diligence-clone-${option.value}`}>
              <input
                id={`due-diligence-clone-${option.value}`}
                type="checkbox"
                checked={selectedObjects.includes(option.value)}
                disabled={cloneBusy}
                onChange={(event) => setCloneSelected(
                  event.target.checked
                    ? [...selectedObjects, option.value]
                    : selectedObjects.filter((value) => value !== option.value),
                )}
              />
              {option.label}
            </label>
          ))}
          {actionError && <p id="due-diligence-clone-error" role="alert">{actionError}</p>}
          {cloneOptions.data && (
            <button
              id="due-diligence-clone-submit"
              type="button"
              disabled={cloneBusy}
              onClick={clone}
            >
              Clone
            </button>
          )}
        </ActionDialog>
      )}
      {linkedId && (
        linked.data ? (
          <LinkedObjectsDialog
            id="due-diligence-linked-dialog"
            linked={linked.data}
            onClose={() => setLinkedId(null)}
          >
            {!linked.data.groups.length && <p>{linked.data.texts.none}</p>}
          </LinkedObjectsDialog>
        ) : (
          <ActionDialog
            id="due-diligence-linked-dialog"
            title="Linked Objects"
            onClose={() => setLinkedId(null)}
          >
            {linked.error ? (
              <State title="Linked records unavailable" message={linked.error.message} code={linked.error.code} retry={linked.retry} />
            ) : (
              <ListSkeleton />
            )}
          </ActionDialog>
        )
      )}
      {recycleOpen && (
        <ActionDialog
          id="due-diligence-recycle-dialog"
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
            <p id="due-diligence-restore-error" role="alert">
              {restoreError}
            </p>
          )}
          {deleted.data?.length === 0 && (
            <p id="due-diligence-recycle-empty">
              No deleted Due Diligence applications.
            </p>
          )}
          <ul
            id="due-diligence-deleted-applications"
            className={styles.deleted}
          >
            {deleted.data?.map((row) => (
              <li key={row.id} id={`due-diligence-deleted-${row.id}`}>
                <span>
                  <strong>{row.number}</strong>
                  <br />
                  {row.title}
                </span>
                {row.canRestore && (
                  <button
                    id={`due-diligence-restore-${row.id}`}
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
      {restoreConfirm.element}
      {deleteConfirm.element}
    </FilterPanel>
  );
}

function DueDiligenceCard({
  row,
  view,
  access,
  onLinks,
  onClone,
  onDelete,
  busy,
}: {
  row: DueDiligenceRow;
  view: DueDiligenceListView;
  access: string;
  onLinks: () => void;
  onClone: () => void;
  onDelete: () => void;
  busy: boolean;
}) {
  return (
    <article id={`due-diligence-application-${row.id}`} className={styles.card}>
      <div className={styles.cardHead}>
        <Link
          id={`due-diligence-open-${row.id}`}
          href={`/due-diligence/${row.id}?access=${access}`}
        >
          <Icon name="composite-form" size={16} /> {row.number}
        </Link>
        {view.actions.link && (
          <button
            id={`due-diligence-links-${row.id}`}
            type="button"
            aria-label={`Linked records for ${row.number}`}
            onClick={onLinks}
          >
            <Icon name="link" size={16} />
          </button>
        )}
        {view.actions.clone && ["DDA_ACCESS", "RESPONDENT_ACCESS"].includes(access) && (
          <button
            id={`due-diligence-clone-${row.id}`}
            type="button"
            aria-label={`Clone ${row.number}`}
            onClick={onClone}
          >
            <Icon name="copy" size={16} />
          </button>
        )}
        {view.actions.clone && view.actions.delete && row.statusCode === "DRFT" &&
          ["DDA_ACCESS", "RESPONDENT_ACCESS"].includes(access) && (
          <button
            id={`due-diligence-delete-${row.id}`}
            type="button"
            aria-label={`Delete ${row.number}`}
            disabled={busy}
            onClick={onDelete}
          >
            <Icon name="trash" size={16} />
          </button>
        )}
        {row.status && <span className={styles.badge}>{row.status}</span>}
        {row.risk && <span className={styles.risk}>{row.risk}</span>}
        {access === "DDA_ACCESS" && row.responseStatus && (
          <span className={styles.badge}>{row.responseStatus}</span>
        )}
      </div>
      <h2>{row.title || row.number}</h2>
      <div className={styles.meta}>
        {view.fields.createdBy && row.createdBy && (
          <Meta label={view.texts.createdBy} value={row.createdBy} />
        )}
        {view.fields.updatedBy && row.updatedBy && (
          <Meta label={view.texts.updatedBy} value={row.updatedBy} />
        )}
        {view.fields.created && row.created && (
          <Meta label={view.texts.created} value={row.created} />
        )}
        {view.fields.updated && row.updated && (
          <Meta label={view.texts.updated} value={row.updated} />
        )}
        {view.fields.deadline && row.deadline && (
          <Meta label={view.texts.deadline} value={row.deadline} />
        )}
        {view.fields.expiry && row.expiry && (
          <Meta label={view.texts.expiry} value={row.expiry} />
        )}
        {view.fields.dueDiligenceType && row.dueDiligenceType && (
          <Meta
            label={view.texts.dueDiligenceType}
            value={row.dueDiligenceType}
          />
        )}
        {view.fields.formType && row.formType && (
          <Meta label={view.texts.formType} value={row.formType} />
        )}
        {view.fields.org && row.org && (
          <Meta label={view.texts.org} value={row.org} />
        )}
        {view.fields.reviewer && row.reviewer && (
          <Meta label={view.texts.reviewer} value={row.reviewer} />
        )}
      </div>
    </article>
  );
}
function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div className={styles.metaItem}>
      <strong>{label}</strong>
      <span>{value}</span>
    </div>
  );
}
