"use client";
import { usePathname } from "next/navigation";
import type { IconName } from "@/components/ui/icon";
import { RecordTabs } from "@/features/record/shell/record-tabs";

type Tab = "summary" | "workflow" | "signers" | "history" | "delegation";
type Grants = {
  workflow: boolean;
  signers: boolean;
  history: boolean;
  delegation: boolean;
  labels?: Record<string, string>;
};

export function ContractTabs({ id, grants }: { id: string; grants: Grants }) {
  const pathname = usePathname();
  const segment = pathname.split("/").filter(Boolean).at(-1);
  const current: Tab =
    segment === "workflow" ||
    segment === "signers" ||
    segment === "history" ||
    segment === "delegation"
      ? segment
      : "summary";
  const tabs: { key: Tab; label: string; visible: boolean; icon: IconName }[] =
    [
      {
        key: "summary",
        label: grants.labels?.["contracts-summary"] || "Contracts Summary",
        visible: true,
        icon: "document-attachment",
      },
      {
        key: "workflow",
        label: grants.labels?.["contracts-workflow"] || "Contracts Workflow",
        visible: grants.workflow,
        icon: "action",
      },
      {
        key: "signers",
        label: grants.labels?.["contracts-signers"] || "Contracts Signers",
        visible: grants.signers,
        icon: "signature",
      },
      {
        key: "history",
        label: grants.labels?.["contracts-history"] || "Contracts History",
        visible: grants.history,
        icon: "clock-history",
      },
      {
        key: "delegation",
        label:
          grants.labels?.["contracts-delegation"] || "Contracts Delegation",
        visible: grants.delegation,
        icon: "contact",
      },
    ];
  return (
    <RecordTabs
      id="contract-tabs"
      label="Contract sections"
      current={current}
      tabs={tabs
        .filter((tab) => tab.visible)
        .map((tab) => ({
          key: tab.key,
          name: tab.label,
          icon: tab.icon,
          href: `/contracts/${id}${tab.key === "summary" ? "" : `/${tab.key}`}`,
        }))}
    />
  );
}
