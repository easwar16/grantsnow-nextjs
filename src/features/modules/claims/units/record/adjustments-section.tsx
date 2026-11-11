"use client";
import { useState } from "react";
import { ActionDialog } from "@/components/dialog/action-dialog";
import { useActionFailure } from "@/components/dialog/action-failure";
import { State } from "@/components/feedback/state";
import { TableSkeleton } from "@/components/feedback/skeleton";
import { useToast } from "@/components/feedback/toast";
import { DataTable } from "@/components/ui/data-table";
import { Icon } from "@/components/ui/icon";
import { InsideField } from "@/components/ui/inside-field";
import { ReadonlyField } from "@/components/ui/readonly-field";
import { Select } from "@/components/ui/select";
import { StatusBadge } from "@/components/ui/status-badge";
import { saveBlob } from "@/features/record/dynamic-form/api";
import { useRecordAudit } from "@/features/record/shell/record-frame";
import { claims, useApi } from "@/lib/api";
import type { FormatSettings } from "@/lib/format";
import { functions } from "@/lib/functions";
import { useInFlight } from "@/lib/hooks/use-in-flight";
import { claimStatusTone } from "@/shared/claims/status";
import type { AdjustmentLineDraft, UnitAdjustmentView } from "../listing/types";
import { ApprovalSection } from "./approval-section";
import { head } from "./fund-bar";
import styles from "./summary.module.css";

const ID = "claims-unit-adjustments";
type Format = FormatSettings & { currency?: string };
type Money = (v: number | null) => string;
const tone = (s: string) => {
  const t = claimStatusTone(s);
  return t ? (
    <StatusBadge dot tone={t}>
      {s}
    </StatusBadge>
  ) : (
    s
  );
};

/**
 * An approved or paid claim's Adjustments (legacy claims-adjustments tab, on the claim open in the drawer): the list
 * (View, Audits, Delete), Add Adjustment, and the chosen adjustment's form, lines and route.
 */
export function AdjustmentsSection({
  appId,
  fund,
  claim,
  status,
  format,
  money,
  onChanged,
}: {
  appId: string;
  fund: string;
  claim: string;
  status: string;
  format?: Format;
  money: Money;
  onChanged: () => void;
}) {
  const read = useApi(claims.claimAdjustments, { appId, fund, claim });
  // The adjustment open below the list ("" is a new one).
  const [chosen, setChosen] = useState<string | null>(null),
    [bump, setBump] = useState(0);
  const fail = useActionFailure(),
    { run, isActive } = useInFlight(),
    openAudit = useRecordAudit();
  const view = read.data;
  if (read.error)
    return (
      <State
        id={`${ID}-error`}
        title="Couldn't load the adjustments"
        message={read.error.message}
        retry={read.retry}
      />
    );
  if (!view) return <TableSkeleton label="Loading the adjustments" />;
  const x = view.texts,
    h = view.headers;
  const refresh = () => {
    read.retry();
    setBump((b) => b + 1);
    onChanged();
  };
  // Legacy deleteAdjustment asks nothing first.
  const remove = (key: string) =>
    void run(async () => {
      const result = await claims.deleteAdjustment(appId, fund, claim, key);
      if (!result.ok) return fail(result.error);
      if (chosen === key) setChosen(null);
      refresh();
    }, `delete-${key}`);
  return (
    <section id={ID} className={styles.panelSection}>
      <div className={styles.editorBar}>
        <h3 id={`${ID}-title`} className={styles.subheading}>
          {x.heading}
        </h3>
        {view.canAdd && (
          <button
            type="button"
            id={`${ID}-add`}
            className="gn-btn gn-btn--outlined"
            onClick={() => setChosen("")}
          >
            <Icon name="plus" size={14} />
            {x.add}
          </button>
        )}
      </div>
      <DataTable
        id={`${ID}-table`}
        rowIds={`${ID}-row`}
        label={x.heading}
        rows={view.rows}
        rowKey={(r) => r.key}
        empty={x.empty}
        columns={[
          {
            id: "number",
            header: head(`${ID}-number`, h.number),
            rowHeader: true,
            cell: (r) => r.key,
          },
          {
            id: "status",
            header: head(`${ID}-status`, h.status),
            cell: (r) => tone(r.status),
          },
          {
            id: "date",
            header: head(`${ID}-date`, h.date),
            cell: (r) => functions.format.dateDisplay(r.date, format),
          },
          { id: "by", header: head(`${ID}-by`, h.by), cell: (r) => r.by },
          {
            id: "lines",
            header: head(`${ID}-lines`, h.lines),
            cell: (r) => r.lines,
          },
          {
            id: "comments",
            header: head(`${ID}-comments`, h.comments),
            cell: (r) => r.comments,
          },
        ]}
        actions={[
          {
            id: "view",
            icon: "view",
            label: (r) => `${x.view} ${r.key}`,
            onClick: (r) => setChosen(r.key),
          },
          {
            id: "audits",
            icon: "audits",
            label: (r) => `${x.audits} ${r.key}`,
            onClick: (r) =>
              openAudit({
                page: `claims-unit-claims-adj-${claim}`,
                sec: r.key,
                title: x.audits,
              }),
          },
          {
            id: "delete",
            icon: "trash",
            label: (r) => `${x.delete} ${r.key}`,
            hidden: (r) => !r.canDelete,
            disabled: (r) => isActive(`delete-${r.key}`),
            onClick: (r) => remove(r.key),
          },
        ]}
      />
      {chosen !== null && (
        <Adjustment
          key={`${chosen}-${bump}`}
          appId={appId}
          fund={fund}
          claim={claim}
          adjustment={chosen}
          status={status}
          format={format}
          money={money}
          onSaved={(key) => {
            setChosen(key);
            refresh();
          }}
          onRouted={refresh}
        />
      )}
    </section>
  );
}

function Adjustment({
  appId,
  fund,
  claim,
  adjustment,
  status,
  format,
  money,
  onSaved,
  onRouted,
}: {
  appId: string;
  fund: string;
  claim: string;
  adjustment: string;
  status: string;
  format?: Format;
  money: Money;
  onSaved: (key: string) => void;
  onRouted: () => void;
}) {
  const read = useApi(claims.claimAdjustment, {
    appId,
    fund,
    claim,
    adjustment,
  });
  if (read.error)
    return (
      <State
        id={`${ID}-adjustment-error`}
        title="Couldn't load the adjustment"
        message={read.error.message}
        retry={read.retry}
      />
    );
  if (!read.data) return <TableSkeleton label="Loading the adjustment" />;
  return (
    <AdjustmentForm
      appId={appId}
      fund={fund}
      claim={claim}
      view={read.data}
      status={status}
      format={format}
      money={money}
      onSaved={onSaved}
      onRouted={() => {
        read.retry();
        onRouted();
      }}
    />
  );
}

function AdjustmentForm({
  appId,
  fund,
  claim,
  view,
  status,
  format,
  money,
  onSaved,
  onRouted,
}: {
  appId: string;
  fund: string;
  claim: string;
  view: UnitAdjustmentView;
  status: string;
  format?: Format;
  money: Money;
  onSaved: (key: string) => void;
  onRouted: () => void;
}) {
  const [refundCheck, setRefundCheck] = useState(view.refundCheck),
    [comment, setComment] = useState(view.comment),
    [lines, setLines] = useState(view.lines),
    [editing, setEditing] = useState<AdjustmentLineDraft | null>(null),
    [picking, setPicking] = useState(false),
    [approvals, setApprovals] = useState<AdjustmentLineDraft | null>(null);
  const toast = useToast(),
    fail = useActionFailure(),
    { run, isActive } = useInFlight(),
    openAudit = useRecordAudit();
  const busy = isActive("save");
  const editable = view.canEdit && view.open;
  const x = view.texts,
    h = view.headers,
    l = view.labels;
  const id = `${ID}-form`;
  const codeLabel = (positionType: string, fn: string, obj?: string) => {
    const f = view.codes
      .find((c) => c.type === positionType)
      ?.functions.find((v) => v.value === fn);
    if (obj === undefined) return f?.label ?? fn;
    return f?.objects.find((o) => o.value === obj)?.label ?? obj;
  };
  const add = (picked: AdjustmentLineDraft[]) => {
    const fresh = picked.filter(
      (p) => !lines.some((s) => s.claimLineId === p.claimLineId),
    );
    // Legacy addAllLinesToAdj / addClaimLines' literal info toast.
    if (fresh.length === 0) toast.show("info", x.alreadyExist);
    else setLines((ls) => [...ls, ...fresh]);
  };
  const save = () =>
    void run(async () => {
      const result = await claims.saveAdjustment(appId, {
        fund,
        claim,
        adjustment: view.key,
        refundCheck,
        comment,
        lines: lines.map((d) => ({
          adjLineId: d.adjLineId,
          claimLineId: d.claimLineId,
          type: d.type,
          toFunction: d.toFunction,
          toObject: d.toObject,
          justification: d.justification,
          refund: d.refund,
        })),
      });
      if (!result.ok) return fail(result.error);
      onSaved(result.data.adjustment);
    }, "save");
  const exportLines = () =>
    void run(async () => {
      const result = await claims.exportAdjustmentLines(
        appId,
        fund,
        claim,
        view.key,
        status,
      );
      if (!result.ok) return fail(result.error);
      saveBlob(result.data.blob, result.data.filename);
    }, "export");
  const text = (
    key: "refund-check-number" | "adjustment-comment",
    value: string,
    set: (v: string) => void,
  ) =>
    editable ? (
      <InsideField
        htmlFor={`${id}-${key}`}
        label={l[key]}
        filled={value !== ""}
        required
      >
        <input
          id={`${id}-${key}`}
          value={value}
          disabled={busy}
          onChange={(e) => set(e.target.value)}
        />
      </InsideField>
    ) : (
      <ReadonlyField id={`${id}-${key}`} label={l[key]} value={value || "—"} />
    );
  return (
    <div id={id} className={styles.editor}>
      <hr className={styles.fundBarRule} />
      <div className={styles.editorGrid}>
        {view.key && (
          <ReadonlyField
            id={`${id}-number`}
            label={l["adjustment-number"]}
            value={view.key}
          />
        )}
        {view.status && (
          <ReadonlyField
            id={`${id}-status`}
            label={l["adjustment-status"]}
            value={view.status}
          />
        )}
        {text("refund-check-number", refundCheck, setRefundCheck)}
        {view.totalRefund !== null && view.totalRefund !== 0 && (
          <ReadonlyField
            id={`${id}-total-refund`}
            label={l["total-refund-amount"]}
            value={money(view.totalRefund)}
          />
        )}
        {text("adjustment-comment", comment, setComment)}
      </div>
      {(editable || view.canExport) && (
        <div className={styles.editorBar}>
          <div className={styles.fundBarActions}>
            {editable && (
              <>
                <button
                  type="button"
                  id={`${id}-add-line`}
                  className="gn-btn gn-btn--outlined"
                  disabled={busy}
                  onClick={() => setPicking(true)}
                >
                  {x.addLine}
                </button>
                <button
                  type="button"
                  id={`${id}-add-all`}
                  className="gn-btn gn-btn--outlined"
                  disabled={busy}
                  onClick={() => add(view.claimLines)}
                >
                  {x.addAll}
                </button>
              </>
            )}
          </div>
          <div className={styles.fundBarActions}>
            {view.canExport && (
              <button
                type="button"
                id={`${id}-export`}
                className="gn-btn gn-btn--outlined"
                disabled={isActive("export")}
                onClick={exportLines}
              >
                <Icon name="download" size={14} />
                {x.export}
              </button>
            )}
            {editable && (
              <button
                type="button"
                id={`${id}-save`}
                className="gn-btn gn-btn--primary"
                disabled={busy}
                onClick={save}
              >
                {x.save}
              </button>
            )}
          </div>
        </div>
      )}
      <DataTable
        id={`${id}-lines`}
        rowIds={`${id}-line`}
        label={x.lineTitle}
        rows={lines}
        rowKey={(r) => r.key}
        empty={x.empty}
        columns={[
          {
            id: "number",
            header: head(`${id}-number-h`, h.number),
            rowHeader: true,
            cell: (r) => r.number,
          },
          {
            id: "from-function",
            header: head(`${id}-from-function`, h.fromFunction),
            cell: (r) => codeLabel(r.positionType, r.fromFunction),
          },
          {
            id: "from-object",
            header: head(`${id}-from-object`, h.fromObject),
            cell: (r) =>
              codeLabel(r.positionType, r.fromFunction, r.fromObject),
          },
          {
            id: "status",
            header: head(`${id}-status-h`, h.status),
            cell: (r) => tone(r.status),
          },
          {
            id: "type",
            header: head(`${id}-type`, h.type),
            cell: (r) =>
              view.types.find((t) => t.value === r.type)?.label ?? r.type,
          },
          {
            id: "to-function",
            header: head(`${id}-to-function`, h.toFunction),
            cell: (r) =>
              r.toFunction ? codeLabel(r.positionType, r.toFunction) : "",
          },
          {
            id: "to-object",
            header: head(`${id}-to-object`, h.toObject),
            cell: (r) =>
              r.toObject
                ? codeLabel(r.positionType, r.toFunction, r.toObject)
                : "",
          },
          {
            id: "justification",
            header: head(`${id}-justification`, h.justification),
            cell: (r) => r.justification,
          },
          {
            id: "expenditure",
            header: head(`${id}-expenditure`, h.expenditure),
            cell: (r) => money(r.expenditure),
          },
          {
            id: "refund",
            header: head(`${id}-refund`, h.refund),
            cell: (r) => money(r.refund === "" ? null : Number(r.refund)),
          },
          {
            id: "description",
            header: head(`${id}-description`, h.description),
            cell: (r) => r.description,
          },
          {
            id: "person",
            header: head(`${id}-person`, h.person),
            cell: (r) => r.person,
          },
          {
            id: "trans-date",
            header: head(`${id}-trans-date`, h.transDate),
            cell: (r) => functions.format.dateDisplay(r.transDate, format),
          },
          {
            id: "trans-no",
            header: head(`${id}-trans-no`, h.transNo),
            cell: (r) => r.transNo,
          },
          {
            id: "comments",
            header: head(`${id}-comments-h`, h.comments),
            cell: (r) => r.comments,
          },
        ]}
        actions={[
          {
            id: "approvals",
            icon: "workflow",
            label: (r) => `${x.approvals} ${r.number}`,
            hidden: (r) => !view.lineApprovals || r.adjLineId === "",
            onClick: (r) => setApprovals(r),
          },
          {
            id: "audits",
            icon: "audits",
            label: (r) => `${x.audits} ${r.number}`,
            hidden: (r) => r.adjLineId === "",
            onClick: (r) =>
              openAudit({
                page: `claims-unit-claims-adjline-${claim}-${view.key}`,
                sec: r.adjLineId,
                title: x.audits,
              }),
          },
          {
            id: "edit",
            icon: "edit",
            label: (r) => `${x.edit} ${r.number}`,
            hidden: (r) => !editable || !r.editable,
            disabled: () => busy,
            onClick: (r) => setEditing(r),
          },
          {
            id: "delete",
            icon: "trash",
            label: (r) => `${x.delete} ${r.number}`,
            hidden: (r) => !editable || !r.editable || !view.canDeleteLines,
            disabled: () => busy,
            // Legacy removeAdjustmentLine: no confirm; the line goes on Save.
            onClick: (r) => setLines((ls) => ls.filter((s) => s.key !== r.key)),
          },
        ]}
      />
      {view.key && (
        <ApprovalSection
          id={`${id}-approval`}
          appId={appId}
          doc={`adjustment-${fund}-${claim}-${view.key}`}
          onChanged={onRouted}
        />
      )}
      {editing && (
        <LineDialog
          view={view}
          line={editing}
          onClose={() => setEditing(null)}
          onInvalid={(m) => toast.show("warning", m)}
          onDone={(line) => {
            setLines((ls) => ls.map((s) => (s.key === line.key ? line : s)));
            setEditing(null);
          }}
        />
      )}
      {picking && (
        <PickDialog
          view={view}
          money={money}
          onClose={() => setPicking(false)}
          onPick={(picked) => {
            add(picked);
            setPicking(false);
          }}
        />
      )}
      {approvals && (
        <ActionDialog
          id={`${id}-line-approvals`}
          title={x.approvalTitle}
          width="75vw"
          onClose={() => setApprovals(null)}
        >
          <ApprovalSection
            id={`${id}-line-approval`}
            appId={appId}
            doc={`adjline-${fund}-${claim}-${view.key}-${approvals.adjLineId}`}
            onChanged={onRouted}
          />
        </ActionDialog>
      )}
    </div>
  );
}

/** Legacy editAdjustmentLine: the type, a RECLASS line's new codes, a REJECT line's refund, the justification. */
function LineDialog({
  view,
  line,
  onClose,
  onInvalid,
  onDone,
}: {
  view: UnitAdjustmentView;
  line: AdjustmentLineDraft;
  onClose: () => void;
  onInvalid: (message: string) => void;
  onDone: (line: AdjustmentLineDraft) => void;
}) {
  // Legacy opens the line with its type cleared.
  const [d, setD] = useState({ ...line, type: "" });
  const id = `${ID}-line-dialog`;
  const l = view.labels;
  const fns =
    view.codes.find((c) => c.type === d.positionType)?.functions ?? [];
  const reclass = d.type === "RECLASS",
    reject = d.type === "REJECT";
  const pick = (
    k: "type" | "toFunction" | "toObject",
    rb: string,
    options: { value: string; label: string }[],
    onChange: (v: string) => void,
  ) => (
    <InsideField
      htmlFor={`${id}-${k}-trigger`}
      label={l[rb]}
      filled={d[k] !== ""}
      required
    >
      <Select
        id={`${id}-${k}`}
        label={l[rb]}
        options={options}
        value={d[k]}
        onChange={onChange}
      />
    </InsideField>
  );
  const update = () => {
    if (
      reclass &&
      d.toFunction === d.fromFunction &&
      d.toObject === d.fromObject
    )
      return onInvalid(view.texts.sameCodes);
    if (
      !d.type ||
      !d.justification.trim() ||
      (reclass && (!d.toFunction || !d.toObject)) ||
      (reject && !Number(d.refund))
    )
      return onInvalid("Please fill all the required fields!");
    onDone(d);
  };
  return (
    <ActionDialog
      id={id}
      title={view.texts.lineTitle}
      width="50vw"
      onClose={onClose}
    >
      <div className={styles.editorGrid}>
        {pick("type", "adjustment-type", view.types, (type) =>
          setD((s) => ({ ...s, type })),
        )}
        <ReadonlyField
          id={`${id}-from-function`}
          label={l["adjustment-original-function"]}
          value={
            fns.find((f) => f.value === d.fromFunction)?.label ?? d.fromFunction
          }
        />
        <ReadonlyField
          id={`${id}-from-object`}
          label={l["adjustment-original-object"]}
          value={
            fns
              .find((f) => f.value === d.fromFunction)
              ?.objects.find((o) => o.value === d.fromObject)?.label ??
            d.fromObject
          }
        />
        {reclass &&
          pick("toFunction", "adjustment-revised-function", fns, (toFunction) =>
            setD((s) => ({ ...s, toFunction, toObject: "" })),
          )}
        {reclass &&
          d.toFunction !== "" &&
          pick(
            "toObject",
            "adjustment-revised-object",
            fns.find((f) => f.value === d.toFunction)?.objects ?? [],
            (toObject) => setD((s) => ({ ...s, toObject })),
          )}
        {reject && (
          <InsideField
            htmlFor={`${id}-refund`}
            label={l["adjustment-refund-amount"]}
            filled={d.refund !== ""}
            required
          >
            <input
              id={`${id}-refund`}
              type="number"
              step="any"
              min={0}
              value={d.refund}
              onChange={(e) => setD((s) => ({ ...s, refund: e.target.value }))}
            />
          </InsideField>
        )}
      </div>
      <InsideField
        htmlFor={`${id}-justification`}
        label={l["adjustment-justification"]}
        filled={d.justification !== ""}
        required
        multiline
      >
        <textarea
          id={`${id}-justification`}
          rows={3}
          value={d.justification}
          onChange={(e) =>
            setD((s) => ({ ...s, justification: e.target.value }))
          }
        />
      </InsideField>
      <div className={styles.editorFoot}>
        <button
          type="button"
          id={`${id}-update`}
          className="gn-btn gn-btn--primary"
          onClick={update}
        >
          {view.texts.update}
        </button>
      </div>
    </ActionDialog>
  );
}

/** Legacy claimLinesDialog: the claim's lines, ticked, as new REJECT lines. */
function PickDialog({
  view,
  money,
  onClose,
  onPick,
}: {
  view: UnitAdjustmentView;
  money: Money;
  onClose: () => void;
  onPick: (lines: AdjustmentLineDraft[]) => void;
}) {
  const [picked, setPicked] = useState<string[]>([]);
  const id = `${ID}-pick`;
  const h = view.headers;
  return (
    <ActionDialog
      id={id}
      title={view.texts.lineTitle}
      width="75vw"
      onClose={onClose}
    >
      <DataTable
        id={`${id}-table`}
        rowIds={`${id}-row`}
        label={view.texts.addLine}
        rows={view.claimLines}
        rowKey={(r) => r.key}
        empty={view.texts.empty}
        columns={[
          {
            id: "pick",
            header: view.texts.addLine,
            cell: (r) => (
              <input
                id={`${id}-pick-${r.claimLineId}`}
                type="checkbox"
                aria-label={`${view.texts.addLine} ${r.number}`}
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
          { id: "number", header: h.number.label, cell: (r) => r.number },
          {
            id: "description",
            header: h.description.label,
            cell: (r) => r.description,
          },
          { id: "person", header: h.person.label, cell: (r) => r.person },
          {
            id: "expenditure",
            header: h.expenditure.label,
            cell: (r) => money(r.expenditure),
          },
        ]}
      />
      <div className={styles.editorFoot}>
        <button
          type="button"
          id={`${id}-submit`}
          className="gn-btn gn-btn--primary"
          onClick={() =>
            onPick(view.claimLines.filter((r) => picked.includes(r.key)))
          }
        >
          {view.texts.submit}
        </button>
      </div>
    </ActionDialog>
  );
}
