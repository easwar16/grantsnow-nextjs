"use client";
import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { post } from "@/lib/api/http";
import { useFormat } from "@/components/layout/shell-context";
import { RecordFrame } from "@/features/record/shell/record-frame";
import { functions } from "@/lib/functions";
import type { DueDiligenceShellModel } from "@/server/modules/due-diligence/record/shell";
import { DueDiligencePrint } from "./print";
import { DueDiligenceReferenceLink } from "./reference-link";

/** A Due Diligence application (legacy duediligence-detail-page) on the shared record frame. */
export function DueDiligenceRecordShell({
  model,
  current,
  children,
  participantId,
  finalizeState,
  printOptions,
  canLink,
  canAutoSubmit,
}: {
  model: DueDiligenceShellModel;
  current: string;
  participantId?: string;
  finalizeState?: { visible: boolean; finalized: boolean; finalizedPages: string[] };
  printOptions?: { code: string; label: string; enabled: boolean }[];
  canLink?: boolean;
  canAutoSubmit?: boolean;
  children: React.ReactNode;
}) {
  const format = useFormat();
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [saved, setSaved] = useState<boolean | null>(null);
  const [error, setError] = useState("");
  const query = model.access
    ? `?access=${encodeURIComponent(model.access)}`
    : "";
  return (
    <RecordFrame
      prefix="due-diligence-record"
      back={{ href: "/due-diligence", label: model.labels.list }}
      toolbarStart={<>
        {current === "duediligence-general-overview" && model.canEditSetup &&
          <Link id="due-diligence-edit-setup" className="gn-btn gn-btn--outlined"
            href={`/due-diligence/${model.id}/edit?access=${model.access}`}>
            Edit setup
          </Link>}
        {canLink && ["duediligence-general-overview", "duediligence-responses"].includes(current) &&
          <DueDiligenceReferenceLink id={model.id} access={model.access} />}
        {canAutoSubmit && participantId && <button id="due-diligence-auto-submit" type="button"
          className="gn-btn gn-btn--primary" disabled={pending} onClick={() => {
            setPending(true); setError("");
            void post<{ submitted: boolean }>("/due-diligence/actions/auto-submit", {
              id: model.id, access: model.access, respondent: participantId,
            }).then((result) => {
              if (result.ok) router.refresh();
              else setError(result.error.message);
              setPending(false);
            });
          }}>Submit for Approval</button>}
      </>}
      toolbarEnd={printOptions?.length && participantId
        ? <DueDiligencePrint id={model.id} access={model.access}
            respondent={participantId} options={printOptions} /> : null}
      record
      tabs={model.tabs.map((tab) => ({
        key: tab.key,
        href: `/due-diligence/${model.id}${query}${query ? "&" : "?"}tab=${tab.key}`,
        name: tab.name,
        icon:
          tab.key === "duediligence-history"
            ? ("clock-history" as const)
            : ("settings" as const),
        finalized: finalizeState?.finalizedPages.includes(tab.key) ?? false,
      }))}
      current={current}
      panel={model.panel.map((c) => ({
        key: c.key,
        label: c.label,
        value: c.date ? functions.format.dateDisplay(c.value, format) : c.value,
      }))}
      finalize={finalizeState?.visible && participantId ? {
        on: saved ?? finalizeState.finalized,
        busy: pending,
        onChange: (finalize) => {
          setPending(true);
          setError("");
          void post<{ finalized: boolean }>(`/due-diligence/${model.id}/finalize`, {
            access: model.access, respondent: participantId, page: current, finalize,
          }).then((result) => {
            if (result.ok) { setSaved(result.data.finalized); router.refresh(); }
            else setError(result.error.message);
            setPending(false);
          });
        },
      } : null}
      objectType="DUE_DILIGENCE"
      objectId={model.statusCode !== "DRFT" ? model.id : undefined}
      page={current}
      panelSec={current === "duediligence-general-overview" ? undefined : participantId}
      labels={{
        comments: model.access === "RESPONDENT_ACCESS" && current === "duediligence-approvals"
          ? "" : model.labels.comments,
        audit: model.access === "RESPONDENT_ACCESS" && current === "duediligence-approvals"
          ? null : model.labels.audit,
        auditTitle: model.labels.auditTitle,
        close: model.labels.close,
        finalize: "Finalize",
        finalized: "Finalized",
        tabs: model.labels.tabs,
      }}
    >
      {children}
      {error && <p role="alert">{error}</p>}
    </RecordFrame>
  );
}
