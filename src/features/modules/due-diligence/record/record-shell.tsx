"use client";
import { useFormat } from "@/components/layout/shell-context";
import { RecordFrame } from "@/features/record/shell/record-frame";
import { functions } from "@/lib/functions";
import type { DueDiligenceShellModel } from "@/server/modules/due-diligence/record/shell";

/**
 * A Due Diligence application (legacy duediligence-detail-page) on the shared record frame: List, the panel and the
 * General Overview tab. Responses, attachments, approvals, history, comments and audit are not built yet.
 */
export function DueDiligenceRecordShell({
  model,
  children,
}: {
  model: DueDiligenceShellModel;
  children: React.ReactNode;
}) {
  const format = useFormat();
  const query = model.access
    ? `?access=${encodeURIComponent(model.access)}`
    : "";
  return (
    <RecordFrame
      prefix="due-diligence-record"
      back={{ href: "/due-diligence", label: model.labels.list }}
      record
      tabs={[
        {
          key: "overview",
          href: `/due-diligence/${model.id}${query}`,
          name: model.labels.overview,
          icon: "settings",
          finalized: false,
        },
      ]}
      current="overview"
      panel={model.panel.map((c) => ({
        key: c.key,
        label: c.label,
        value: c.date ? functions.format.dateDisplay(c.value, format) : c.value,
      }))}
      finalize={null}
      objectType="DUE_DILIGENCE"
      page="duediligence-general-overview"
      labels={{
        comments: "",
        audit: null,
        auditTitle: "",
        close: "Close",
        finalize: "",
        finalized: "",
        tabs: model.labels.tabs,
      }}
    >
      {children}
    </RecordFrame>
  );
}
