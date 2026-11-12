import Link from "next/link";
import { ParentDueDiligence } from "@/features/record/linked/parent-due-diligence";
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
      <ParentDueDiligence
        id="award-record"
        parent={{ type: "AWARD", id: view.parentId }}
        canCreate={view.canCreate}
        canLink={view.canLink}
        texts={view.parentTexts}
      />
      {view.records.length === 0 ? (
        <p id="award-dd-empty" className={styles.empty}>
          {view.texts.empty}
        </p>
      ) : (
        <ul id="award-dd-list" className={styles.cards}>
          {view.records.map((r) => {
            const rid = `award-dd-${functions.ids.idPart(r.id)}`;
            return (
              <li key={r.id} id={rid} className={listing.row}>
                <div className={listing.body}>
                  <div className={listing.overline}>
                    <Icon name="certification" size={14} />
                    <span className={listing.number}>{r.number}</span>
                    {r.status && (
                      <StatusBadge className={listing.status} tone={r.tone}>
                        {r.status}
                      </StatusBadge>
                    )}
                  </div>
                  {r.href ? (
                    <Link
                      id={`${rid}-title`}
                      href={r.href}
                      className={listing.title}
                    >
                      {r.title}
                    </Link>
                  ) : (
                    <span className={listing.title}>{r.title}</span>
                  )}
                  <RecordMetadata
                    fields={r.fields.map((f) => ({
                      label: f.label,
                      value: f.date
                        ? functions.format.dateDisplay(f.value, format)
                        : f.value,
                    }))}
                  />
                </div>
                {r.href && view.texts.view !== null && (
                  <Link
                    id={`${rid}-view`}
                    href={r.href}
                    className="gn-btn gn-btn--borderless gn-btn--icon"
                    aria-label={`${view.texts.view} ${r.number}`}
                    title={view.texts.view}
                  >
                    <Icon name="view" size={16} />
                  </Link>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
