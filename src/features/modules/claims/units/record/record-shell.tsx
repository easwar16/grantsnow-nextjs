"use client";
import { useSelectedLayoutSegment } from "next/navigation";
import { RecordFrame } from "@/features/record/shell/record-frame";
import {
  UNIT_MODULE,
  UNIT_TAB_DEFS,
  unitTabs,
  pageOf,
  type UnitTab,
} from "@/shared/claims/unit-record";
import type { UnitShellModel } from "../types";

const asTab = (segment: string | null): UnitTab =>
  (unitTabs as readonly string[]).includes(segment ?? "")
    ? (segment as UnitTab)
    : "summary";

/**
 * A unit application's record (legacy claims-unit-inquiry-info-page): List, the tabs, and the Unit / Fiscal Year /
 * Program Type panel. The container has no comments; each tab opens its own audit trail (useRecordAudit).
 */
export function UnitRecordShell({
  model,
  children,
}: {
  model: UnitShellModel;
  children: React.ReactNode;
}) {
  const tab = asTab(useSelectedLayoutSegment());
  return (
    <RecordFrame
      prefix="claims-unit"
      back={{ href: "/claims/unit-inquiry", label: model.labels.list }}
      record
      tabs={model.tabs.map((x) => ({
        key: x.tab,
        href: `/claims/unit-inquiry/${model.appId}/${x.tab}`,
        name: x.name,
        icon: UNIT_TAB_DEFS[x.tab].icon,
        finalized: false,
      }))}
      current={tab}
      panel={model.panel}
      finalize={null}
      objectType={UNIT_MODULE}
      objectId={model.appId}
      page={pageOf(tab)}
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
