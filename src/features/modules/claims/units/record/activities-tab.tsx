"use client";
import { useState } from "react";
import { useActionFailure } from "@/components/dialog/action-failure";
import { useToast } from "@/components/feedback/toast";
import { State } from "@/components/feedback/state";
import { TableSkeleton } from "@/components/feedback/skeleton";
import { DataTable } from "@/components/ui/data-table";
import { HelpButton } from "@/components/ui/help-button";
import { InsideField } from "@/components/ui/inside-field";
import { ReadonlyField } from "@/components/ui/readonly-field";
import { Select } from "@/components/ui/select";
import { TabBar } from "@/components/ui/tab-bar";
import { claims, useApi } from "@/lib/api";
import type { FormatSettings } from "@/lib/format";
import { functions } from "@/lib/functions";
import { useInFlight } from "@/lib/hooks/use-in-flight";
import type { ActivityView } from "@/shared/claims/unit-record";
import type { UnitActivitiesView, UnitActivityRow } from "../types";
import { ActivityDetails } from "./activity-details";
import styles from "./summary.module.css";

type Format = FormatSettings & { currency?: string };
type Header = { label: string; help: string | null };
const head = (id: string, h: Header) => (
  <>
    {h.label}
    <HelpButton id={`${id}-help`} html={h.help} />
  </>
);
const ID = "claims-unit-activities";

/**
 * The Activities tab (legacy claims-unit-activities): the fund and period filter with the fund's summary and
 * category counts, then Fund Summary and Activities List, each read when it opens.
 */
export function UnitActivitiesTab({
  appId,
  format,
}: {
  appId: string;
  format?: Format;
}) {
  const [fund, setFund] = useState(""),
    [period, setPeriod] = useState("CURRENT"),
    [tab, setTab] = useState<ActivityView>("fund-summary"),
    // The activity on the details tab; the tab shows only while one is open (legacy View).
    [opened, setOpened] = useState<{
      activity: string;
      version: string;
    } | null>(null);
  const read = useApi(claims.activities, { appId, fund });
  const view = read.data;
  if (read.error)
    return (
      <State
        id={`${ID}-error`}
        title="Couldn't load the activities"
        message={read.error.message}
        retry={read.retry}
      />
    );
  if (!view) return <TableSkeleton label="Loading activities" />;
  const money = (v: number | null) =>
    v === null
      ? ""
      : functions.format.moneyDisplay(String(v), format?.currency, format);
  const c = view.categories;
  return (
    <div id={ID} className={styles.tab}>
      <div className={styles.pair}>
        <section id={`${ID}-filters`} className={styles.panel}>
          <div className={styles.fields}>
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
                  // Legacy activityFIlterChanged: a fund change leaves the details for Fund Summary.
                  setFund(next);
                  setOpened(null);
                  if (tab === "activity-details") setTab("fund-summary");
                }}
              />
            </InsideField>
            <InsideField
              htmlFor={`${ID}-period-trigger`}
              label={view.labels.period}
              filled={period !== ""}
            >
              <Select
                id={`${ID}-period`}
                label={view.labels.period}
                options={view.periods}
                value={period}
                onChange={setPeriod}
              />
            </InsideField>
          </div>
          <div className={`${styles.fields} ${styles.summaryFields}`}>
            <ReadonlyField
              id={`${ID}-fund-status`}
              label={view.status.label}
              value={view.status.value}
            />
            {view.amounts.map((a) => (
              <ReadonlyField
                key={a.key}
                id={`${ID}-${a.key}`}
                label={a.label}
                value={money(a.value)}
              />
            ))}
          </div>
        </section>
        <section id={`${ID}-categories`} className={styles.panel}>
          <DataTable
            id={`${ID}-categories-table`}
            rowIds={`${ID}-category`}
            label={c.headers.category.label}
            rows={c.rows}
            rowKey={(r) => r.key}
            empty={view.empty}
            columns={(
              ["category", "pending", "review", "approved", "rejected"] as const
            ).map((k) => ({
              id: k,
              header: head(`${ID}-categories-${k}`, c.headers[k]),
              cell: (r: (typeof c.rows)[number]) => r[k],
            }))}
          />
        </section>
      </div>
      <section id={`${ID}-panel`} className={styles.panel}>
        <TabBar
          align="start"
          id={`${ID}-tabs`}
          label="Activities"
          tabs={[
            ...view.tabs.map((t) => ({ key: t.id, name: t.label })),
            ...(opened
              ? [{ key: "activity-details" as const, name: view.texts.details }]
              : []),
          ]}
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
          ) : tab === "fund-summary" ? (
            <FundSummary
              appId={appId}
              fund={view.fund}
              period={period}
              view={view}
              money={money}
            />
          ) : tab === "activity-details" && opened ? (
            <ActivityDetails
              key={`${opened.activity}-${opened.version}`}
              appId={appId}
              fund={view.fund}
              activity={opened.activity}
              version={opened.version}
              format={format}
              money={money}
              onVersion={(version) => setOpened({ ...opened, version })}
              onChanged={read.retry}
            />
          ) : (
            <ActivityList
              appId={appId}
              fund={view.fund}
              view={view}
              money={money}
              onChanged={read.retry}
              onView={(r) => {
                setOpened({ activity: r.key, version: r.version });
                setTab("activity-details");
              }}
            />
          )}
        </div>
      </section>
    </div>
  );
}

function FundSummary({
  appId,
  fund,
  period,
  view,
  money,
}: {
  appId: string;
  fund: string;
  period: string;
  view: UnitActivitiesView;
  money: (v: number | null) => string;
}) {
  const read = useApi(claims.activityFundSummary, { appId, fund, period });
  const data = read.data;
  if (read.error)
    return (
      <State
        id={`${ID}-fund-summary-error`}
        title="Couldn't load the fund summary"
        message={read.error.message}
        retry={read.retry}
      />
    );
  if (!data) return <TableSkeleton label="Loading the fund summary" />;
  const h = data.headers;
  const amountCol = (
    k: "salaries" | "benefits" | "services" | "supplies" | "capital" | "total",
  ) => ({
    id: k,
    header: head(`${ID}-fund-summary-${k}`, h[k]),
    cell: (r: (typeof data.rows)[number]) => money(r[k]),
    footer: money(data.totals[k]),
  });
  return (
    <DataTable
      id={`${ID}-fund-summary-table`}
      rowIds={`${ID}-fund-summary-row`}
      label={view.tabs[0]?.label ?? ""}
      rows={data.rows}
      rowKey={(r) => r.key}
      empty={view.empty}
      columns={[
        {
          id: "function",
          header: head(`${ID}-fund-summary-function`, h.function),
          rowHeader: true,
          cell: (r) => r.function,
          footer: view.texts.total,
        },
        amountCol("salaries"),
        amountCol("benefits"),
        amountCol("services"),
        amountCol("supplies"),
        amountCol("capital"),
        amountCol("total"),
        {
          id: "description",
          header: head(`${ID}-fund-summary-description`, h.description),
          cell: (r) => r.description,
        },
      ]}
    />
  );
}

function ActivityList({
  appId,
  fund,
  view,
  money,
  onChanged,
  onView,
}: {
  appId: string;
  fund: string;
  view: UnitActivitiesView;
  money: (v: number | null) => string;
  onChanged: () => void;
  onView: (r: UnitActivityRow) => void;
}) {
  const [status, setStatus] = useState("");
  const read = useApi(claims.activityList, { appId, fund, status });
  const toast = useToast(),
    fail = useActionFailure(),
    { run, isActive } = useInFlight();
  const data = read.data;
  const bar = (
    <div className={styles.goalsBar}>
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
          onChange={setStatus}
        />
      </InsideField>
    </div>
  );
  if (read.error)
    return (
      <>
        {bar}
        <State
          id={`${ID}-list-error`}
          title="Couldn't load the activities"
          message={read.error.message}
          retry={read.retry}
        />
      </>
    );
  if (!data)
    return (
      <>
        {bar}
        <TableSkeleton label="Loading the activities" />
      </>
    );
  const h = data.headers;
  type Row = (typeof data.rows)[number];
  const text = (
    k: Exclude<keyof typeof h, "amount">,
  ): { id: string; header: React.ReactNode; cell: (r: Row) => string } => ({
    id: functions.ids.idPart(k),
    header: head(`${ID}-list-${functions.ids.idPart(k)}`, h[k]),
    cell: (r) => r[k],
  });
  const remove = (r: Row) =>
    void run(async () => {
      const result = await claims.deleteActivity(appId, {
        fund,
        activity: r.key,
        version: r.version,
      });
      if (!result.ok) return fail(result.error);
      if (result.data.warning)
        toast.show(
          "warning",
          result.data.warning.summary,
          result.data.warning.message,
        );
      read.retry();
      onChanged();
    }, `delete-${r.key}`);
  return (
    <>
      {bar}
      <DataTable
        id={`${ID}-list-table`}
        rowIds={`${ID}-list-row`}
        label={view.tabs[1]?.label ?? ""}
        rows={data.rows}
        rowKey={(r) => r.key}
        empty={view.empty}
        columns={[
          { ...text("number"), rowHeader: true, footer: view.texts.total },
          text("functionCode"),
          text("objectCode"),
          text("type"),
          text("goals"),
          {
            id: "amount",
            header: head(`${ID}-list-amount`, h.amount),
            cell: (r) => money(r.amount),
            footer: money(data.total),
          },
          text("jobTitle"),
          text("itemization"),
          text("fte"),
          text("status"),
          text("homeless"),
          text("amended"),
          text("functionDescription"),
          text("objectDescription"),
        ]}
        actions={[
          {
            id: "view",
            icon: "view",
            label: (r) => `${view.texts.view} ${r.number}`,
            onClick: onView,
          },
          {
            id: "delete",
            icon: "trash",
            label: (r) => `${view.texts.delete} ${r.number}`,
            // Legacy disables Delete outside an editable status; hidden here (owner, 2026-11-03).
            hidden: (r) => !r.deletable,
            disabled: (r) => isActive(`delete-${r.key}`),
            onClick: remove,
          },
        ]}
      />
    </>
  );
}
