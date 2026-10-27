"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon, type IconName } from "@/components/ui/icon";
import styles from "../../contracts.module.css";

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
    <nav
      id="contract-tabs"
      className={styles.detailTabs}
      aria-label="Contract sections"
    >
      {tabs
        .filter((tab) => tab.visible)
        .map((tab) =>
          tab.key === current ? (
            <span
              id={`contract-tab-${tab.key}`}
              aria-current="page"
              key={tab.key}
            >
              <Icon name={tab.icon} /> {tab.label}
            </span>
          ) : (
            <Link
              id={`contract-tab-${tab.key}`}
              href={`/contracts/${id}${tab.key === "summary" ? "" : `/${tab.key}`}`}
              prefetch={false}
              key={tab.key}
            >
              <Icon name={tab.icon} /> {tab.label}
            </Link>
          ),
        )}
    </nav>
  );
}
