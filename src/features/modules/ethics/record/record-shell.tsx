"use client";
import { useFormat } from "@/components/layout/shell-context";
import { RecordFrame } from "@/features/record/shell/record-frame";
import { functions } from "@/lib/functions";
import type { EthicsShellModel } from "@/server/modules/ethics/record/shell";

/**
 * A Ethics application (legacy ethics-detail-page) on the shared record frame: List, the panel and the
 * General Overview tab. Responses, attachments, approvals, history, comments and audit are not built yet.
 */
export function EthicsRecordShell({
  model,
  current,
  children,
}: {
  model: EthicsShellModel;
  current: string;
  children: React.ReactNode;
}) {
  const format = useFormat();
  const query = model.access
    ? `?access=${encodeURIComponent(model.access)}`
    : "";
  return (
    <RecordFrame
      prefix="ethics-record"
      back={{ href: "/ethics", label: model.labels.list }}
      record
      tabs={model.tabs.map((tab) => ({
        key: tab.key,
        href: `/ethics/${model.id}${query}${query ? "&" : "?"}tab=${tab.key}`,
        name: tab.name,
        icon:
          tab.key === "ethics-history"
            ? ("clock-history" as const)
            : tab.key === "ethics-attachments"
              ? ("attachment" as const)
              : ("settings" as const),
        finalized: false,
      }))}
      current={current}
      panel={model.panel.map((c) => ({
        key: c.key,
        label: c.label,
        value: c.date ? functions.format.dateDisplay(c.value, format) : c.value,
      }))}
      finalize={null}
      objectType="ETHICS"
      objectId={model.statusCode !== "DRFT" ? model.id : undefined}
      page={current}
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
