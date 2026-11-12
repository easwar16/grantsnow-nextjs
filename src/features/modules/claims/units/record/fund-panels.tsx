"use client";
import { useState } from "react";
import { ActionDialog, useConfirm } from "@/components/dialog/action-dialog";
import { useActionFailure } from "@/components/dialog/action-failure";
import { State } from "@/components/feedback/state";
import { TableSkeleton } from "@/components/feedback/skeleton";
import { Collapsible } from "@/components/ui/collapsible";
import { DataTable } from "@/components/ui/data-table";
import { DateInput } from "@/components/ui/date-input";
import { Icon } from "@/components/ui/icon";
import { InsideField } from "@/components/ui/inside-field";
import { MultiSelect } from "@/components/ui/multi-select";
import { Select } from "@/components/ui/select";
import { StatusBadge } from "@/components/ui/status-badge";
import { claims, useApi } from "@/lib/api";
import type { FormatSettings } from "@/lib/format";
import { functions } from "@/lib/functions";
import { useInFlight } from "@/lib/hooks/use-in-flight";
import { claimStatusTone } from "@/shared/claims/status";
import type {
  UnitEquipmentRow,
  UnitEquipmentView,
  UnitRosterRow,
  UnitRosterView,
} from "../listing/types";
import { ApprovalSection } from "./approval-section";
import styles from "./summary.module.css";

type Money = (v: number | null) => string;
const ID = "claims-unit-fund-panels";

/**
 * The Fund Summary's Roster and Furniture & Equipment (legacy rosterSection / furnitureEquipmentSection): collapsed
 * panels, each read when it opens; both are the application's, whatever fund is chosen.
 */
export function FundPanels({
  appId,
  format,
  money,
  headings,
}: {
  appId: string;
  format?: FormatSettings;
  money: Money;
  headings: { roster: string; equipment: string };
}) {
  return (
    <div id={ID} className={styles.panelSection}>
      <Collapsible
        id={`${ID}-roster`}
        heading={headings.roster}
        defaultOpen={false}
        headClassName={styles.subheading}
      >
        <RosterPanel appId={appId} />
      </Collapsible>
      <Collapsible
        id={`${ID}-equipment`}
        heading={headings.equipment}
        defaultOpen={false}
        headClassName={styles.subheading}
      >
        <EquipmentPanel appId={appId} format={format} money={money} />
      </Collapsible>
    </div>
  );
}

function EquipmentPanel({
  appId,
  format,
  money,
}: {
  appId: string;
  format?: FormatSettings;
  money: Money;
}) {
  const read = useApi(claims.equipment, { appId });
  const [editing, setEditing] = useState<UnitEquipmentRow | "new" | null>(null);
  const fail = useActionFailure(),
    { run, isActive } = useInFlight();
  const view = read.data;
  if (read.error)
    return (
      <State
        id={`${ID}-equipment-error`}
        title="Couldn't load the equipment"
        message={read.error.message}
        retry={read.retry}
      />
    );
  if (!view) return <TableSkeleton label="Loading the equipment" />;
  const h = view.headers,
    x = view.texts;
  // Legacy deleteEquipment asks nothing first.
  const remove = (r: UnitEquipmentRow) =>
    void run(async () => {
      const result = await claims.deleteEquipment(appId, r.key);
      if (!result.ok) return fail(result.error);
      read.retry();
    }, `delete-${r.key}`);
  return (
    <>
      {view.canEdit && (
        <div className={styles.editorBar}>
          <span />
          <button
            type="button"
            id={`${ID}-equipment-add`}
            className="gn-btn gn-btn--outlined"
            onClick={() => setEditing("new")}
          >
            <Icon name="plus" size={14} />
            {x.add}
          </button>
        </div>
      )}
      <DataTable
        id={`${ID}-equipment-table`}
        rowIds={`${ID}-equipment-row`}
        label={x.heading}
        rows={view.rows}
        rowKey={(r) => r.key}
        empty={x.empty}
        columns={[
          {
            id: "description",
            header: h["item-description"],
            rowHeader: true,
            cell: (r) => r.description,
            footer: x.total,
          },
          {
            id: "date",
            header: h["purchase-date"],
            cell: (r) => functions.format.dateDisplay(r.date, format),
          },
          {
            id: "price",
            header: h["purchase-price"],
            cell: (r) => money(r.price),
            footer: money(view.total),
          },
          { id: "serial", header: h["serial-number"], cell: (r) => r.serial },
          {
            id: "location",
            header: h["eqp-location"],
            cell: (r) => r.location,
          },
          {
            id: "condition",
            header: h["eqp-condition"],
            cell: (r) => r.condition,
          },
          {
            id: "funds",
            header: h["funding-sources"],
            // Legacy getFundingSources: the fund names joined.
            cell: (r) => r.fundNames.join(", "),
          },
        ]}
        actions={
          view.canEdit
            ? [
                {
                  id: "edit",
                  icon: "edit",
                  label: (r) => `${x.edit} ${r.description}`,
                  onClick: (r) => setEditing(r),
                },
                {
                  id: "delete",
                  icon: "trash",
                  label: (r) => `${x.delete} ${r.description}`,
                  disabled: (r) => isActive(`delete-${r.key}`),
                  onClick: remove,
                },
              ]
            : []
        }
      />
      {editing && (
        <EquipmentDialog
          appId={appId}
          view={view}
          row={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            read.retry();
          }}
        />
      )}
    </>
  );
}

function EquipmentDialog({
  appId,
  view,
  row,
  onClose,
  onSaved,
}: {
  appId: string;
  view: UnitEquipmentView;
  row: UnitEquipmentRow | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [d, setD] = useState({
    description: row?.description ?? "",
    date: row?.date ?? "",
    price:
      row?.price === null || row?.price === undefined ? "" : String(row.price),
    serial: row?.serial ?? "",
    location: row?.location ?? "",
    condition: row?.condition ?? "",
    comments: row?.comments ?? "",
    funds: row?.funds ?? [],
  });
  const fail = useActionFailure(),
    { run, isActive } = useInFlight();
  const busy = isActive("save");
  const id = `${ID}-equipment-dialog`;
  const l = view.labels;
  const save = () =>
    void run(async () => {
      const result = await claims.saveEquipment(appId, {
        ...(row ? { equipment: row.key } : {}),
        ...d,
      });
      if (!result.ok) return fail(result.error);
      onSaved();
    }, "save");
  const text = (
    k: "description" | "serial" | "location" | "condition" | "comments",
    rb: string,
    required = true,
  ) => (
    <InsideField
      htmlFor={`${id}-${k}`}
      label={l[rb]}
      filled={d[k] !== ""}
      required={required}
    >
      <input
        id={`${id}-${k}`}
        value={d[k]}
        disabled={busy}
        onChange={(e) => setD((s) => ({ ...s, [k]: e.target.value }))}
      />
    </InsideField>
  );
  return (
    <ActionDialog
      id={id}
      title={view.texts.title}
      width="50vw" /* legacy equipmentDetailsDialog: 50vw */
      busy={busy}
      onClose={onClose}
    >
      <div className={styles.editorGrid}>
        {text("description", "equipment-description")}
        <InsideField
          htmlFor={`${id}-date`}
          label={l["equipment-purchase-date"]}
          filled={d.date !== ""}
          required
        >
          <DateInput
            id={`${id}-date`}
            value={d.date}
            disabled={busy}
            onChange={(date) => setD((s) => ({ ...s, date }))}
          />
        </InsideField>
        <InsideField
          htmlFor={`${id}-price`}
          label={l["equipment-purchase-price"]}
          filled={d.price !== ""}
          required
        >
          <input
            id={`${id}-price`}
            type="number"
            min={0}
            step="any"
            value={d.price}
            disabled={busy}
            onChange={(e) => setD((s) => ({ ...s, price: e.target.value }))}
          />
        </InsideField>
        {text("serial", "equipment-serial-number")}
        {text("location", "equipment-location")}
        {text("condition", "equipment-condition")}
        <MultiSelect
          id={`${id}-funds`}
          label={l["equipment-funding-sources"]}
          options={view.funds}
          value={d.funds}
          disabled={busy}
          onChange={(funds) => setD((s) => ({ ...s, funds }))}
        />
        {text("comments", "equipment-comments", false)}
      </div>
      <div className={styles.editorFoot}>
        <button
          type="button"
          id={`${id}-submit`}
          className="gn-btn gn-btn--primary"
          disabled={busy}
          onClick={save}
        >
          {view.texts.submit}
        </button>
      </div>
    </ActionDialog>
  );
}

function RosterPanel({ appId }: { appId: string }) {
  const read = useApi(claims.roster, { appId });
  const [editing, setEditing] = useState<UnitRosterRow | "new" | null>(null),
    // The member whose approval route is open (legacy roster menu › Approvals).
    [approvals, setApprovals] = useState<UnitRosterRow | null>(null);
  const fail = useActionFailure(),
    { run, isActive } = useInFlight(),
    confirm = useConfirm(`${ID}-roster-confirm`);
  const view = read.data;
  if (read.error)
    return (
      <State
        id={`${ID}-roster-error`}
        title="Couldn't load the roster"
        message={read.error.message}
        retry={read.retry}
      />
    );
  if (!view) return <TableSkeleton label="Loading the roster" />;
  const h = view.headers,
    x = view.texts;
  const yesNo = (b: boolean) => (b ? x.yes : x.no);
  const remove = (r: UnitRosterRow) =>
    void run(async () => {
      const ok = await confirm.ask({
        title: x.deleteTitle,
        message: x.deleteText,
        confirm: x.yes,
        cancel: x.no,
        danger: true,
      });
      if (!ok) return;
      const result = await claims.deleteRoster(appId, r.key);
      if (!result.ok) return fail(result.error);
      read.retry();
    }, `delete-${r.key}`);
  return (
    <>
      {view.canAdd && (
        <div className={styles.editorBar}>
          <span />
          <button
            type="button"
            id={`${ID}-roster-add`}
            className="gn-btn gn-btn--outlined"
            onClick={() => setEditing("new")}
          >
            <Icon name="plus" size={14} />
            {x.add}
          </button>
        </div>
      )}
      <DataTable
        id={`${ID}-roster-table`}
        rowIds={`${ID}-roster-row`}
        label={x.heading}
        rows={view.rows}
        rowKey={(r) => r.key}
        empty={x.empty}
        columns={[
          {
            id: "number",
            header: h["roster-number"],
            rowHeader: true,
            cell: (r) => r.key,
          },
          { id: "first", header: h["first-name"], cell: (r) => r.firstName },
          { id: "last", header: h["last-name"], cell: (r) => r.lastName },
          {
            id: "teacher",
            header: h["certified-teacher"],
            cell: (r) => yesNo(r.teacher),
          },
          {
            id: "parapro",
            header: h["certified-parapro"],
            cell: (r) => yesNo(r.parapro),
          },
          {
            id: "primary-fund",
            header: h["primary-fund-type"],
            cell: (r) => r.primaryFundName,
          },
          {
            id: "primary-title",
            header: h["primary-job-title"],
            cell: (r) => r.primaryTitle,
          },
          {
            id: "primary-file",
            header: h["primary-credential"],
            cell: (r) => r.primaryFile,
          },
          {
            id: "secondary-fund",
            header: h["secondary-fund-type"],
            cell: (r) => r.secondaryFundName,
          },
          {
            id: "secondary-title",
            header: h["secondary-job-title"],
            cell: (r) => r.secondaryTitle,
          },
          {
            id: "secondary-file",
            header: h["secondary-credential"],
            cell: (r) => r.secondaryFile,
          },
          {
            id: "local",
            header: h["local-fund"],
            cell: (r) => yesNo(r.localFund),
          },
          {
            id: "status",
            header: h["roster-status"],
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
        ]}
        actions={[
          {
            id: "edit",
            icon: "edit",
            label: (r) => `${x.edit} ${r.firstName} ${r.lastName}`,
            hidden: (r) => !r.editable,
            onClick: (r) => setEditing(r),
          },
          {
            id: "approvals",
            icon: "workflow",
            label: (r) => `${x.approvals} ${r.firstName} ${r.lastName}`,
            onClick: (r) => setApprovals(r),
          },
          {
            id: "delete",
            icon: "trash",
            label: (r) => `${x.delete} ${r.firstName} ${r.lastName}`,
            hidden: (r) => !r.editable,
            disabled: (r) => isActive(`delete-${r.key}`),
            onClick: remove,
          },
        ]}
      />
      {editing && (
        <RosterDialog
          appId={appId}
          view={view}
          row={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            read.retry();
          }}
        />
      )}
      {approvals && (
        <ActionDialog
          id={`${ID}-roster-approvals`}
          title={x.approvalTitle}
          width="75vw" /* legacy approvalsDialog: 75vw */
          onClose={() => setApprovals(null)}
        >
          <ApprovalSection
            id={`${ID}-roster-approval`}
            appId={appId}
            doc={`roster-${approvals.key}`}
            onChanged={read.retry}
          />
        </ActionDialog>
      )}
      {confirm.element}
    </>
  );
}

function RosterDialog({
  appId,
  view,
  row,
  onClose,
  onSaved,
}: {
  appId: string;
  view: UnitRosterView;
  row: UnitRosterRow | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [d, setD] = useState({
    firstName: row?.firstName ?? "",
    lastName: row?.lastName ?? "",
    primaryFund: row?.primaryFund ?? "",
    primaryTitle: row?.primaryTitle ?? "",
    secondaryFund: row?.secondaryFund ?? "",
    secondaryTitle: row?.secondaryTitle ?? "",
    teacher: row?.teacher ?? false,
    parapro: row?.parapro ?? false,
    localFund: row?.localFund ?? false,
  });
  const fail = useActionFailure(),
    { run, isActive } = useInFlight();
  const busy = isActive("save");
  const id = `${ID}-roster-dialog`;
  const l = view.labels;
  const save = () =>
    void run(async () => {
      const result = await claims.saveRoster(appId, {
        ...(row ? { roster: row.key } : {}),
        ...d,
      });
      if (!result.ok) return fail(result.error);
      onSaved();
    }, "save");
  const name = (k: "firstName" | "lastName", rb: string) => (
    <InsideField
      htmlFor={`${id}-${k}`}
      label={l[rb]}
      filled={d[k] !== ""}
      required
    >
      <input
        id={`${id}-${k}`}
        value={d[k]}
        disabled={busy}
        onChange={(e) => setD((s) => ({ ...s, [k]: e.target.value }))}
      />
    </InsideField>
  );
  const check = (k: "teacher" | "parapro" | "localFund", rb: string) => (
    <label className={styles.editorCheck}>
      <input
        id={`${id}-${k}`}
        type="checkbox"
        checked={d[k]}
        disabled={busy}
        onChange={(e) => setD((s) => ({ ...s, [k]: e.target.checked }))}
      />
      {l[rb]}
    </label>
  );
  return (
    <ActionDialog
      id={id}
      title={view.texts.title}
      width="50vw"
      busy={busy}
      onClose={onClose}
    >
      <div className={styles.editorGrid}>
        {name("firstName", "roster-first-name")}
        {name("lastName", "roster-last-name")}
        <FundTitle
          id={`${id}-primary`}
          appId={appId}
          funds={view.funds}
          fundLabel={l["primary-funder-type"]}
          titleLabel={l["primary-job-title"]}
          fund={d.primaryFund}
          title={d.primaryTitle}
          required
          busy={busy}
          onFund={(primaryFund) =>
            setD((s) => ({ ...s, primaryFund, primaryTitle: "" }))
          }
          onTitle={(primaryTitle) => setD((s) => ({ ...s, primaryTitle }))}
        />
        <FundTitle
          id={`${id}-secondary`}
          appId={appId}
          funds={view.funds}
          fundLabel={l["secondary-funder-type"]}
          titleLabel={l["secondary-job-title"]}
          fund={d.secondaryFund}
          title={d.secondaryTitle}
          busy={busy}
          onFund={(secondaryFund) =>
            setD((s) => ({ ...s, secondaryFund, secondaryTitle: "" }))
          }
          onTitle={(secondaryTitle) => setD((s) => ({ ...s, secondaryTitle }))}
        />
        {check("teacher", "certified-teacher")}
        {check("parapro", "certified-parapro")}
        {check("localFund", "local-fund")}
      </div>
      <div className={styles.editorFoot}>
        <button
          type="button"
          id={`${id}-submit`}
          className="gn-btn gn-btn--primary"
          disabled={busy}
          onClick={save}
        >
          {view.texts.submit}
        </button>
      </div>
    </ActionDialog>
  );
}

/** A fund and its job title (legacy: the titles come from the chosen fund; the title is required with a fund). */
function FundTitle({
  id,
  appId,
  funds,
  fundLabel,
  titleLabel,
  fund,
  title,
  required = false,
  busy,
  onFund,
  onTitle,
}: {
  id: string;
  appId: string;
  funds: { value: string; label: string }[];
  fundLabel: string;
  titleLabel: string;
  fund: string;
  title: string;
  required?: boolean;
  busy: boolean;
  onFund: (v: string) => void;
  onTitle: (v: string) => void;
}) {
  return (
    <>
      <InsideField
        htmlFor={`${id}-fund-trigger`}
        label={fundLabel}
        filled={fund !== ""}
        required={required}
      >
        <Select
          id={`${id}-fund`}
          label={fundLabel}
          options={funds}
          value={fund}
          disabled={busy}
          onChange={onFund}
        />
      </InsideField>
      {fund !== "" && (
        <Titles
          id={id}
          appId={appId}
          fund={fund}
          label={titleLabel}
          value={title}
          busy={busy}
          onChange={onTitle}
        />
      )}
    </>
  );
}
function Titles({
  id,
  appId,
  fund,
  label,
  value,
  busy,
  onChange,
}: {
  id: string;
  appId: string;
  fund: string;
  label: string;
  value: string;
  busy: boolean;
  onChange: (v: string) => void;
}) {
  const read = useApi(claims.rosterTitles, { appId, fund });
  return (
    <InsideField
      htmlFor={`${id}-title-trigger`}
      label={label}
      filled={value !== ""}
      required
    >
      <Select
        id={`${id}-title`}
        label={label}
        options={read.data ?? []}
        value={value}
        disabled={busy}
        onChange={onChange}
      />
    </InsideField>
  );
}
