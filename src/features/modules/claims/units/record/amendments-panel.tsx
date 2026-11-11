"use client";
import { useState } from "react";
import { ActionDialog, useConfirm } from "@/components/dialog/action-dialog";
import { useActionFailure } from "@/components/dialog/action-failure";
import { State } from "@/components/feedback/state";
import { TableSkeleton } from "@/components/feedback/skeleton";
import { useToast } from "@/components/feedback/toast";
import { DataTable } from "@/components/ui/data-table";
import { Icon } from "@/components/ui/icon";
import { InsideField } from "@/components/ui/inside-field";
import { Select } from "@/components/ui/select";
import { StatusBadge } from "@/components/ui/status-badge";
import { claims, useApi } from "@/lib/api";
import type { FormatSettings } from "@/lib/format";
import { functions } from "@/lib/functions";
import { useInFlight } from "@/lib/hooks/use-in-flight";
import { claimStatusTone } from "@/shared/claims/status";
import type {
  UnitAmendmentLine,
  UnitAmendmentRow,
  UnitAmendmentsView,
} from "../listing/types";
import { ApprovalSection } from "./approval-section";
import styles from "./summary.module.css";

type Money = (v: number | null) => string;
const ID = "claims-unit-amendments";
/** The amendment being worked on: a saved one, or a new one (empty key) not minted yet. */
export type AmendmentChoice = { key: string; reason: string };

/**
 * The Activities tab's Amendments (legacy claims-unit-activities › amendments): the fund's amendments, the chosen
 * one's reason and lines, Include Activity and Add Activity (the side-panel form in amendment mode), Save and the
 * deletes, and the chosen amendment's approval route (Submit for Approval, Withdraw).
 */
export function AmendmentsPanel({
  appId,
  fund,
  format,
  money,
  chosen,
  onChoose,
  onView,
  onAdd,
  onChanged,
}: {
  appId: string;
  fund: string;
  format?: FormatSettings;
  money: Money;
  chosen: AmendmentChoice | null;
  onChoose: (c: AmendmentChoice | null) => void;
  onView: (activity: string, version: string) => void;
  onAdd: (c: AmendmentChoice) => void;
  /** The fund's summary (unapplied balance, counts) reads again after a change. */
  onChanged: () => void;
}) {
  const [status, setStatus] = useState(""),
    [bump, setBump] = useState(0),
    [including, setIncluding] = useState(false);
  const read = useApi(claims.amendments, { appId, fund, status });
  const toast = useToast(),
    fail = useActionFailure(),
    { run, isActive } = useInFlight(),
    confirm = useConfirm(`${ID}-confirm`);
  const view = read.data;
  if (read.error)
    return (
      <State
        id={`${ID}-error`}
        title="Couldn't load the amendments"
        message={read.error.message}
        retry={read.retry}
      />
    );
  if (!view) return <TableSkeleton label="Loading the amendments" />;
  const x = view.texts,
    h = view.headers;
  const row = chosen?.key
    ? view.rows.find((r) => r.key === chosen.key)
    : undefined;
  // A new amendment is open; a saved one by its status (and the right).
  const editable = chosen
    ? chosen.key === ""
      ? view.canCreate
      : row?.editable === true
    : false;
  const refresh = () => {
    read.retry();
    setBump((b) => b + 1);
    onChanged();
  };
  const busy = isActive("amendment");
  const save = () =>
    void run(async () => {
      if (!chosen?.key) return;
      const result = await claims.saveAmendment(appId, {
        fund,
        amendment: chosen.key,
        reason: chosen.reason,
      });
      if (!result.ok) return fail(result.error);
      toast.show("success", "Amendment saved.");
      refresh();
    }, "amendment");
  const remove = (r: UnitAmendmentRow) =>
    void run(async () => {
      const ok = await confirm.ask({
        title: x.deleteTitle,
        message: x.deleteText,
        confirm: x.yes,
        cancel: x.no,
        danger: true,
      });
      if (!ok) return;
      const result = await claims.deleteAmendment(appId, {
        fund,
        amendment: r.key,
      });
      if (!result.ok) return fail(result.error);
      if (chosen?.key === r.key) onChoose(null);
      refresh();
    }, `delete-${r.key}`);
  const status_ = (text: string) => {
    const tone = claimStatusTone(text);
    return tone ? (
      <StatusBadge dot tone={tone}>
        {text}
      </StatusBadge>
    ) : (
      text
    );
  };
  return (
    <div id={ID}>
      <div className={styles.editorBar}>
        <InsideField htmlFor={`${ID}-status-trigger`} label={x.status} filled>
          <Select
            id={`${ID}-status`}
            label={x.status}
            options={view.statuses}
            value={status}
            onChange={setStatus}
          />
        </InsideField>
        {view.canCreate && (
          <button
            type="button"
            id={`${ID}-new`}
            className="gn-btn gn-btn--outlined"
            onClick={() => onChoose({ key: "", reason: "" })}
          >
            <Icon name="plus" size={14} />
            {x.create}
          </button>
        )}
      </div>
      <DataTable
        id={`${ID}-table`}
        rowIds={`${ID}-row`}
        label={x.create}
        rows={view.rows}
        rowKey={(r) => r.key}
        empty={x.empty}
        columns={[
          {
            id: "number",
            header: h["amendment-number"],
            rowHeader: true,
            cell: (r) => r.number,
          },
          {
            id: "date",
            header: h["amendment-date"],
            cell: (r) => functions.format.dateDisplay(r.date, format),
          },
          {
            id: "status",
            header: h["amendment-status"],
            cell: (r) => status_(r.status),
          },
          {
            id: "reason",
            header: h["amendment-reason"],
            cell: (r) => r.reason,
          },
          {
            id: "cost",
            header: h["amendment-cost-difference"],
            cell: (r) => money(r.cost),
          },
          {
            id: "lines",
            header: h["amendment-lines-number"],
            cell: (r) => r.lines,
          },
        ]}
        actions={[
          {
            id: "view",
            icon: "view",
            label: (r) => `${x.view} ${r.number}`,
            onClick: (r) => onChoose({ key: r.key, reason: r.reasonCode }),
          },
          {
            id: "delete",
            icon: "trash",
            label: (r) => `${x.delete} ${r.number}`,
            hidden: (r) => !r.deletable,
            disabled: (r) => isActive(`delete-${r.key}`),
            onClick: remove,
          },
        ]}
      />
      {chosen && (
        <section
          id={`${ID}-chosen`}
          className={styles.panelSection}
          aria-label={row ? `${x.create} ${row.number}` : x.create}
        >
          {editable && (
            <div className={styles.editorBar}>
              <div className={styles.amendmentField}>
                <div className={styles.amendmentField}>
                  <InsideField
                    htmlFor={`${ID}-reason-trigger`}
                    label={x.reason}
                    filled={chosen.reason !== ""}
                    required
                  >
                    <Select
                      id={`${ID}-reason`}
                      label={x.reason}
                      options={view.reasons}
                      value={chosen.reason}
                      disabled={busy}
                      onChange={(reason) => onChoose({ ...chosen, reason })}
                    />
                  </InsideField>
                </div>
              </div>
              <div className={styles.fundBarActions}>
                {/* Legacy: Include and Add need a reason first. */}
                <button
                  type="button"
                  id={`${ID}-include`}
                  className="gn-btn gn-btn--outlined"
                  disabled={busy || chosen.reason === ""}
                  onClick={() => setIncluding(true)}
                >
                  {x.include}
                </button>
                <button
                  type="button"
                  id={`${ID}-add`}
                  className="gn-btn gn-btn--outlined"
                  disabled={busy || chosen.reason === ""}
                  onClick={() => onAdd(chosen)}
                >
                  <Icon name="plus" size={14} />
                  {x.add}
                </button>
                {chosen.key !== "" && (
                  <button
                    type="button"
                    id={`${ID}-save`}
                    className="gn-btn gn-btn--primary"
                    disabled={busy || chosen.reason === ""}
                    onClick={save}
                  >
                    {x.save}
                  </button>
                )}
              </div>
            </div>
          )}
          {chosen.key !== "" && (
            <AmendmentLines
              key={`${chosen.key}-${bump}`}
              appId={appId}
              fund={fund}
              amendment={chosen.key}
              money={money}
              texts={x}
              onView={onView}
              onChanged={refresh}
            />
          )}
          {chosen.key !== "" && (
            <ApprovalSection
              key={`approval-${chosen.key}-${bump}`}
              id={`${ID}-approval`}
              appId={appId}
              doc={`amendment-${fund}-${chosen.key}`}
              onChanged={refresh}
            />
          )}
        </section>
      )}
      {including && chosen && (
        <IncludeDialog
          appId={appId}
          fund={fund}
          chosen={chosen}
          money={money}
          view={view}
          onClose={() => setIncluding(false)}
          onIncluded={(amendment) => {
            setIncluding(false);
            // The first include mints the amendment; it is the chosen one from here (legacy left it half-loaded).
            onChoose({ key: amendment, reason: chosen.reason });
            refresh();
          }}
        />
      )}
      {confirm.element}
    </div>
  );
}

function AmendmentLines({
  appId,
  fund,
  amendment,
  money,
  texts,
  onView,
  onChanged,
}: {
  appId: string;
  fund: string;
  amendment: string;
  money: Money;
  texts: UnitAmendmentsView["texts"];
  onView: (activity: string, version: string) => void;
  onChanged: () => void;
}) {
  const read = useApi(claims.amendmentLines, { appId, fund, amendment });
  const fail = useActionFailure(),
    { run, isActive } = useInFlight();
  const data = read.data;
  if (read.error)
    return (
      <State
        id={`${ID}-lines-error`}
        title="Couldn't load the amendment lines"
        message={read.error.message}
        retry={read.retry}
      />
    );
  if (!data) return <TableSkeleton label="Loading the amendment lines" />;
  const h = data.headers;
  const moneyCol = (
    id: string,
    k: keyof UnitAmendmentLine,
    header: string,
  ) => ({
    id,
    header: h[header],
    cell: (r: UnitAmendmentLine) => money(r[k] as number | null),
  });
  const remove = (r: UnitAmendmentLine) =>
    void run(async () => {
      const result = await claims.deleteAmendment(appId, {
        fund,
        amendment,
        version: r.version,
      });
      if (!result.ok) return fail(result.error);
      // Legacy reloaded only the lines; the list's line count and cost and the summary follow too.
      read.retry();
      onChanged();
    }, `delete-${r.key}`);
  return (
    <DataTable
      id={`${ID}-lines`}
      rowIds={`${ID}-line`}
      label={h["acivity-number"]}
      rows={data.rows}
      rowKey={(r) => r.key}
      empty={texts.empty}
      columns={[
        {
          id: "number",
          header: h["acivity-number"],
          rowHeader: true,
          cell: (r) => r.number,
        },
        { id: "function", header: h["function-code"], cell: (r) => r.func },
        { id: "object", header: h["object-code"], cell: (r) => r.object },
        { id: "type", header: h["activity-type"], cell: (r) => r.type },
        moneyCol("current-salary", "currentSalary", "current-salary"),
        moneyCol("current-benefit", "currentBenefits", "current-benefit"),
        moneyCol(
          "current-purchase",
          "currentPurchase",
          "current-purchase-service",
        ),
        moneyCol(
          "current-non-position",
          "currentAmount",
          "current-non-position",
        ),
        moneyCol("amended-salary", "amendSalary", "amended-salary"),
        moneyCol("amended-benefit", "amendBenefits", "amended-benefit"),
        moneyCol(
          "amended-purchase",
          "amendPurchase",
          "amended-purchase-service",
        ),
        moneyCol("amended-non-position", "amendAmount", "amended-non-position"),
        moneyCol("cost", "cost", "cost-difference"),
        {
          id: "justification",
          header: h.justification,
          cell: (r) => r.justification,
        },
        {
          id: "itemization",
          header: h["updated-itemization"],
          cell: (r) => r.itemization,
        },
        { id: "job-title", header: h["job-title"], cell: (r) => r.jobTitle },
      ]}
      actions={[
        {
          id: "view",
          icon: "view",
          label: (r) => `${texts.view} ${r.number}`,
          onClick: (r) => onView(r.activity, r.version),
        },
        {
          id: "delete",
          icon: "trash",
          label: (r) => `${texts.delete} ${r.number}`,
          hidden: () => !data.deletable,
          disabled: (r) => isActive(`delete-${r.key}`),
          onClick: remove,
        },
      ]}
    />
  );
}

/** Include Activity (legacy includeActivityDialog): tick the fund's activities to bring into the amendment. */
function IncludeDialog({
  appId,
  fund,
  chosen,
  money,
  view,
  onClose,
  onIncluded,
}: {
  appId: string;
  fund: string;
  chosen: AmendmentChoice;
  money: Money;
  view: UnitAmendmentsView;
  onClose: () => void;
  onIncluded: (amendment: string) => void;
}) {
  const read = useApi(claims.includeCandidates, {
    appId,
    fund,
    amendment: chosen.key,
  });
  const [picked, setPicked] = useState<string[]>([]);
  const fail = useActionFailure(),
    toast = useToast(),
    { run, isActive } = useInFlight();
  const busy = isActive("include");
  const data = read.data;
  const include = () =>
    void run(async () => {
      if (!data) return;
      if (picked.length === 0)
        return toast.show("info", "Please select at least one activity..");
      const result = await claims.includeActivities(appId, {
        fund,
        ...(chosen.key ? { amendment: chosen.key } : {}),
        reason: chosen.reason,
        activities: data.rows
          .filter((r) => picked.includes(r.key))
          .map((r) => ({ activity: r.activity, version: r.version })),
      });
      if (!result.ok) return fail(result.error);
      onIncluded(result.data.amendment);
    }, "include");
  const id = `${ID}-include-dialog`;
  return (
    <ActionDialog
      id={id}
      title={data?.texts.title ?? view.texts.include}
      width="75vw" /* legacy includeActivityDialog: 75vw */
      busy={busy}
      onClose={onClose}
    >
      {read.error ? (
        <State
          id={`${id}-error`}
          title="Couldn't load the activities"
          message={read.error.message}
          retry={read.retry}
        />
      ) : !data ? (
        <TableSkeleton label="Loading the activities" />
      ) : (
        <>
          <DataTable
            id={`${id}-table`}
            rowIds={`${id}-row`}
            label={data.texts.title}
            rows={data.rows}
            rowKey={(r) => r.key}
            empty={view.texts.empty}
            columns={[
              {
                id: "pick",
                header: data.texts.select,
                cell: (r) => (
                  <input
                    id={`${id}-pick-${r.key}`}
                    type="checkbox"
                    aria-label={`${data.texts.select} ${r.number}`}
                    checked={picked.includes(r.key)}
                    disabled={busy}
                    onChange={(e) =>
                      setPicked((p) =>
                        e.target.checked
                          ? [...p, r.key]
                          : p.filter((k) => k !== r.key),
                      )
                    }
                  />
                ),
              },
              {
                id: "number",
                header: data.headers.number,
                rowHeader: true,
                cell: (r) => r.number,
              },
              {
                id: "function",
                header: data.headers["function-code"],
                cell: (r) => r.func,
              },
              {
                id: "object",
                header: data.headers["object-code"],
                cell: (r) => r.object,
              },
              {
                id: "type",
                header: data.headers["activity-type"],
                cell: (r) => r.type,
              },
              {
                id: "salary",
                header: data.headers["salary-amount"],
                cell: (r) => money(r.salary),
              },
              {
                id: "benefits",
                header: data.headers["benefit-amount"],
                cell: (r) => money(r.benefits),
              },
              {
                id: "purchase",
                header: data.headers["purchase-service-amount"],
                cell: (r) => money(r.purchase),
              },
              {
                id: "non-position",
                header: data.headers["non-position-cost"],
                cell: (r) => money(r.nonPosition),
              },
              {
                id: "job-title",
                header: data.headers["job-title"],
                cell: (r) => r.jobTitle,
              },
              {
                id: "itemization",
                header: data.headers.itemization,
                cell: (r) => r.itemization,
              },
            ]}
          />
          <div className={styles.editorFoot}>
            <button
              type="button"
              id={`${id}-submit`}
              className="gn-btn gn-btn--primary"
              disabled={busy}
              onClick={include}
            >
              {data.texts.include}
            </button>
          </div>
        </>
      )}
    </ActionDialog>
  );
}
