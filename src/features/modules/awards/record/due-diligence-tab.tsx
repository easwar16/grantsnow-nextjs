import Link from "next/link";
import { DueDiligenceParentActions } from "@/features/modules/due-diligence/parent-actions";
import { StatusBadge } from "@/components/ui/status-badge";
import { Icon } from "@/components/ui/icon";
import { RecordMetadata } from "@/components/ui/record-metadata";
import { type FormatSettings } from "@/lib/format";
import listing from "@/components/ui/listing.module.css";
import type { DueDiligenceView } from "./due-diligence-model";
import styles from "./tabs.module.css";
import { functions } from "@/lib/functions";

/** The Due Diligence tab (legacy ddAwardList): the linked records as cards. */
export function DueDiligenceTab({
  view,
  format,
}: {
  view: DueDiligenceView;
  format?: FormatSettings;
}) {
  return (
    <div id="award-record-due-diligence" className={styles.tab}>
      <DueDiligenceParentActions parent={{ type: "AWARD", id: view.parentId }}
        canCreate={view.canCreate} canLink={view.canLink} />
      {view.records.length === 0 ? (
        <p id="award-dd-empty" className={styles.empty}>
          {view.texts.empty}
        </p>
      ) : (
        <ul id="award-dd-list" className={styles.cards}>
          {view.records.map((r) => (
            <li
              key={r.id}
              id={`award-dd-${functions.ids.idPart(r.id)}`}
              className={listing.row}
            >
              <div className={listing.body}>
                <div className={listing.overline}>
                  <Icon name="due-diligence" size={14} />
                  <Link href={`/due-diligence/${r.id}`} className={listing.number}>{r.number}</Link>
                  {r.status && (
                    <StatusBadge className={listing.status} tone={r.tone}>
                      {r.status}
                    </StatusBadge>
                  )}
                </div>
                <span className={listing.title}>{r.title}</span>
                <RecordMetadata
                  fields={r.fields.map((f) => ({
                    label: f.label,
                    value: f.date
                      ? functions.format.dateDisplay(f.value, format)
                      : f.value,
                  }))}
                />
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
