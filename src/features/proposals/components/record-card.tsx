import Link from "next/link";
import { recordIdentity } from "../record";
import { RecordMetadata } from "@/components/ui/record-metadata";
import { dateDisplay, moneyDisplay } from "@/lib/format";
import type { Column, ProposalRow } from "../types";
function tone(code?: string) {
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
}: {
  row: ProposalRow;
  columns: Column[];
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
          ? moneyDisplay(row.value, row.currency).replace(
              /([£$€])0\.00$/,
              "$10",
            )
          : ["created", "updated", "start", "end"].includes(c.key)
            ? dateDisplay(row[c.key])
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
        <span className={`record-chip ${tone(row.statusCode)}`}>
          {row.status}
        </span>
        {row.risk && (
          <span className={`record-chip ${tone(row.riskCode)}`}>
            {row.risk}
          </span>
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
