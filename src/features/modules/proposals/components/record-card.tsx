import { StatusBadge, type StatusTone } from "@/components/ui/status-badge";
import Link from "next/link";
import { recordIdentity } from "../record";
import { RecordMetadata } from "@/components/ui/record-metadata";
import { type FormatSettings } from "@/lib/format";
import type { Column, ProposalRow } from "../types";
import { functions } from "@/lib/functions";
import { Icon } from "@/components/ui/icon";
import styles from "./listing.module.css";
function tone(code?: string): StatusTone {
  if (["REJ", "ABANDON", "HIGH", "CRITICAL"].includes(code || ""))
    return "danger";
  if (["AWARD", "LOW"].includes(code || "")) return "success";
  if (["AIA", "MEDIUM"].includes(code || "")) return "warning";
  if (["IA", "NONE"].includes(code || "")) return "info";
  return "neutral";
}
export function RecordCard({
  row,
  columns,
  format,
  actions,
  onAction,
}: {
  row: ProposalRow;
  columns: Column[];
  format?: FormatSettings;
  actions: {
    view: string | null;
    link: string | null;
    share: string | null;
    clone: string | null;
    delete: string | null;
  };
  onAction: (
    action: "link" | "share" | "clone" | "delete",
    row: ProposalRow,
  ) => void;
}) {
  const identity = recordIdentity.safeParse({
    type: row.type,
    id: row.id.split(":")[1],
  });
  const fields = columns
    .filter(
      (c) => !["reference", "title", "status", "type", "tags"].includes(c.key),
    )
    .map((c) => ({
      label: c.label,
      value:
        c.key === "value"
          ? functions.format
              .moneyDisplay(row.value, row.currency, format)
              .replace(/([£$€])0\.00$/, "$10")
          : ["created", "updated", "start", "end"].includes(c.key)
            ? functions.format.dateDisplay(row[c.key], format)
            : row[c.key],
    }));
  return (
    <article
      className="proposal-card"
      aria-label={`${row.reference} ${row.title}`}
    >
      <div className="record-overline">
        <span aria-hidden="true">▧</span>
        <strong>{row.reference}</strong>
        {row.status && (
          <StatusBadge tone={tone(row.statusCode)}>{row.status}</StatusBadge>
        )}
        {row.risk && (
          <StatusBadge tone={tone(row.riskCode)}>{row.risk}</StatusBadge>
        )}
        <span className="sr-only">
          {row.type === "OUTLINE_PROPOSAL"
            ? "Outline Proposal"
            : row.type === "SUB_PROPOSAL"
              ? "Sub-Proposal"
              : row.type === "EXTENSION_PROPOSAL"
                ? "Extension Proposal"
                : "Proposal"}
        </span>
      </div>
      <h2 className="record-title">
        {identity.success ? (
          <Link
            href={`/proposals/${identity.data.type}/${identity.data.id}`}
            prefetch={false}
          >
            {row.title}
          </Link>
        ) : (
          row.title
        )}
      </h2>
      <RecordMetadata fields={fields} />
      <div
        className={styles.cardActions}
        aria-label={`Actions for ${row.reference}`}
      >
        {actions.view && identity.success && (
          <Link
            id={`proposal-${functions.ids.idPart(row.id)}-view`}
            href={`/proposals/${identity.data.type}/${identity.data.id}`}
            className="gn-btn gn-btn--borderless gn-btn--icon"
            aria-label={`${actions.view} ${row.reference}`}
            title={actions.view}
          >
            <Icon name="view" />
          </Link>
        )}
        {(["link", "share", "clone", "delete"] as const).map((action) => {
          const label = actions[action];
          if (!label) return null;
          const disabled =
            (action === "clone" && !!row.parentId) ||
            (action === "delete" &&
              (row.statusCode !== "DRFT" || !!row.parentId));
          return (
            <button
              key={action}
              id={`proposal-${functions.ids.idPart(row.id)}-${action}`}
              type="button"
              className="gn-btn gn-btn--borderless gn-btn--icon"
              aria-label={`${label} ${row.reference}`}
              title={label}
              disabled={disabled}
              onClick={() => onAction(action, row)}
            >
              <Icon
                name={
                  action === "link"
                    ? "link"
                    : action === "clone"
                      ? "copy"
                      : action === "delete"
                        ? "trash"
                        : "share"
                }
              />
            </button>
          );
        })}
      </div>
      {row.tags && (
        <p className="record-tags">
          {row.tags.split(",").map((tag) => (
            <span key={tag}>#{tag.trim()}</span>
          ))}
        </p>
      )}
    </article>
  );
}
