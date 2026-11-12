"use client";
import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { ActionDialog, useConfirm } from "@/components/dialog/action-dialog";
import { useActionFailure } from "@/components/dialog/action-failure";
import { State } from "@/components/feedback/state";
import { TableSkeleton } from "@/components/feedback/skeleton";
import { DataTable } from "@/components/ui/data-table";
import { Icon } from "@/components/ui/icon";
import { InsideField } from "@/components/ui/inside-field";
import { Select } from "@/components/ui/select";
import { StatusBadge } from "@/components/ui/status-badge";
import { TabBar } from "@/components/ui/tab-bar";
import { saveBlob } from "@/features/record/dynamic-form/api";
import {
  PanelAudit,
  useRecordAudit,
} from "@/features/record/shell/record-frame";
import { claims, useApi } from "@/lib/api";
import type { FormatSettings } from "@/lib/format";
import { functions } from "@/lib/functions";
import { useInFlight } from "@/lib/hooks/use-in-flight";
import { claimStatusTone } from "@/shared/claims/status";
import { UNIT_MODULE, type ClaimView } from "@/shared/claims/unit-record";
import type { UnitClaimsView } from "../listing/types";
import { ClaimPanel } from "./claim-panel";
import { FundBar, head } from "./fund-bar";
import styles from "./summary.module.css";

const ID = "claims-unit-claims";
type Format = FormatSettings & { currency?: string };
type Money = (v: number | null) => string;

/**
 * The Claims tab (legacy claims-unit-claims): the fund bar with the claims' figures, then Claims Summary and the
 * Claims List (status filter, Export, row Audits / Clone / Delete), each read when it opens.
 */
export function UnitClaimsTab({
  appId,
  format,
}: {
  appId: string;
  format?: Format;
}) {
  // The listing card or the Activities tab may open a fund; the server refuses one not on the application.
  const query = useSearchParams().get("fund") ?? "";
  const [fund, setFund] = useState(/^\d+$/.test(query) ? query : ""),
    [status, setStatus] = useState(""),
    [tab, setTab] = useState<ClaimView>("claims-summary"),
    // Bumped after a change so the tables read again.
    [revision, setRevision] = useState(0),
    // The claim open in the side panel (legacy recordDrawer; "" is New Claim); the list keeps its place behind it.
    [opened, setOpened] = useState<string | null>(null);
  const read = useApi(claims.claimsTab, { appId, fund });
  const view = read.data;
  if (read.error)
    return (
      <State
        id={`${ID}-error`}
        title="Couldn't load the claims"
        message={read.error.message}
        retry={read.retry}
      />
    );
  if (!view) return <TableSkeleton label="Loading claims" />;
  const money: Money = (v) =>
    v === null
      ? ""
      : functions.format.moneyDisplay(String(v), format?.currency, format);
  const changed = () => {
    read.retry();
    setRevision((r) => r + 1);
  };
  return (
    <div id={ID} className={styles.tab}>
      <FundBar
        id={ID}
        bar={view}
        empty={view.empty}
        format={format}
        money={money}
        filters={
          <InsideField
            htmlFor={`${ID}-fund-trigger`}
            label={view.labels.fund}
            filled={view.fund !== ""}
          >
            <Select
              id={`${ID}-fund`}
              label={view.labels.fund}
              options={view.funds}
              value={view.fund}
              onChange={(next) => {
                setFund(next);
                setOpened(null);
              }}
            />
          </InsideField>
        }
      />
      <section id={`${ID}-panel`} className={styles.panel}>
        <TabBar
          align="start"
          id={`${ID}-tabs`}
          label={view.labels.fund}
          tabs={view.tabs.map((t) => ({ key: t.id, name: t.label }))}
          selected={tab}
          onSelect={setTab}
        />
        <div
          id={`${ID}-tabs-panel-${tab}`}
          role="tabpanel"
          aria-labelledby={`${ID}-tabs-tab-${tab}`}
        >
          {view.fund === "" ? (
            <p id={`${ID}-no-fund`}>{view.empty}</p>
          ) : tab === "claims-summary" ? (
            <ClaimsSummary
              key={revision}
              appId={appId}
              fund={view.fund}
              view={view}
              money={money}
            />
          ) : (
            <ClaimsList
              key={revision}
              appId={appId}
              fund={view.fund}
              status={status}
              onStatus={setStatus}
              view={view}
              money={money}
              format={format}
              onChanged={changed}
              onView={setOpened}
            />
          )}
        </div>
      </section>
      {opened !== null && view.fund !== "" && (
        <ActionDialog
          id={`${ID}-claim`}
          title={view.texts.details}
          side
          onClose={() => setOpened(null)}
        >
          <PanelAudit
            id={`${ID}-claim-audit`}
            objectType={UNIT_MODULE}
            objectId={appId}
          >
            <ClaimPanel
              key={`${opened}-${revision}`}
              appId={appId}
              fund={view.fund}
              claim={opened}
              status={status}
              format={format}
              money={money}
              onChanged={changed}
              onSaved={(claim) => {
                setOpened(claim);
                changed();
              }}
            />
          </PanelAudit>
        </ActionDialog>
      )}
    </div>
  );
}

function ClaimsSummary({
  appId,
  fund,
  view,
  money,
}: {
  appId: string;
  fund: string;
  view: UnitClaimsView;
  money: Money;
}) {
  const read = useApi(claims.claimsSummaryTable, { appId, fund });
  const data = read.data;
  if (read.error)
    return (
      <State
        id={`${ID}-summary-error`}
        title="Couldn't load the claims summary"
        message={read.error.message}
        retry={read.retry}
      />
    );
  if (!data) return <TableSkeleton label="Loading the claims summary" />;
  const h = data.headers;
  return (
    <DataTable
      id={`${ID}-summary-table`}
      rowIds={`${ID}-summary-row`}
      label={view.tabs[0]?.label ?? ""}
      rows={data.rows}
      rowKey={(r) => r.key}
      empty={view.empty}
      columns={[
        {
          id: "function",
          header: head(`${ID}-summary-function`, h.function),
          rowHeader: true,
          cell: (r) => r.function,
          footer: view.texts.total,
        },
        ...data.columns.map((k) => ({
          id: k,
          header: head(`${ID}-summary-${k}`, h[k]),
          cell: (r: (typeof data.rows)[number]) => money(r.amounts[k]),
          footer: money(data.totals[k]),
        })),
        {
          id: "description",
          header: head(`${ID}-summary-description`, h.description),
          cell: (r) => r.description,
        },
      ]}
    />
  );
}

function ClaimsList({
  appId,
  fund,
  status,
  onStatus,
  view,
  money,
  format,
  onChanged,
  onView,
}: {
  appId: string;
  fund: string;
  status: string;
  onStatus: (s: string) => void;
  view: UnitClaimsView;
  money: Money;
  format?: FormatSettings;
  onChanged: () => void;
  onView: (claim: string) => void;
}) {
  const read = useApi(claims.claimsList, { appId, fund, status });
  const fail = useActionFailure(),
    { run, isActive } = useInFlight(),
    confirm = useConfirm(`${ID}-list-confirm`),
    openAudit = useRecordAudit();
  const data = read.data;
  const x = view.texts;
  const exportList = () =>
    void run(async () => {
      const result = await claims.exportClaims(appId, fund, status);
      if (!result.ok) return fail(result.error);
      saveBlob(result.data.blob, result.data.filename);
    }, "export");
  const clone = (key: string) =>
    void run(async () => {
      if (
        !(await confirm.ask({
          title: x.cloneTitle,
          message: x.cloneMessage,
          confirm: x.clone,
          cancel: x.cancel,
        }))
      )
        return;
      const result = await claims.cloneClaim(appId, fund, key);
      if (!result.ok) return fail(result.error);
      onChanged();
    }, `clone-${key}`);
  const remove = (key: string) =>
    void run(async () => {
      if (
        !(await confirm.ask({
          title: x.deleteTitle,
          message: x.deleteMessage,
          confirm: x.deleteConfirm,
          cancel: x.deleteCancel,
          danger: true,
        }))
      )
        return;
      const result = await claims.deleteClaim(appId, fund, key);
      if (!result.ok) return fail(result.error);
      onChanged();
    }, `delete-${key}`);
  const date = (v: string) => functions.format.dateDisplay(v, format);
  return (
    <>
      <div className={styles.editorBar}>
        <InsideField
          htmlFor={`${ID}-status-trigger`}
          label={view.labels.status}
          filled
        >
          <Select
            id={`${ID}-status`}
            label={view.labels.status}
            options={view.statuses}
            value={status}
            onChange={onStatus}
          />
        </InsideField>
        {view.add && (
          <button
            type="button"
            id={`${ID}-add`}
            className="gn-btn gn-btn--outlined"
            onClick={() => onView("")}
          >
            <Icon name="plus" size={14} />
            {view.add}
          </button>
        )}
        {view.canExport && (data?.rows.length ?? 0) > 0 && (
          <button
            type="button"
            id={`${ID}-export`}
            className="gn-btn gn-btn--primary"
            disabled={isActive("export")}
            onClick={exportList}
          >
            <Icon name="download" size={14} />
            {x.export}
          </button>
        )}
      </div>
      {read.error ? (
        <State
          id={`${ID}-list-error`}
          title="Couldn't load the claims"
          message={read.error.message}
          retry={read.retry}
        />
      ) : !data ? (
        <TableSkeleton label="Loading the claims" />
      ) : (
        <DataTable
          id={`${ID}-list-table`}
          rowIds={`${ID}-list-row`}
          label={view.tabs[1]?.label ?? ""}
          rows={data.rows}
          rowKey={(r) => r.key}
          empty={view.empty}
          columns={[
            {
              id: "number",
              header: head(`${ID}-list-number`, data.headers.number),
              rowHeader: true,
              cell: (r) => r.number,
            },
            {
              id: "date",
              header: head(`${ID}-list-date`, data.headers.date),
              cell: (r) => date(r.date),
            },
            {
              id: "status",
              header: head(`${ID}-list-status`, data.headers.status),
              cell: (r) => {
                const tone = claimStatusTone(r.status);
                return tone ? (
                  <StatusBadge dot tone={tone}>
                    {r.status}
                  </StatusBadge>
                ) : (
                  r.status
                );
              },
            },
            {
              id: "paid-date",
              header: head(`${ID}-list-paid-date`, data.headers.paidDate),
              cell: (r) => date(r.paidDate),
            },
            {
              id: "po",
              header: head(`${ID}-list-po`, data.headers.po),
              cell: (r) => r.po,
            },
            {
              id: "period",
              header: head(`${ID}-list-period`, data.headers.period),
              cell: (r) => r.period,
            },
            {
              id: "amount",
              header: head(`${ID}-list-amount`, data.headers.amount),
              cell: (r) => money(r.amount),
            },
            {
              id: "approved",
              header: head(`${ID}-list-approved`, data.headers.approved),
              cell: (r) => money(r.approved),
            },
            {
              id: "lines",
              header: head(`${ID}-list-lines`, data.headers.lines),
              cell: (r) => r.lines,
            },
            {
              id: "rejected",
              header: head(`${ID}-list-rejected`, data.headers.rejected),
              cell: (r) => r.rejected,
            },
            {
              id: "adjustments",
              header: head(`${ID}-list-adjustments`, data.headers.adjustments),
              cell: (r) => r.adjustments,
            },
          ]}
          actions={[
            {
              id: "view",
              icon: "view",
              label: (r) => `${x.view} ${r.number}`,
              onClick: (r) => onView(r.key),
            },
            {
              id: "audits",
              icon: "audits",
              label: (r) => `${x.audits} ${r.number}`,
              onClick: (r) =>
                openAudit({
                  page: "claims-unit-claims",
                  sec: r.key,
                  title: x.audits,
                }),
            },
            {
              id: "clone",
              icon: "copy",
              label: (r) => `${x.clone} ${r.number}`,
              hidden: (r) => !r.canClone,
              disabled: (r) => isActive(`clone-${r.key}`),
              onClick: (r) => clone(r.key),
            },
            {
              id: "delete",
              icon: "trash",
              label: (r) => `${x.delete} ${r.number}`,
              hidden: (r) => !r.canDelete,
              disabled: (r) => isActive(`delete-${r.key}`),
              onClick: (r) => remove(r.key),
            },
          ]}
        />
      )}
      {confirm.element}
    </>
  );
}
