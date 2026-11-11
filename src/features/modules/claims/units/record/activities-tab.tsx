"use client";
import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { useActionFailure } from "@/components/dialog/action-failure";
import { useToast } from "@/components/feedback/toast";
import { State } from "@/components/feedback/state";
import { TableSkeleton } from "@/components/feedback/skeleton";
import { DataTable } from "@/components/ui/data-table";
import { InsideField } from "@/components/ui/inside-field";
import { StatusBadge } from "@/components/ui/status-badge";
import { ActionDialog } from "@/components/dialog/action-dialog";
import { claimStatusTone } from "@/shared/claims/status";
import { Select } from "@/components/ui/select";
import { TabBar } from "@/components/ui/tab-bar";
import { claims, useApi } from "@/lib/api";
import type { FormatSettings } from "@/lib/format";
import { functions } from "@/lib/functions";
import { useInFlight } from "@/lib/hooks/use-in-flight";
import type { ActivityView } from "@/shared/claims/unit-record";
import type { UnitActivitiesView, UnitActivityRow } from "../listing/types";
import { ActivityDetails } from "./activity-details";
import { ActivityEditor } from "./activity-editor";
import { AmendmentsPanel, type AmendmentChoice } from "./amendments-panel";
import { FundPanels } from "./fund-panels";
import { RequirementPanels } from "./requirement-panels";
import { FundBar, head } from "./fund-bar";
import { ApprovalSection } from "./approval-section";
import { Icon } from "@/components/ui/icon";
import styles from "./summary.module.css";

type Format = FormatSettings & { currency?: string };
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
  // The listing card's link opens a fund (MR 15893 openFundId); the server refuses a fund not on the application.
  const query = useSearchParams().get("fund") ?? "";
  const [fund, setFund] = useState(/^\d+$/.test(query) ? query : ""),
    [period, setPeriod] = useState("CURRENT"),
    [tab, setTab] = useState<ActivityView>("fund-summary"),
    // The activity in the side panel: viewed, or edited (an empty activity is a new one).
    [opened, setOpened] = useState<{
      activity: string;
      version: string;
      editing: boolean;
      /** Add Activity from the Amendments tab. */
      amendment?: AmendmentChoice;
    } | null>(null),
    // The amendment chosen on the Amendments tab (a new one has an empty key until minted).
    [amendment, setAmendment] = useState<AmendmentChoice | null>(null),
    // Bumped after a save so the list behind the panel reads again.
    [revision, setRevision] = useState(0);
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
  return (
    <div id={ID} className={styles.tab}>
      {/* MR 15893 fund bar: the fund and period with the category counts on one row, the fund's figures under them. */}
      <FundBar
        id={ID}
        bar={view}
        empty={view.empty}
        format={format}
        money={money}
        filters={
          <>
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
                  // Legacy activityFIlterChanged: a fund change closes the open activity.
                  setFund(next);
                  setOpened(null);
                  setAmendment(null);
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
          </>
        }
        actions={
          // Legacy: the fund's Add Activity sits on the bar, shown on the Activities List.
          view.add &&
          tab === "activities-list" && (
            <button
              type="button"
              id={`${ID}-add`}
              className="gn-btn gn-btn--outlined"
              onClick={() =>
                setOpened({ activity: "", version: "", editing: true })
              }
            >
              <Icon name="plus" size={14} />
              {view.add}
            </button>
          )
        }
      />
      <section id={`${ID}-panel`} className={styles.panel}>
        <TabBar
          align="start"
          id={`${ID}-tabs`}
          label="Activities"
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
          ) : tab === "fund-summary" ? (
            <>
              <FundPanels
                appId={appId}
                format={format}
                money={money}
                headings={{
                  roster: view.texts.roster,
                  equipment: view.texts.equipment,
                }}
              />
              <FundSummary
                appId={appId}
                fund={view.fund}
                period={period}
                view={view}
                money={money}
              />
              <RequirementPanels
                key={view.fund}
                appId={appId}
                fund={view.fund}
              />
            </>
          ) : tab === "amendments" ? (
            <AmendmentsPanel
              key={revision}
              appId={appId}
              fund={view.fund}
              format={format}
              money={money}
              chosen={amendment}
              onChoose={setAmendment}
              onView={(activity, version) =>
                setOpened({
                  activity,
                  version,
                  editing: false,
                  amendment: amendment ?? undefined,
                })
              }
              onAdd={(c) =>
                setOpened({
                  activity: "",
                  version: "",
                  editing: true,
                  amendment: c,
                })
              }
              onChanged={read.retry}
            />
          ) : (
            <>
              <ActivityList
                key={revision}
                appId={appId}
                fund={view.fund}
                view={view}
                money={money}
                onChanged={read.retry}
                onView={(r) =>
                  setOpened({
                    activity: r.key,
                    version: r.version,
                    editing: false,
                  })
                }
              />
              {/* Legacy shows the fund's approval route below the list. */}
              <ApprovalSection
                key={`approval-${view.fund}-${revision}`}
                id={`${ID}-approval`}
                appId={appId}
                doc={`fund-${view.fund}`}
                hint={view.submitHint}
                onChanged={() => {
                  read.retry();
                  setRevision((r) => r + 1);
                }}
              />
            </>
          )}
        </div>
      </section>
      {/* MR 15893 record drawer: the activity opens beside the list, which keeps its place; closing returns to it. */}
      {opened && view.fund !== "" && (
        <ActionDialog
          id={`${ID}-activity`}
          title={view.texts.details}
          side
          onClose={() => setOpened(null)}
        >
          {opened.editing ? (
            <ActivityEditor
              key={`edit-${opened.activity}-${opened.version}`}
              appId={appId}
              fund={view.fund}
              activity={opened.activity}
              version={opened.version}
              amendment={opened.amendment}
              money={money}
              onSaved={(activity, version, minted) => {
                setRevision((r) => r + 1);
                read.retry();
                if (opened.amendment) {
                  // Legacy navigateBackToAmendment: back to the amendment, now minted, with its lines.
                  setAmendment({
                    key: minted || opened.amendment.key,
                    reason: opened.amendment.reason,
                  });
                  setOpened(null);
                  return;
                }
                // Legacy saveActivity: the saved version opens in view; the summary and list read again.
                setOpened({ activity, version, editing: false });
              }}
              onCancel={() =>
                setOpened(
                  opened.activity ? { ...opened, editing: false } : null,
                )
              }
            />
          ) : (
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
              onEdit={() => setOpened({ ...opened, editing: true })}
            />
          )}
        </ActionDialog>
      )}
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
  ): {
    id: string;
    header: React.ReactNode;
    cell: (r: Row) => React.ReactNode;
  } => ({
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
          {
            ...text("status"),
            cell: (r: Row) => {
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
