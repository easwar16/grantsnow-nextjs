"use client";

import { useSelectedLayoutSegment } from "next/navigation";
import type { IconName } from "@/components/ui/icon";
import { RecordTabs } from "@/features/record/shell/record-tabs";

type ProposalTab = {
  segment: string | null;
  page: string;
  label: string;
  icon: IconName;
};

const dynamicTabs: ProposalTab[] = Array.from({ length: 5 }, (_, index) => ({
  segment: `dynamic-form-${index + 1}`,
  page: `proposals-dynamic-form-${index + 1}`,
  label:
    index === 0
      ? "Proposal Detail"
      : index === 1
        ? "Commentary for Approvers"
        : `Dynamic Form ${index + 1}`,
  icon: index === 0 ? "due-diligence" : "comment",
}));

const tabs: ProposalTab[] = [
  {
    segment: null,
    page: "proposals-summary",
    label: "Proposal Summary",
    icon: "proposal-summary",
  },
  {
    segment: "budget",
    page: "proposals-budget",
    label: "Proposal Budget",
    icon: "proposal-budget",
  },
  {
    segment: "pricing",
    page: "proposals-pricing",
    label: "Proposal Funder Rules",
    icon: "proposal-pricing",
  },
  ...dynamicTabs,
  {
    segment: "allocation-for-credit",
    page: "proposals-allocation-for-credit",
    label: "Credit Allocation",
    icon: "proposal-credit",
  },
  {
    segment: "fec-summary",
    page: "proposals-fec-summary",
    label: "FEC Summary",
    icon: "proposal-budget",
  },
  {
    segment: "ethics",
    page: "proposals-ethics",
    label: "Proposal ethics",
    icon: "proposal-ethics",
  },
  {
    segment: "due-diligence",
    page: "proposals-due-diligence",
    label: "Due diligence",
    icon: "due-diligence",
  },
  {
    segment: "contracts",
    page: "proposals-contracts",
    label: "Proposal contracts",
    icon: "signature",
  },
  {
    segment: "attachments",
    page: "proposals-attachments",
    label: "Proposal Attachments",
    icon: "proposal-documents",
  },
  {
    segment: "approvals",
    page: "proposals-approvals",
    label: "Approvals",
    icon: "proposal-approvals",
  },
  {
    segment: "history",
    page: "proposals-history",
    label: "Proposal history",
    icon: "clock-history",
  },
  {
    segment: "delegation",
    page: "proposals-delegation",
    label: "Proposal delegation",
    icon: "proposal-delegation",
  },
];

export function ProposalTabs({
  type,
  id,
  access,
  finalizedPages,
}: {
  type: string;
  id: string;
  access: [string, { read: boolean }][];
  finalizedPages: string[];
}) {
  const segment = useSelectedLayoutSegment();
  const rights = new Map(access);
  const finalized = new Set(finalizedPages);
  return (
    <RecordTabs
      id={`proposal-${id}-tabs`}
      label="Proposal sections"
      current={segment ?? ""}
      tabs={tabs
        .filter((tab) => rights.get(tab.page)?.read)
        .map((tab) => ({
          key: tab.segment ?? "",
          id: `${tab.page}-tab`,
          name: tab.label,
          icon: tab.icon,
          finalized: finalized.has(tab.page),
          href: `/proposals/${type}/${id}${tab.segment ? `/${tab.segment}` : ""}`,
        }))}
    />
  );
}
