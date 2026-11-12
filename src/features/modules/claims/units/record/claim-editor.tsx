"use client";
import { useState } from "react";
import { ActionDialog } from "@/components/dialog/action-dialog";
import { useActionFailure } from "@/components/dialog/action-failure";
import { useToast } from "@/components/feedback/toast";
import { DataTable } from "@/components/ui/data-table";
import { DateInput } from "@/components/ui/date-input";
import { Icon } from "@/components/ui/icon";
import { InsideField } from "@/components/ui/inside-field";
import { Select } from "@/components/ui/select";
import { StatusBadge } from "@/components/ui/status-badge";
import { claims } from "@/lib/api";
import type { FormatSettings } from "@/lib/format";
import { functions } from "@/lib/functions";
import { useInFlight } from "@/lib/hooks/use-in-flight";
import { claimPeriodRange } from "@/shared/claims/claim-period";
import { claimStatusTone } from "@/shared/claims/status";
import type {
  ClaimLineDraft,
  UnitClaimEditView,
  UnitClaimView,
} from "../listing/types";
import { head } from "./fund-bar";
import styles from "./summary.module.css";

const ID = "claims-unit-claim-editor";
type Format = FormatSettings & { currency?: string };
type Money = (v: number | null) => string;
const REQUIRED = "Please fill all the required fields!";
/** A blank line (legacy openClaimLineDialog without data). */
const blank = (key: string): ClaimLineDraft => ({
  key,
  lineId: "",
  lineNo: "",
  positionType: "",
  positionTypeLabel: "",
  function: "",
  functionLabel: "",
  object: "",
  objectLabel: "",
  activity: "",
  version: "",
  fte: "",
  expenditure: "",
  category: "",
  categoryLabel: "",
  categoryItem: "",
  roster: "",
  rosterLabel: "",
  company: "",
  amount: "",
  defer: "N",
  start: "",
  end: "",
  transNo: "",
  transDate: "",
  cohort: "",
  status: "",
  statusLabel: "",
  adjust: null,
  comments: "",
  rejected: false,
  editable: true,
});
/** The draft's fields Save Claim sends (the server checks and picks them again). */
const toInput = (d: ClaimLineDraft) => ({
  lineId: d.lineId,
  positionType: d.positionType,
  function: d.function,
  object: d.object,
  activity: d.activity,
  version: d.version,
  expenditure: d.expenditure,
  category: d.category,
  categoryItem: d.categoryItem,
  roster: d.roster,
  company: d.company,
  amount: d.amount,
  defer: d.defer,
  start: d.start,
  end: d.end,
  transNo: d.transNo,
  transDate: d.transDate,
  cohort: d.cohort,
  rejected: d.rejected,
});

/**
 * The claim's period and lines while it is open (legacy claim drawer in create / edit): Add New Claim (the line
 * dialog), Add Rejected Claim, a line's Edit / Delete (kept here until Save Claim, as legacy), and Save Claim.
 * `saved` gives a saved line its Audits / Claimable Amounts / Approvals from the claim's view.
 */
export function ClaimEditor({
  appId,
  fund,
  claim,
  setup,
  saved,
  format,
  money,
  onSaved,
  lineActions,
}: {
  appId: string;
  fund: string;
  claim: string;
  setup: UnitClaimEditView;
  saved?: UnitClaimView;
  format?: Format;
  money: Money;
  onSaved: (claim: string) => void;
  lineActions?: (line: ClaimLineDraft) => {
    id: string;
    icon: "audits" | "money" | "workflow";
    label: string;
    onClick: () => void;
  }[];
}) {
  const [period, setPeriod] = useState(setup.period),
    [lines, setLines] = useState(setup.lines),
    [editing, setEditing] = useState<ClaimLineDraft | null>(null),
    [rejected, setRejected] = useState<ClaimLineDraft[] | null>(null),
    [added, setAdded] = useState(0);
  const toast = useToast(),
    fail = useActionFailure(),
    { run, isActive } = useInFlight();
  const busy = isActive("save");
  const x = setup.texts,
    l = setup.labels;
  const save = () =>
    void run(async () => {
      const result = await claims.saveClaim(appId, {
        fund,
        claim,
        period,
        lines: lines.map(toInput),
      });
      if (!result.ok) return fail(result.error);
      onSaved(result.data.claim);
    }, "save");
  const openRejected = () =>
    void run(async () => {
      const result = await claims.rejectedClaimLines(
        appId,
        fund,
        period,
        claim,
      );
      if (!result.ok) return fail(result.error);
      setRejected(result.data.lines);
    }, "rejected");
  const h = saved?.headers;
  const date = (v: string) => functions.format.dateDisplay(v, format);
  return (
    <div id={ID} className={styles.editor}>
      <div className={styles.editorBar}>
        <InsideField htmlFor={`${ID}-period-trigger`} label={x.period} filled>
          <Select
            id={`${ID}-period`}
            label={x.period}
            options={setup.periods}
            value={period}
            disabled={busy}
            onChange={setPeriod}
          />
        </InsideField>
        <div className={styles.fundBarActions}>
          <button
            type="button"
            id={`${ID}-add-line`}
            className="gn-btn gn-btn--outlined"
            disabled={busy}
            onClick={() => {
              setAdded((n) => n + 1);
              setEditing(blank(`new-${added + 1}`));
            }}
          >
            <Icon name="plus" size={14} />
            {x.addLine}
          </button>
          <button
            type="button"
            id={`${ID}-add-rejected`}
            className="gn-btn gn-btn--outlined"
            disabled={busy || isActive("rejected")}
            onClick={openRejected}
          >
            {x.addRejected}
          </button>
          <button
            type="button"
            id={`${ID}-save`}
            className="gn-btn gn-btn--primary"
            disabled={busy}
            onClick={save}
          >
            {x.save}
          </button>
        </div>
      </div>
      <DataTable
        id={`${ID}-lines`}
        rowIds={`${ID}-line`}
        label={x.lineTitle}
        rows={lines}
        rowKey={(r) => r.key}
        empty={setup.texts.empty}
        columns={[
          {
            id: "type",
            header: h
              ? head(`${ID}-type`, h.positionType)
              : l["claim-position-type"],
            rowHeader: true,
            cell: (r) => r.positionTypeLabel,
          },
          {
            id: "function",
            header: h
              ? head(`${ID}-function`, h.function)
              : l["claim-function"],
            cell: (r) => r.functionLabel,
          },
          {
            id: "object",
            header: h ? head(`${ID}-object`, h.object) : l["claim-object"],
            cell: (r) => r.objectLabel,
          },
          {
            id: "expenditure",
            header: h
              ? head(`${ID}-expenditure`, h.expenditure)
              : l["claim-exp-descr"],
            cell: (r) => r.expenditure,
          },
          {
            id: "category",
            header: h
              ? head(`${ID}-category`, h.category)
              : l["claim-category"],
            cell: (r) => r.categoryLabel,
          },
          {
            id: "person",
            header: h ? head(`${ID}-person`, h.person) : l["claim-person"],
            cell: (r) =>
              r.positionType === "POSITION" ? r.rosterLabel : r.company,
          },
          {
            id: "amount",
            header: h ? head(`${ID}-amount`, h.amount) : l["claim-exp-amount"],
            cell: (r) => money(r.amount === "" ? null : Number(r.amount)),
          },
          {
            id: "status",
            header: h ? head(`${ID}-status`, h.status) : l["claim-status"],
            cell: (r) => {
              const tone = claimStatusTone(r.statusLabel);
              return tone ? (
                <StatusBadge dot tone={tone}>
                  {r.statusLabel}
                </StatusBadge>
              ) : (
                r.statusLabel
              );
            },
          },
          {
            id: "trans-date",
            header: h
              ? head(`${ID}-trans-date`, h.transDate)
              : l["claim-trans-date"],
            cell: (r) => date(r.transDate),
          },
          {
            id: "trans-no",
            header: h
              ? head(`${ID}-trans-no`, h.transNo)
              : l["claim-trans-num"],
            cell: (r) => r.transNo,
          },
        ]}
        actions={[
          ...["audits", "amounts", "approvals"].map((which) => ({
            id: which,
            icon: (which === "audits"
              ? "audits"
              : which === "amounts"
                ? "money"
                : "workflow") as "audits" | "money" | "workflow",
            label: (r: ClaimLineDraft) =>
              lineActions?.(r).find((a) => a.id === which)?.label ?? "",
            hidden: (r: ClaimLineDraft) =>
              !lineActions?.(r).some((a) => a.id === which),
            onClick: (r: ClaimLineDraft) =>
              lineActions?.(r)
                .find((a) => a.id === which)
                ?.onClick(),
          })),
          {
            id: "edit",
            icon: "edit",
            label: (r) => `${x.edit} ${r.expenditure}`,
            hidden: (r) => !r.editable,
            disabled: () => busy,
            onClick: (r) => setEditing(r),
          },
          {
            id: "delete",
            icon: "trash",
            label: (r) => `${x.delete} ${r.expenditure}`,
            hidden: (r) => !r.editable || !setup.canDeleteLines,
            disabled: () => busy,
            // Legacy deleteClaimLine: no confirm; the line goes on Save Claim.
            onClick: (r) => setLines((ls) => ls.filter((s) => s.key !== r.key)),
          },
        ]}
      />
      {editing && (
        <LineDialog
          setup={setup}
          line={editing}
          period={period}
          onClose={() => setEditing(null)}
          onDone={(line) => {
            setLines((ls) =>
              ls.some((s) => s.key === line.key)
                ? ls.map((s) => (s.key === line.key ? line : s))
                : [...ls, line],
            );
            setEditing(null);
          }}
          onInvalid={(message) => toast.show("error", message)}
        />
      )}
      {rejected && (
        <RejectedDialog
          setup={setup}
          lines={rejected}
          money={money}
          onClose={() => setRejected(null)}
          onPick={(picked) => {
            const fresh = picked.filter(
              (p) => !lines.some((s) => s.lineId === p.lineId),
            );
            // Legacy addRejectedClaimLines' literal info toast.
            if (fresh.length === 0) toast.show("info", x.alreadyExist);
            else setLines((ls) => [...ls, ...fresh]);
            setRejected(null);
          }}
        />
      )}
    </div>
  );
}

function LineDialog({
  setup,
  line,
  period,
  onClose,
  onDone,
  onInvalid,
}: {
  setup: UnitClaimEditView;
  line: ClaimLineDraft;
  period: string;
  onClose: () => void;
  onDone: (line: ClaimLineDraft) => void;
  onInvalid: (message: string) => void;
}) {
  const [d, setD] = useState(line);
  const id = `${ID}-line-dialog`;
  const l = setup.labels,
    x = setup.texts;
  const type = setup.hierarchy.find((t) => t.value === d.positionType);
  const fn = type?.functions.find((f) => f.value === d.function);
  const obj = fn?.objects.find((o) => o.value === d.object);
  const job = obj?.jobs.find((j) => j.value === d.activity);
  const position = d.positionType === "POSITION";
  const range = claimPeriodRange(setup.fy, period, setup.startMonth);
  const opts = (list: { value: string; label: string }[] | undefined) =>
    (list ?? []).map((o) => ({ value: o.value, label: o.label }));
  // Legacy selectHierarchyItem: a pick clears every level below it.
  const below = {
    function: { function: "", functionLabel: "" },
    object: { object: "", objectLabel: "" },
    activity: { activity: "", version: "", fte: "", expenditure: "" },
    category: { category: "", categoryLabel: "", categoryItem: "" },
    roster: { roster: "", rosterLabel: "" },
  };
  const select = (
    k: string,
    rb: string,
    options: { value: string; label: string }[],
    value: string,
    onChange: (v: string) => void,
    required = true,
  ) => (
    <InsideField
      htmlFor={`${id}-${k}-trigger`}
      label={l[rb]}
      filled={value !== ""}
      required={required}
    >
      <Select
        id={`${id}-${k}`}
        label={l[rb]}
        options={options}
        value={value}
        onChange={onChange}
      />
    </InsideField>
  );
  const input = (
    k: "expenditure" | "company" | "transNo" | "amount",
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
        type={k === "amount" ? "number" : "text"}
        step={k === "amount" ? "any" : undefined}
        value={d[k]}
        onChange={(e) => setD((s) => ({ ...s, [k]: e.target.value }))}
      />
    </InsideField>
  );
  const dateField = (
    k: "start" | "end" | "transDate",
    rb: string,
    bounds?: { min: string; max: string },
  ) => (
    <InsideField
      htmlFor={`${id}-${k}`}
      label={l[rb]}
      filled={d[k] !== ""}
      required
    >
      <DateInput
        id={`${id}-${k}`}
        value={d[k]}
        min={bounds?.min}
        max={bounds?.max}
        onChange={(v) => setD((s) => ({ ...s, [k]: v }))}
      />
    </InsideField>
  );
  const submit = () => {
    const missing =
      !d.positionType ||
      !d.function ||
      !d.object ||
      (position
        ? !d.activity || !d.roster
        : !d.expenditure.trim() || !d.company.trim()) ||
      !d.transNo.trim() ||
      !d.transDate ||
      (d.category !== "" && (!d.start || !d.end));
    if (missing) return onInvalid(REQUIRED);
    // Legacy's transaction date validator, messages verbatim.
    if (range && d.transDate > range.end)
      return onInvalid(`Transaction Date cannot be later than ${range.end}.`);
    if (range && d.transDate < range.start)
      return onInvalid(
        `Transaction Date cannot be earlier than ${range.start}.`,
      );
    onDone(d);
  };
  return (
    <ActionDialog id={id} title={x.lineTitle} width="75vw" onClose={onClose}>
      <div className={styles.editorGrid}>
        {select(
          "type",
          "claim-position-type",
          opts(setup.hierarchy),
          d.positionType,
          (v) =>
            setD((s) => ({
              ...s,
              positionType: v,
              positionTypeLabel:
                setup.hierarchy.find((t) => t.value === v)?.label ?? "",
              ...below.function,
              ...below.object,
              ...below.activity,
              ...below.category,
              ...below.roster,
            })),
        )}
        {d.positionType !== "" &&
          select(
            "function",
            "claim-function",
            opts(type?.functions),
            d.function,
            (v) =>
              setD((s) => ({
                ...s,
                function: v,
                functionLabel:
                  type?.functions.find((f) => f.value === v)?.label ?? "",
                ...below.object,
                ...below.activity,
                ...below.category,
                ...below.roster,
              })),
          )}
        {d.function !== "" &&
          select("object", "claim-object", opts(fn?.objects), d.object, (v) =>
            setD((s) => ({
              ...s,
              object: v,
              objectLabel: fn?.objects.find((o) => o.value === v)?.label ?? "",
              ...below.activity,
              ...below.category,
              ...below.roster,
            })),
          )}
        {position &&
          d.object !== "" &&
          select(
            "activity",
            "claim-exp-descr",
            opts(obj?.jobs),
            d.activity,
            (v) => {
              const j = obj?.jobs.find((x) => x.value === v);
              setD((s) => ({
                ...s,
                activity: v,
                expenditure: j?.label ?? "",
                version: j?.version ?? "",
                fte: j?.fte ?? "",
                ...below.category,
                ...below.roster,
              }));
            },
          )}
        {!position && input("expenditure", "claim-exp-descr")}
        {position &&
          d.activity !== "" &&
          select(
            "category",
            "claim-category",
            opts(job?.categories),
            d.category,
            (v) => {
              const c = job?.categories.find((x) => x.value === v);
              setD((s) => ({
                ...s,
                category: v,
                categoryLabel: c?.label ?? "",
                categoryItem: c?.item ?? "",
              }));
            },
            false,
          )}
        {position &&
          d.activity !== "" &&
          select("roster", "claim-person", opts(job?.people), d.roster, (v) =>
            setD((s) => ({
              ...s,
              roster: v,
              rosterLabel: job?.people.find((p) => p.value === v)?.label ?? "",
            })),
          )}
        {!position && input("company", "claim-person")}
        {input("amount", "claim-exp-amount", false)}
        <fieldset className={styles.editorRadios}>
          <legend>{l["claim-defer"]}</legend>
          {(["Y", "N"] as const).map((v) => (
            <label key={v}>
              <input
                id={`${id}-defer-${v.toLowerCase()}`}
                type="radio"
                name={`${id}-defer`}
                checked={d.defer === v}
                onChange={() => setD((s) => ({ ...s, defer: v }))}
              />
              {v === "Y" ? x.yes : x.no}
            </label>
          ))}
        </fieldset>
        {d.category !== "" && dateField("start", "claim-start-date")}
        {d.category !== "" && dateField("end", "claim-end-date")}
        {input("transNo", "claim-trans-num")}
        {dateField(
          "transDate",
          "claim-trans-date",
          range ? { min: range.start, max: range.end } : undefined,
        )}
        {select(
          "cohort",
          "claim-cohort",
          setup.cohorts,
          d.cohort,
          (v) => setD((s) => ({ ...s, cohort: v })),
          false,
        )}
      </div>
      <div className={styles.editorFoot}>
        <button
          type="button"
          id={`${id}-submit`}
          className="gn-btn gn-btn--primary"
          onClick={submit}
        >
          {x.submit}
        </button>
      </div>
    </ActionDialog>
  );
}

function RejectedDialog({
  setup,
  lines,
  money,
  onClose,
  onPick,
}: {
  setup: UnitClaimEditView;
  lines: ClaimLineDraft[];
  money: Money;
  onClose: () => void;
  onPick: (lines: ClaimLineDraft[]) => void;
}) {
  const [picked, setPicked] = useState<string[]>([]);
  const id = `${ID}-rejected`;
  const l = setup.labels;
  return (
    <ActionDialog
      id={id}
      title={setup.texts.lineTitle}
      width="75vw"
      onClose={onClose}
    >
      <DataTable
        id={`${id}-table`}
        rowIds={`${id}-row`}
        label={setup.texts.addRejected}
        rows={lines}
        rowKey={(r) => r.key}
        empty={setup.texts.empty}
        columns={[
          {
            id: "pick",
            header: setup.texts.addRejected,
            cell: (r) => (
              <input
                id={`${id}-pick-${r.key}`}
                type="checkbox"
                aria-label={`${setup.texts.addRejected} ${r.expenditure}`}
                checked={picked.includes(r.key)}
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
            id: "type",
            header: l["claim-position-type"],
            cell: (r) => r.positionTypeLabel,
          },
          {
            id: "function",
            header: l["claim-function"],
            cell: (r) => r.functionLabel,
          },
          {
            id: "object",
            header: l["claim-object"],
            cell: (r) => r.objectLabel,
          },
          {
            id: "expenditure",
            header: l["claim-exp-descr"],
            cell: (r) => r.expenditure,
          },
          {
            id: "person",
            header: l["claim-person"],
            cell: (r) =>
              r.positionType === "POSITION" ? r.rosterLabel : r.company,
          },
          {
            id: "amount",
            header: l["claim-exp-amount"],
            cell: (r) => money(r.amount === "" ? null : Number(r.amount)),
          },
          {
            id: "status",
            header: l["claim-status"],
            cell: (r) => r.statusLabel,
          },
        ]}
      />
      <div className={styles.editorFoot}>
        <button
          type="button"
          id={`${id}-submit`}
          className="gn-btn gn-btn--primary"
          onClick={() => onPick(lines.filter((r) => picked.includes(r.key)))}
        >
          {setup.texts.submit}
        </button>
      </div>
    </ActionDialog>
  );
}
