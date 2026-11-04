"use client";
import { useState } from "react";
import { useActionFailure } from "@/components/dialog/action-failure";
import { State } from "@/components/feedback/state";
import { DetailSkeleton, TableSkeleton } from "@/components/feedback/skeleton";
import { DataTable } from "@/components/ui/data-table";
import { HelpButton } from "@/components/ui/help-button";
import { Icon } from "@/components/ui/icon";
import { InsideField } from "@/components/ui/inside-field";
import { ReadonlyField } from "@/components/ui/readonly-field";
import { Select } from "@/components/ui/select";
import { TabBar } from "@/components/ui/tab-bar";
import { claims, useApi } from "@/lib/api";
import type { FormatSettings } from "@/lib/format";
import { functions } from "@/lib/functions";
import { useInFlight } from "@/lib/hooks/use-in-flight";
import type {
  UnitActivity,
  UnitActivitySubTab,
  UnitActivityTable,
  UnitActivityView,
  UnitCostItem,
} from "../types";
import styles from "./summary.module.css";

type Format = FormatSettings & { currency?: string };
type Header = { label: string; help: string | null };
type Money = (v: number | null) => string;
const head = (id: string, h: Header) => (
  <>
    {h.label}
    <HelpButton id={`${id}-help`} html={h.help} />
  </>
);
const ID = "claims-unit-activity";

/**
 * The activity-details tab (legacy activity-details, view mode): the version and its header, the goals, and the
 * sub-tabs the activity opens; the version can be switched and, where legacy allows, made the active one.
 */
export function ActivityDetails({
  appId,
  fund,
  activity,
  version,
  format,
  money,
  onVersion,
  onChanged,
}: {
  appId: string;
  fund: string;
  activity: string;
  version: string;
  format?: Format;
  money: Money;
  onVersion: (version: string) => void;
  onChanged: () => void;
}) {
  const key = { appId, fund, activity, version };
  const read = useApi(claims.activity, key);
  const [tab, setTab] = useState<UnitActivitySubTab>("general-details");
  const fail = useActionFailure(),
    { run, isActive } = useInFlight();
  const view = read.data;
  if (read.error)
    return (
      <State
        id={`${ID}-error`}
        title="Couldn't load the activity"
        message={read.error.message}
        retry={read.retry}
      />
    );
  if (!view) return <DetailSkeleton label="Loading the activity" />;
  const a = view.activity,
    l = view.labels;
  const activate = () =>
    void run(async () => {
      const result = await claims.setActiveVersion(appId, {
        fund,
        activity,
        version,
      });
      if (!result.ok) return fail(result.error);
      read.retry();
      onChanged();
    }, "activate");
  const current = view.tabs.some((t) => t.id === tab) ? tab : "general-details";
  const headerCount = [
    !!a.number,
    !!a.version,
    true,
    !!a.status,
    view.homeless,
  ].filter(Boolean).length;
  return (
    <div id={ID} className={styles.activity}>
      <div className={styles.pair}>
        {/* Legacy's header form runs down its two columns (number, version, fund; then status, homeless). */}
        <div
          className={`${styles.fields} ${styles.down}`}
          style={
            { "--rows": Math.ceil(headerCount / 2) } as React.CSSProperties
          }
        >
          {a.number && (
            <ReadonlyField
              id={`${ID}-number`}
              label={l["activity-number"]}
              value={a.number}
            />
          )}
          {a.version &&
            (view.versions.length > 1 ? (
              <div className={styles.versionRow}>
                <InsideField
                  htmlFor={`${ID}-version-trigger`}
                  label={l["amendment-number"]}
                  filled
                >
                  <Select
                    id={`${ID}-version`}
                    label={l["amendment-number"]}
                    options={view.versions}
                    value={a.version}
                    disabled={isActive("activate")}
                    onChange={onVersion}
                  />
                </InsideField>
                <HelpButton
                  id={`${ID}-version-help`}
                  html={view.helps["amendment-number"]}
                />
                {view.canSetActive && (
                  <button
                    type="button"
                    id={`${ID}-mark-active`}
                    className="gn-btn gn-btn--icon"
                    aria-label={view.texts.markActive}
                    title={view.texts.markActive}
                    disabled={isActive("activate")}
                    onClick={activate}
                  >
                    <Icon name="check" size={16} />
                  </button>
                )}
              </div>
            ) : (
              <ReadonlyField
                id={`${ID}-version`}
                label={l["amendment-number"]}
                value={view.versions[0]?.label ?? ""}
                help={
                  <HelpButton
                    id={`${ID}-version-help`}
                    html={view.helps["amendment-number"]}
                  />
                }
              />
            ))}
          <ReadonlyField
            id={`${ID}-fund`}
            label={l["fund-type"]}
            value={view.fundName}
          />
          {a.status && (
            <ReadonlyField
              id={`${ID}-status`}
              label={l.status}
              value={a.status}
            />
          )}
          {view.homeless && (
            <ReadonlyField
              id={`${ID}-homeless`}
              label={l.homeless}
              value={
                a.homeless === "Y"
                  ? view.texts.yes
                  : a.homeless === "N"
                    ? view.texts.no
                    : ""
              }
            />
          )}
        </div>
        <DataTable
          id={`${ID}-goals`}
          rowIds={`${ID}-goal`}
          label={view.headers["goal-number"].label}
          rows={a.goals}
          rowKey={(g) => g.key}
          empty={view.empty}
          columns={[
            {
              id: "number",
              header: head(`${ID}-goal-number`, view.headers["goal-number"]),
              rowHeader: true,
              cell: (g) => g.number,
            },
            {
              id: "description",
              header: head(
                `${ID}-goal-description`,
                view.headers["goal-description"],
              ),
              cell: (g) => g.description,
            },
          ]}
        />
      </div>
      <TabBar
        align="start"
        id={`${ID}-tabs`}
        label={view.texts.back}
        tabs={view.tabs.map((t) => ({ key: t.id, name: t.label }))}
        selected={current}
        onSelect={setTab}
      />
      <div
        id={`${ID}-tabs-panel-${current}`}
        role="tabpanel"
        aria-labelledby={`${ID}-tabs-tab-${current}`}
      >
        {current === "general-details" ? (
          <General view={view} money={money} />
        ) : current === "position-details" && a.position ? (
          <Position view={view} a={a} money={money} format={format} />
        ) : current === "claimable-amount-details" ? (
          <Claimable query={key} view={view} money={money} />
        ) : (
          <LinesTable
            query={key}
            which={current === "claim-details" ? "claim-details" : "history"}
            view={view}
            money={money}
            format={format}
          />
        )}
      </div>
    </div>
  );
}

/** Legacy general-details (view): the type, codes and amounts, then the texts. */
function General({ view, money }: { view: UnitActivityView; money: Money }) {
  const a = view.activity,
    l = view.labels,
    p = a.position;
  const positioned = a.type.code === "POSITION";
  const lump = p?.fte.code === "2";
  const field = (key: string, value: string, label = l[key]) => (
    <ReadonlyField key={key} id={`${ID}-${key}`} label={label} value={value} />
  );
  return (
    <div className={styles.activityForm}>
      <div className={styles.fields3}>
        {field("activity-type", a.type.name)}
        {a.type.code && field("function-code", a.func.name)}
        {a.type.code &&
          a.func.code &&
          !positioned &&
          field("object-code", a.object.name)}
        {positioned && field("fte", p?.fte.name ?? "")}
        {!positioned &&
          field(
            "amount",
            money(a.amount),
            a.type.code === "TUITION" ? l["benefits-amount"] : l.amount,
          )}
        {/* Legacy: a lump-sum position (FTE 2) edits its own amounts; any other shows the server's totals. */}
        {positioned &&
          (lump || !!a.totals.salary) &&
          field(
            "salary-amount",
            money(lump ? (p?.salaryAmount ?? null) : a.totals.salary),
          )}
        {positioned &&
          (lump || a.totals.benefits !== null) &&
          field(
            "benefits-amount",
            money(lump ? (p?.benefitsAmount ?? null) : a.totals.benefits),
          )}
        {positioned &&
          (lump || a.totals.purchase !== null) &&
          field(
            "purchased-amount",
            money(lump ? (p?.purchaseAmount ?? null) : a.totals.purchase),
          )}
        {positioned && field("job-title", p?.jobTitle ?? "")}
      </div>
      <div className={styles.fields}>
        {positioned && field("job-description", p?.jobDescription ?? "")}
        {field("itemization", a.itemization)}
      </div>
    </div>
  );
}

/** Legacy position-details (view): pay, salary, then the benefit and purchased-service lines with their totals. */
function Position({
  view,
  a,
  money,
  format,
}: {
  view: UnitActivityView;
  a: UnitActivity;
  money: Money;
  format?: Format;
}) {
  const l = view.labels,
    p = a.position!;
  const pct = (v: number | null) =>
    v === null ? "" : functions.format.percentDisplay(v, format);
  const num = (v: number | null) => (v === null ? "" : String(v));
  const field = (key: string, value: string) => (
    <ReadonlyField key={key} id={`${ID}-${key}`} label={l[key]} value={value} />
  );
  const hourly = p.salaryType.code === "HOURLY";
  const section = (
    kind: "BENEFIT" | "PURCHASE_SERVICE",
    heading: string,
    help: string | null,
    fields: [string, string][],
  ) => {
    const lines = p.items.filter((i) => i.type === kind);
    const prefix = kind === "BENEFIT" ? "benefit" : "purchased";
    const h = (k: string) => view.headers[`${prefix}-${k}`];
    const sid = `${ID}-${kind === "BENEFIT" ? "benefits" : "purchases"}`;
    return (
      <section id={sid}>
        <h3 className={styles.subheading}>
          {heading}
          <HelpButton id={`${sid}-help`} html={help} />
        </h3>
        <div className={styles.fields3}>
          {fields.map(([k, v]) => field(k, v))}
        </div>
        <DataTable
          id={`${sid}-table`}
          rowIds={`${sid}-row`}
          label={heading}
          rows={lines}
          rowKey={(r: UnitCostItem) => r.key}
          empty={view.empty}
          columns={[
            {
              id: "category",
              header: head(`${sid}-category`, h("category")),
              rowHeader: true,
              cell: (r) => r.category.name,
              footer: view.texts.total,
            },
            {
              id: "calculation",
              header: head(`${sid}-calculation`, h("calculation")),
              cell: (r) => r.method.name,
            },
            {
              id: "rate",
              header: head(`${sid}-rate`, h("rate")),
              cell: (r) => pct(r.rate),
            },
            {
              id: "amount",
              header: head(`${sid}-amount`, h("amount")),
              cell: (r) => money(r.amount),
              footer: money(lines.reduce((s, r) => s + (r.amount ?? 0), 0)),
            },
          ]}
        />
      </section>
    );
  };
  return (
    <div className={styles.activityForm}>
      <div className={styles.fields3}>
        {field("pay-frequency", p.payFrequency.name)}
        {p.payFrequency.code && field("starting-period", p.start)}
        {p.payFrequency.code && field("ending-period", p.end)}
      </div>
      <section id={`${ID}-salary`}>
        <h3 className={styles.subheading}>
          {view.helps.salaryHeading}
          <HelpButton
            id={`${ID}-salary-help`}
            html={view.helps["salary-information"]}
          />
        </h3>
        <div className={styles.fields3}>
          {field("salary-type", p.salaryType.name)}
          {field("total-salary", money(p.totalSalary))}
          {field("deduct-salary", money(p.deductSalary))}
          {hourly && field("hourly-rate", money(p.hourlyRate))}
          {hourly && field("hours-per-day", num(p.hoursPerDay))}
          {hourly && field("days-per-year", num(p.daysPerYear))}
          {field("salary-percentage", pct(p.salaryPercent))}
        </div>
      </section>
      {section(
        "BENEFIT",
        view.helps.benefitHeading ?? "",
        view.helps["benefit-information"],
        [
          ["total-benefit", money(p.benefitsAmount)],
          ["deduct-benefit", money(p.deductBenefit)],
          ["benefit-percentage", pct(p.benefitPercent)],
        ],
      )}
      {section(
        "PURCHASE_SERVICE",
        view.helps.purchaseHeading ?? "",
        view.helps["purchase-service-information"],
        [
          ["total-purchase-service", money(p.purchaseAmount)],
          ["deduct-service", money(p.deductService)],
          ["service-percentage", pct(p.servicePercent)],
        ],
      )}
    </div>
  );
}

type Query = { appId: string; fund: string; activity: string; version: string };

/** Legacy claimable-amount-details: the server's periods in three tables, each totalled. */
function Claimable({
  query,
  view,
  money,
}: {
  query: Query;
  view: UnitActivityView;
  money: Money;
}) {
  const read = useApi(claims.claimable, query);
  if (read.error)
    return (
      <State
        id={`${ID}-claimable-error`}
        title="Couldn't load the claimable amounts"
        message={read.error.message}
        retry={read.retry}
      />
    );
  if (!read.data) return <TableSkeleton label="Loading claimable amounts" />;
  return (
    <div className={styles.triple}>
      {read.data.tables.map((t) => (
        <section key={t.key} id={`${ID}-claimable-${t.key}`}>
          <h3 className={styles.subheading}>
            {t.heading.label}
            <HelpButton
              id={`${ID}-claimable-${t.key}-help`}
              html={t.heading.help}
            />
          </h3>
          <DataTable
            id={`${ID}-claimable-${t.key}-table`}
            rowIds={`${ID}-claimable-${t.key}-row`}
            label={t.heading.label}
            rows={t.rows}
            rowKey={(r) => r.key}
            empty={view.empty}
            columns={[
              {
                id: "period",
                header: head(
                  `${ID}-claimable-${t.key}-period`,
                  t.headers.period,
                ),
                rowHeader: true,
                cell: (r) => r.period,
                footer: view.texts.total,
              },
              {
                id: "amount",
                header: head(
                  `${ID}-claimable-${t.key}-amount`,
                  t.headers.amount,
                ),
                cell: (r) => money(r.amount),
                footer: money(t.total),
              },
            ]}
          />
        </section>
      ))}
    </div>
  );
}

/** Legacy amendment-history-details and claim-details: a server-shaped table read when the sub-tab opens. */
function LinesTable({
  query,
  which,
  view,
  money,
  format,
}: {
  query: Query;
  which: "history" | "claim-details";
  view: UnitActivityView;
  money: Money;
  format?: Format;
}) {
  const read = useApi(
    which === "history" ? claims.amendmentHistory : claims.claimDetails,
    query,
  );
  const id = `${ID}-${which}`;
  if (read.error)
    return (
      <State
        id={`${id}-error`}
        title="Couldn't load this table"
        message={read.error.message}
        retry={read.retry}
      />
    );
  const data: UnitActivityTable | undefined = read.data;
  if (!data) return <TableSkeleton label="Loading" />;
  return (
    <DataTable
      id={`${id}-table`}
      rowIds={`${id}-row`}
      label={
        view.tabs.find((t) =>
          t.id.startsWith(which === "history" ? "amendment" : "claim"),
        )?.label ?? ""
      }
      rows={data.rows}
      rowKey={(r) => r.key}
      empty={view.empty}
      columns={data.columns.map((c, i) => ({
        id: c.key,
        header: head(`${id}-${c.key}`, c.header),
        rowHeader: i === 0,
        cell: (r: UnitActivityTable["rows"][number]) => {
          const v = r[c.key];
          if (c.money) return money(typeof v === "number" ? v : null);
          if (c.date)
            return functions.format.dateDisplay(String(v ?? ""), format);
          return String(v ?? "");
        },
      }))}
    />
  );
}
