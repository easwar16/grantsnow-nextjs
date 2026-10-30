"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { Icon } from "@/components/ui/icon";
import { FilterPanel } from "@/components/ui/filter-panel";
import { Select } from "@/components/ui/select";
import { InsideField } from "@/components/ui/inside-field";
import { StatusList } from "@/components/ui/status-list";
import { Collapsible } from "@/components/ui/collapsible";
import { RecordMetadata } from "@/components/ui/record-metadata";
import listing from "@/components/ui/listing.module.css";
import { Skeleton } from "@/components/feedback/skeleton";
import { State } from "@/components/feedback/state";
import { useToast } from "@/components/feedback/toast";
import { useInFlight } from "@/lib/hooks/use-in-flight";
import { saveBlob } from "@/features/record/dynamic-form/api";
import { claims, useApi, usePagedApi } from "@/lib/api";
import { isOffline } from "@/lib/api/http";
import { constants } from "@/lib/constants";
import {
  clearedUnitFilters,
  serializeUnitFilters,
  unitFiltered,
  type UnitFilters,
} from "./schema";
import type { UnitListView, UnitPage, UnitRow } from "./types";
import { UnitDialog } from "./unit-dialog";
import { CloneUnitDialog } from "./clone-unit-dialog";
import styles from "./unit-list.module.css";

type PublicError = { code: string; message: string; action?: string };
export type UnitListResult =
  { ok: true; data: UnitPage } | { ok: false; error: PublicError };

const NO_CHOICES: UnitListView["funds"] = [];
const UNREACHABLE: PublicError = {
  code: "UPSTREAM",
  message: "Unit applications could not be loaded.",
};

/**
 * Unit Inquiry (legacy claims-unit-inquiry-page): every unit application with its funds' and claims' status, the
 * status list and filters in the drawer, Create / Update and Clone.
 */
export function UnitList({
  view,
  initial,
}: {
  view: UnitListView;
  /** The default filters' first page, streaming from the server. */
  initial: Promise<UnitListResult>;
}) {
  const { gates: g, actions: a, texts: t } = view;
  const toast = useToast(),
    { run, isActive } = useInFlight();
  /** Legacy exportReport: the report downloads under the name the backend gives it. */
  const exportFile = (
    key: string,
    read: () => ReturnType<typeof claims.exportUnits>,
  ) =>
    run(async () => {
      const r = await read();
      if (!r.ok) return toast.error(r.error);
      saveBlob(r.data.blob, r.data.filename);
    }, key);
  const [filters, setFilters] = useState<UnitFilters>(clearedUnitFilters);
  const [panelOpen, setPanelOpen] = useState(true);
  const [dialog, setDialog] = useState<
    { kind: "create" } | { kind: "edit" | "clone"; row: UnitRow } | null
  >(null);
  const list = useRef<HTMLUListElement>(null);
  const [seed] = useState(() =>
    initial.then((r) =>
      r.ok
        ? { ok: r.ok, data: { ...r.data, total: r.data.total ?? undefined } }
        : r,
    ),
  );
  const orgs = useApi(claims.unitChoices, "orgs").data;
  const paged = usePagedApi(claims.units, filters, { initial: seed });
  const { rows, loading } = paged,
    total = paged.total ?? null,
    failed =
      paged.error && isOffline({ ok: false, error: paged.error })
        ? UNREACHABLE
        : paged.error,
    error = failed && rows.length === 0 ? failed : undefined,
    moreFailed = failed !== undefined && rows.length > 0;
  const filterKey = serializeUnitFilters(filters);

  useEffect(() => {
    list.current?.scrollTo({ top: 0 });
  }, [filterKey]);
  useEffect(() => {
    for (const message of view.errors) toast.show("error", message);
  }, [view.errors, toast]);
  useEffect(() => {
    for (const message of orgs?.errors ?? []) toast.show("error", message);
  }, [orgs, toast]);
  useEffect(() => {
    if (moreFailed && failed) toast.error(failed);
  }, [moreFailed, failed, toast]);

  const patch = (change: Partial<UnitFilters>) =>
    setFilters((f) => ({ ...f, ...change }));
  const { loadMore } = paged;
  const more = useCallback(() => {
    if (!failed) loadMore();
  }, [failed, loadMore]);
  useEffect(() => {
    const el = list.current;
    if (el && el.scrollHeight <= el.clientHeight) more();
  }, [rows, more]);

  const select = (
    key: "unit" | "year" | "fund",
    options: UnitListView["funds"],
  ) => (
    <InsideField
      htmlFor={`claims-units-filter-${key}-trigger`}
      label={t[key]}
      filled={filters[key] !== ""}
    >
      <Select
        id={`claims-units-filter-${key}`}
        label={t[key]}
        options={options}
        value={filters[key]}
        onChange={(value) => patch({ [key]: value })}
      />
    </InsideField>
  );

  const drawer = (
    <div
      id="claims-units-drawer"
      className={`${listing.drawer} ${styles.drawer}`}
    >
      <StatusList
        id="claims-units-status"
        label={t.statusLabel}
        options={view.statuses}
        value={filters.status}
        onChange={(status) => patch({ status })}
      />
      <div id="claims-units-filters" className={listing.filters}>
        {g.unit && select("unit", orgs?.options ?? NO_CHOICES)}
        {g.year && select("year", view.years)}
        {g.fund && select("fund", view.funds)}
      </div>
      <button
        type="button"
        id="claims-units-clear"
        className={`gn-btn gn-btn--outlined ${styles.clear}`}
        disabled={!unitFiltered(filters)}
        onClick={() => setFilters(clearedUnitFilters())}
      >
        {t.clear}
      </button>
    </div>
  );

  return (
    <section id="claims-units" className="page-fill" aria-label="Unit Inquiry">
      <FilterPanel
        id="claims-units-filter-panel"
        label="Unit filters"
        page="claims-units"
        filters={drawer}
        open={panelOpen}
      >
        <div id="claims-units-main" className={listing.main}>
          <h1 className="sr-only">Unit Inquiry</h1>
          <div id="claims-units-toolbar" className={styles.toolbar}>
            <button
              type="button"
              id="claims-units-panel-toggle"
              className="gn-btn gn-btn--borderless gn-btn--icon"
              aria-label={t.toggle}
              title={t.toggle}
              aria-expanded={panelOpen}
              aria-controls="claims-units-filter-panel"
              onClick={() => setPanelOpen((o) => !o)}
            >
              <Icon name="collapse-menu" size={14} />
            </button>
            {a.create && (
              <button
                type="button"
                id="claims-units-create"
                className="gn-btn gn-btn--outlined"
                onClick={() => setDialog({ kind: "create" })}
              >
                <Icon name="new-application" size={14} />
                {t.create}
              </button>
            )}
            {a.export && (
              <button
                type="button"
                id="claims-units-export"
                className={`gn-btn gn-btn--borderless ${styles.push}`}
                disabled={isActive("export")}
                onClick={() =>
                  exportFile("export", () => claims.exportUnits(filters))
                }
              >
                <Icon name="download" size={14} />
                {t.export}
              </button>
            )}
          </div>
          {error ? (
            <State
              title="Unit applications unavailable"
              message={error.message}
              action={error.action}
              code={error.code}
              retry={paged.retry}
            />
          ) : (
            <ul
              ref={list}
              id="claims-units-rows"
              className={listing.list}
              aria-label="Unit applications"
              aria-busy={paged.stale}
              inert={paged.stale}
              onScroll={(e) => {
                const el = e.currentTarget;
                if (
                  el.scrollHeight - el.scrollTop - el.clientHeight <
                  constants.paging.loadMorePx
                )
                  more();
              }}
            >
              {rows.map((row) => (
                <li
                  key={row.id}
                  id={`claims-unit-${row.id}`}
                  className={`${listing.row} ${styles.row} enter-rise`}
                >
                  <div
                    id={`claims-unit-${row.id}-body`}
                    className={listing.body}
                  >
                    <div className={`${listing.overline} ${styles.overline}`}>
                      <Icon name="data-document" size={14} />
                      <span
                        id={`claims-unit-${row.id}-number`}
                        className={listing.number}
                      >
                        {row.unitId}
                      </span>
                    </div>
                    <span
                      id={`claims-unit-${row.id}-title`}
                      className={listing.title}
                    >
                      {`${row.unitName} | ${row.fiscalYear}`}
                    </span>
                    {row.funds[0]?.fundTypeId && (
                      <div className={styles.sections}>
                        <Collapsible
                          id={`claims-unit-${row.id}-funds`}
                          heading={t.fundStatus}
                          headClassName={styles.sectionHead}
                        >
                          <div className={styles.funds}>
                            {row.funds.map((f, i) => (
                              <div
                                key={i}
                                id={`claims-unit-${row.id}-fund-${i}`}
                                className={styles.fund}
                              >
                                <div className={styles.fundName}>{f.name}</div>
                                <div className={styles.fundStatus}>
                                  {f.statusName}
                                </div>
                              </div>
                            ))}
                          </div>
                        </Collapsible>
                        <Collapsible
                          id={`claims-unit-${row.id}-claims`}
                          heading={t.claimStatus}
                          headClassName={styles.sectionHead}
                        >
                          <div className={`${styles.fields} ${styles.claims}`}>
                            <RecordMetadata
                              muted
                              fields={[
                                {
                                  label: t.completed,
                                  value: row.claims.completed,
                                },
                                {
                                  label: t.incomplete,
                                  value: row.claims.incomplete,
                                },
                                {
                                  label: t.inprocess,
                                  value: row.claims.inprocess,
                                },
                              ]}
                            />
                          </div>
                        </Collapsible>
                      </div>
                    )}
                  </div>
                  <div className={styles.rowActions}>
                    {a.edit && (
                      <button
                        type="button"
                        id={`claims-unit-${row.id}-edit`}
                        className="gn-btn gn-btn--borderless gn-btn--icon"
                        title={t.edit}
                        aria-label={`${t.edit} ${row.unitName}`}
                        onClick={() => setDialog({ kind: "edit", row })}
                      >
                        <Icon name="edit" size={16} />
                      </button>
                    )}
                    {a.export && (
                      <button
                        type="button"
                        id={`claims-unit-${row.id}-export`}
                        className="gn-btn gn-btn--borderless gn-btn--icon"
                        title={t.exportRow}
                        aria-label={`${t.exportRow} ${row.unitName}`}
                        disabled={isActive(`export-${row.id}`)}
                        onClick={() =>
                          exportFile(`export-${row.id}`, () =>
                            claims.exportUnit(row),
                          )
                        }
                      >
                        <Icon name="download" size={16} />
                      </button>
                    )}
                    {a.clone && (
                      <button
                        type="button"
                        id={`claims-unit-${row.id}-clone`}
                        className="gn-btn gn-btn--borderless gn-btn--icon"
                        title={t.clone}
                        aria-label={`${t.clone} ${row.unitName}`}
                        onClick={() => setDialog({ kind: "clone", row })}
                      >
                        <Icon name="copy" size={16} />
                      </button>
                    )}
                  </div>
                </li>
              ))}
              {rows.length === 0 && paged.last !== undefined && (
                <li id="claims-units-empty" className={listing.empty}>
                  {t.empty}
                </li>
              )}
              {((loading && !paged.last) || paged.loadingMore) && (
                <li id="claims-units-loading" className={listing.skeleton}>
                  <Skeleton
                    kind="list"
                    count={rows.length ? 1 : 4}
                    label="Loading unit applications"
                  />
                </li>
              )}
              {moreFailed && (
                <li className={listing.empty}>
                  <button
                    type="button"
                    id="claims-units-retry"
                    className="gn-btn gn-btn--outlined"
                    onClick={paged.retry}
                  >
                    Retry
                  </button>
                </li>
              )}
            </ul>
          )}
          {!error && (
            <p
              id="claims-units-count"
              className={listing.total}
              aria-live="polite"
            >
              {total !== null && rows.length < total ? (
                `${rows.length} of ${total}`
              ) : (
                <>
                  <span className={listing.totalTitle}>{t.total}:</span>{" "}
                  {total ?? rows.length}
                </>
              )}
            </p>
          )}
        </div>
      </FilterPanel>
      {(dialog?.kind === "create" || dialog?.kind === "edit") && (
        <UnitDialog
          id="claims-unit-dialog"
          row={dialog.kind === "edit" ? dialog.row : undefined}
          orgs={orgs?.options ?? NO_CHOICES}
          years={view.years}
          onClose={() => setDialog(null)}
          onSaved={paged.reload}
        />
      )}
      {dialog?.kind === "clone" && (
        <CloneUnitDialog
          id="claims-unit-clone-dialog"
          row={dialog.row}
          years={view.years}
          onClose={() => setDialog(null)}
          onCloned={paged.reload}
        />
      )}
    </section>
  );
}
