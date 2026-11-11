"use client";
import { useState } from "react";
import { ActionDialog } from "@/components/dialog/action-dialog";
import { useActionFailure } from "@/components/dialog/action-failure";
import { State } from "@/components/feedback/state";
import { DetailSkeleton } from "@/components/feedback/skeleton";
import { DataTable } from "@/components/ui/data-table";
import { Icon } from "@/components/ui/icon";
import { ReadonlyField } from "@/components/ui/readonly-field";
import { StatusBadge } from "@/components/ui/status-badge";
import { saveBlob } from "@/features/record/dynamic-form/api";
import { useRecordAudit } from "@/features/record/shell/record-frame";
import { claims, useApi } from "@/lib/api";
import type { FormatSettings } from "@/lib/format";
import { functions } from "@/lib/functions";
import { useInFlight } from "@/lib/hooks/use-in-flight";
import { claimStatusTone } from "@/shared/claims/status";
import type { UnitClaimEditView, UnitClaimView } from "../listing/types";
import { ClaimableSections } from "./activity-details";
import { AdjustmentsSection } from "./adjustments-section";
import { ApprovalSection } from "./approval-section";
import { ClaimEditor } from "./claim-editor";
import { head } from "./fund-bar";
import styles from "./summary.module.css";

const ID = "claims-unit-claim";
type Format = FormatSettings & { currency?: string };
type Money = (v: number | null) => string;
type Line = UnitClaimView["lines"][number];

/**
 * One claim (legacy claim drawer): its header, Export, its lines (row Audits, Claimable Amounts, Approvals) and its
 * approval route (Submit for Approval, Withdraw). After a route change the claim and the list read again.
 */
export function ClaimPanel({
  appId,
  fund,
  claim,
  status,
  format,
  money,
  onChanged,
  onSaved,
}: {
  appId: string;
  fund: string;
  /** Empty for New Claim. */
  claim: string;
  /** The list's status filter, which the lines export takes (legacy line_status_code). */
  status: string;
  format?: Format;
  money: Money;
  onChanged: () => void;
  /** After Save Claim: the claim's id (minted for a new one). */
  onSaved: (claim: string) => void;
}) {
  const edit = useApi(claims.claimEdit, { appId, fund, claim });
  if (claim === "")
    return edit.error ? (
      <State
        id={`${ID}-error`}
        title="Couldn't load the claim"
        message={edit.error.message}
        retry={edit.retry}
      />
    ) : !edit.data ? (
      <DetailSkeleton label="Loading the claim" />
    ) : (
      <ClaimEditor
        appId={appId}
        fund={fund}
        claim=""
        setup={edit.data}
        format={format}
        money={money}
        onSaved={onSaved}
      />
    );
  return (
    <SavedClaim
      appId={appId}
      fund={fund}
      claim={claim}
      status={status}
      format={format}
      money={money}
      onChanged={onChanged}
      onSaved={onSaved}
      edit={edit.data}
    />
  );
}

function SavedClaim({
  appId,
  fund,
  claim,
  status,
  format,
  money,
  onChanged,
  onSaved,
  edit,
}: {
  appId: string;
  fund: string;
  claim: string;
  status: string;
  format?: Format;
  money: Money;
  onChanged: () => void;
  onSaved: (claim: string) => void;
  /** The editor's setup, once read; the claim shows read-only until then or when it is closed to change. */
  edit?: UnitClaimEditView;
}) {
  const read = useApi(claims.claimDetail, { appId, fund, claim });
  const [amounts, setAmounts] = useState<Line | null>(null),
    [approvals, setApprovals] = useState<Line | null>(null);
  const fail = useActionFailure(),
    { run, isActive } = useInFlight(),
    openAudit = useRecordAudit();
  const view = read.data;
  if (read.error)
    return (
      <State
        id={`${ID}-error`}
        title="Couldn't load the claim"
        message={read.error.message}
        retry={read.retry}
      />
    );
  if (!view) return <DetailSkeleton label="Loading the claim" />;
  const h = view.headers,
    x = view.texts;
  const date = (v: string) => functions.format.dateDisplay(v, format);
  const exportLines = () =>
    void run(async () => {
      const result = await claims.exportClaimLines(appId, fund, claim, status);
      if (!result.ok) return fail(result.error);
      saveBlob(result.data.blob, result.data.filename);
    }, "export");
  return (
    <div id={ID} className={styles.editor}>
      <div id={`${ID}-header`} className={styles.editorGrid}>
        {view.fields.map((f) => (
          <ReadonlyField
            key={f.key}
            id={`${ID}-${f.key}`}
            label={f.label}
            value={
              f.kind === "money"
                ? money(Number(f.value))
                : f.kind === "date"
                  ? date(f.value)
                  : f.value
            }
          />
        ))}
      </div>
      {view.canExport && (
        <div className={styles.editorBar}>
          <span />
          <button
            type="button"
            id={`${ID}-export`}
            className="gn-btn gn-btn--outlined"
            disabled={isActive("export")}
            onClick={exportLines}
          >
            <Icon name="download" size={14} />
            {x.export}
          </button>
        </div>
      )}
      {edit?.canEdit && edit.open ? (
        <ClaimEditor
          appId={appId}
          fund={fund}
          claim={claim}
          setup={edit}
          saved={view}
          format={format}
          money={money}
          onSaved={onSaved}
          lineActions={(line) => {
            const saved = view.lines.find((s) => s.key === line.lineId);
            if (!saved) return [];
            return [
              {
                id: "audits",
                icon: "audits" as const,
                label: `${x.audits} ${saved.number}`,
                onClick: () =>
                  openAudit({
                    page: `claims-unit-claims-line-${claim}`,
                    sec: saved.key,
                    title: x.audits,
                  }),
              },
              ...(saved.activity
                ? [
                    {
                      id: "amounts",
                      icon: "money" as const,
                      label: `${x.amounts} ${saved.number}`,
                      onClick: () => setAmounts(saved),
                    },
                  ]
                : []),
              ...(saved.approvals
                ? [
                    {
                      id: "approvals",
                      icon: "workflow" as const,
                      label: `${x.approvals} ${saved.number}`,
                      onClick: () => setApprovals(saved),
                    },
                  ]
                : []),
            ];
          }}
        />
      ) : (
        <DataTable
          id={`${ID}-lines`}
          rowIds={`${ID}-line`}
          label={x.title}
          rows={view.lines}
          rowKey={(r) => r.key}
          empty={x.empty}
          columns={[
            {
              id: "number",
              header: head(`${ID}-lines-number`, h.number),
              rowHeader: true,
              cell: (r) => r.number,
            },
            ...(
              [
                "positionType",
                "function",
                "object",
                "expenditure",
                "category",
                "person",
              ] as const
            ).map((k) => ({
              id: k,
              header: head(`${ID}-lines-${k}`, h[k]),
              cell: (r: Line) => r[k],
            })),
            {
              id: "amount",
              header: head(`${ID}-lines-amount`, h.amount),
              cell: (r) => money(r.amount),
            },
            {
              id: "adjust",
              header: head(`${ID}-lines-adjust`, h.adjust),
              cell: (r) => money(r.adjust),
            },
            {
              id: "status",
              header: head(`${ID}-lines-status`, h.status),
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
              id: "defer",
              header: head(`${ID}-lines-defer`, h.defer),
              cell: (r) => (r.defer ? x.yes : x.no),
            },
            {
              id: "cohort",
              header: head(`${ID}-lines-cohort`, h.cohort),
              cell: (r) => r.cohort,
            },
            ...(["start", "end", "transDate"] as const).map((k) => ({
              id: k,
              header: head(`${ID}-lines-${k}`, h[k]),
              cell: (r: Line) => date(r[k]),
            })),
            {
              id: "trans-no",
              header: head(`${ID}-lines-trans-no`, h.transNo),
              cell: (r) => r.transNo,
            },
            {
              id: "comments",
              header: head(`${ID}-lines-comments`, h.comments),
              cell: (r) => r.comments,
            },
          ]}
          actions={[
            {
              id: "audits",
              icon: "audits",
              label: (r) => `${x.audits} ${r.number}`,
              onClick: (r) =>
                openAudit({
                  page: `claims-unit-claims-line-${claim}`,
                  sec: r.key,
                  title: x.audits,
                }),
            },
            {
              id: "amounts",
              icon: "money",
              label: (r) => `${x.amounts} ${r.number}`,
              hidden: (r) => r.activity === null,
              onClick: (r) => setAmounts(r),
            },
            {
              id: "approvals",
              icon: "workflow",
              label: (r) => `${x.approvals} ${r.number}`,
              hidden: (r) => !r.approvals,
              onClick: (r) => setApprovals(r),
            },
          ]}
        />
      )}
      {/* Legacy: the claim's approval route under its lines (Submit for Approval, Withdraw, the stages). */}
      <ApprovalSection
        id={`${ID}-approval`}
        appId={appId}
        doc={`claim-${fund}-${claim}`}
        onChanged={() => {
          read.retry();
          onChanged();
        }}
      />
      {view.adjustable && (
        <AdjustmentsSection
          appId={appId}
          fund={fund}
          claim={claim}
          status={status}
          format={format}
          money={money}
          onChanged={() => {
            read.retry();
            onChanged();
          }}
        />
      )}
      {amounts?.activity && (
        <ActionDialog
          id={`${ID}-amounts`}
          title={x.amounts}
          width="75vw"
          onClose={() => setAmounts(null)}
        >
          <ClaimableSections
            appId={appId}
            fund={fund}
            activity={amounts.activity.activity}
            version={amounts.activity.version}
            format={format}
            money={money}
          />
        </ActionDialog>
      )}
      {approvals && (
        <ActionDialog
          id={`${ID}-line-approvals`}
          title={x.approvalTitle}
          width="75vw" /* legacy approvalsDialog: 75vw */
          onClose={() => setApprovals(null)}
        >
          <ApprovalSection
            id={`${ID}-line-approval`}
            appId={appId}
            doc={`line-${fund}-${claim}-${approvals.key}`}
            onChanged={read.retry}
          />
        </ActionDialog>
      )}
    </div>
  );
}
