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
import { TabBar } from "@/components/ui/tab-bar";
import { ApplicationCard } from "@/components/ui/application-card";
import { StatusBadge } from "@/components/ui/status-badge";
import { RecordMetadata } from "@/components/ui/record-metadata";
import { useFormat } from "@/components/layout/shell-context";
import { functions } from "@/lib/functions";
import type { FormatSettings } from "@/lib/format";
import { State } from "@/components/feedback/state";
import { ActionDialog, useConfirm } from "@/components/dialog/action-dialog";
import { ListSkeleton } from "@/components/feedback/skeleton";
import { CloneApplicationDialog } from "@/components/dialog/clone-application-dialog";
import { LinkedObjectsLoader } from "@/features/record/linked/linked-dialog";
import { useInFlight } from "@/lib/hooks/use-in-flight";
import { canDeleteEthics } from "@/shared/ethics/listing";
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
import styles from "./ethics-list.module.css";

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

export function EthicsList({
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
  const deleteConfirm = useConfirm("ethics-delete-confirm");
  const [linkedId, setLinkedId] = useState<string | null>(null);
  const [cloneId, setCloneId] = useState<string | null>(null);
  const [actionError, setActionError] = useState("");
  const { run, isActive } = useInFlight();
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
  const linked = useApi(
    ethics.links,
    linkedId ? { id: linkedId, access } : null,
  );
  const cloneOptions = useApi(
    ethics.cloneOptions,
    cloneId ? { id: cloneId, access } : null,
  );
  const clone = (objects: string[]) =>
    void run(async () => {
      if (!cloneId) return;
      setActionError("");
      const result = await ethics.clone(cloneId, access, objects);
      if (!result.ok) return setActionError(result.error.message);
      setCloneId(null);
      list.reload();
    }, "clone");
  const remove = (id: string, number: string) =>
    void run(async () => {
      if (
        !(await deleteConfirm.ask({
          title: view.labels.deleteTitle,
          message: view.labels.deleteMessage,
          detail: number,
          confirm: view.labels.deleteConfirm,
          cancel: view.labels.deleteCancel,
          danger: true,
        }))
      )
        return;
      setActionError("");
      const result = await ethics.remove(id, access);
      if (!result.ok) return setActionError(result.error.message);
      list.reload();
    }, `delete-${id}`);
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
      setRecycleOpen(false);
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
          <h2 id="ethics-filter-heading" className={styles.filterHeading}>
            {view.labels.filters}
          </h2>
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
                      id={`ethics-filter-type-${functions.ids.idPart(option.value)}`}
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
              onClick={() => {
                setRestoreError("");
                setRecycleOpen(true);
              }}
            >
              <Icon name="trash" size={17} /> {view.labels.recycle}
            </button>
          )}
        </div>
        <TabBar
          id="ethics"
          label="Ethics access"
          align="stretch"
          tabs={view.tabs.map((tab) => ({
            key: tab.value.toLowerCase(),
            name: tab.label,
          }))}
          selected={access.toLowerCase()}
          onSelect={(key) =>
            navigate({
              ...defaultEthicsFilters,
              access:
                view.tabs.find((tab) => tab.value.toLowerCase() === key)
                  ?.value ?? access,
            })
          }
        />
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
              onLinks={() => setLinkedId(row.id)}
              onClone={() => {
                setActionError("");
                setCloneId(row.id);
              }}
              onDelete={() => remove(row.id, row.number)}
              deleting={isActive(`delete-${row.id}`)}
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
            {list.total === undefined
              ? `${list.rows.length} applications loaded`
              : `${list.rows.length} of ${list.total}`}
          </div>
        )}
      </div>
      {recycleOpen && (
        <ActionDialog
          id="ethics-recycle-dialog"
          title={view.labels.recycle}
          width="600px"
          className={styles.recycleDialog}
          busy={restoring !== null}
          onClose={() => setRecycleOpen(false)}
        >
          <div id="ethics-recycle-body" className={styles.recycleBody}>
            {deleted.loading && !deleted.data && <ListSkeleton />}
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
              <p id="ethics-recycle-empty" className={styles.recycleEmpty}>
                {view.labels.noData}
              </p>
            )}
            {!!deleted.data?.length && (
              <ul id="ethics-deleted-applications" className={styles.deleted}>
                {deleted.data.map((row) => (
                  <li key={row.id} id={`ethics-deleted-${row.id}`}>
                    <div className={styles.deletedInfo}>
                      <div className={styles.deletedHead}>
                        <Icon name="data-document" size={18} />
                        <strong>{row.number}</strong>
                        {row.risk && (
                          <StatusBadge
                            tone={
                              row.riskCode === "HIGH" ||
                              row.riskCode === "CRITICAL"
                                ? "danger"
                                : row.riskCode === "MEDIUM"
                                  ? "warning"
                                  : row.riskCode === "LOW"
                                    ? "success"
                                    : "info"
                            }
                          >
                            {row.risk}
                          </StatusBadge>
                        )}
                      </div>
                      <h3>{row.title}</h3>
                      <RecordMetadata
                        id={`ethics-deleted-metadata-${row.id}`}
                        fields={[
                          { label: view.texts.createdBy, value: row.createdBy },
                          { label: view.texts.updatedBy, value: row.updatedBy },
                          {
                            label: view.texts.updated,
                            value: row.updated
                              ? functions.format.dateDisplay(
                                  row.updated,
                                  format,
                                )
                              : "",
                          },
                          {
                            label: view.texts.deadline,
                            value: row.deadline
                              ? functions.format.dateDisplay(
                                  row.deadline,
                                  format,
                                )
                              : "",
                          },
                          {
                            label: view.texts.expiry,
                            value: row.expiry
                              ? functions.format.dateDisplay(row.expiry, format)
                              : "",
                          },
                          {
                            label: view.texts.ethicsType,
                            value: row.ethicsType,
                          },
                          { label: view.texts.formType, value: row.formType },
                          { label: view.texts.org, value: row.org },
                        ]}
                      />
                    </div>
                    {row.canRestore && (
                      <button
                        id={`ethics-restore-${row.id}`}
                        type="button"
                        aria-label={`${view.labels.restore} ${row.number}`}
                        title={view.labels.restore}
                        disabled={restoring !== null}
                        onClick={() => restore(row.id, row.number)}
                      >
                        <Icon name="undo" size={18} />
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </ActionDialog>
      )}
      {actionError && !cloneId && (
        <p id="ethics-action-error" role="alert">
          {actionError}
        </p>
      )}
      {cloneId && (
        <CloneApplicationDialog
          id="ethics-clone-dialog"
          texts={{
            title: view.labels.cloneTitle,
            entire: view.labels.cloneEntire,
            clone: view.labels.cloneSubmit,
            cancel: view.labels.cancel,
          }}
          options={cloneOptions.data}
          error={cloneOptions.error}
          retry={cloneOptions.retry}
          busy={isActive("clone")}
          failure={actionError || undefined}
          onClone={clone}
          onClose={() => setCloneId(null)}
        />
      )}
      {linkedId && (
        <LinkedObjectsLoader
          id="ethics-linked-dialog"
          title={view.labels.linkTitle}
          linked={linked}
          onClose={() => setLinkedId(null)}
        />
      )}
      {confirm.element}
      {deleteConfirm.element}
    </FilterPanel>
  );
}

function EthicsCard({
  row,
  view,
  access,
  format,
  onLinks,
  onClone,
  onDelete,
  deleting,
}: {
  row: EthicsRow;
  view: EthicsListView;
  access: string;
  format: FormatSettings | undefined;
  onLinks: () => void;
  onClone: () => void;
  onDelete: () => void;
  deleting: boolean;
}) {
  // Legacy ethics-start-page card toolbar: Link (RB), Clone (grant, RB, administrator / respondent view), Delete
  // (grant, RB, checkDeleteEthicsConditions).
  const listed = access === "EA_ACCESS" || access === "RESPONDENT_ACCESS";
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
    <ApplicationCard
      id={`ethics-application-${row.id}`}
      openId={`ethics-open-${row.id}`}
      metadataId={`ethics-metadata-${row.id}`}
      href={`/ethics/${row.id}?access=${access}`}
      icon="certification"
      number={row.number}
      title={row.title}
      status={{ label: row.status, code: row.statusCode }}
      risk={{ label: row.risk, code: row.riskCode }}
      response={
        access === "EA_ACCESS" && row.responseStatus
          ? `${view.texts.responseStatus} : ${row.responseStatus}`
          : undefined
      }
      fields={fields}
      actions={
        <>
          {view.actions.link && (
            <button
              id={`ethics-links-${row.id}`}
              type="button"
              aria-label={`${view.labels.link} ${row.number}`}
              title={view.labels.link}
              onClick={onLinks}
            >
              <Icon name="link" size={16} />
            </button>
          )}
          {view.actions.clone && listed && (
            <button
              id={`ethics-clone-${row.id}`}
              type="button"
              aria-label={`${view.labels.clone} ${row.number}`}
              title={view.labels.clone}
              onClick={onClone}
            >
              <Icon name="copy" size={16} />
            </button>
          )}
          {view.actions.delete &&
            canDeleteEthics(
              access,
              row.ethicsTypeCode,
              row.statusCode,
              row.responseStatusCode,
            ) && (
              <button
                id={`ethics-delete-${row.id}`}
                type="button"
                aria-label={`${view.labels.delete} ${row.number}`}
                title={view.labels.delete}
                disabled={deleting}
                onClick={onDelete}
              >
                <Icon name="trash" size={16} />
              </button>
            )}
        </>
      }
    />
  );
}
