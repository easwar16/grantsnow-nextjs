"use client";
import { StatusBadge } from "@/components/ui/status-badge";
import Link from "next/link";
import { Icon } from "@/components/ui/icon";
import { Collapsible } from "@/components/ui/collapsible";
import { RecordMetadata } from "@/components/ui/record-metadata";
import { ActionDialog } from "@/components/dialog/action-dialog";
import { type FormatSettings } from "@/lib/format";
import type { LinkedObjects } from "./model";
import styles from "./linked.module.css";
import { functions } from "@/lib/functions";

/**
 * Legacy linkedModulesDialog: a record's linked records by module, each with its status, title, last update and View
 * (the record's legacy link, mapped to its in-app route and opened in a new tab). `children` is the host's own part,
 * shown first (Awards: link a proposal to an award that has none).
 */
export function LinkedObjectsDialog({
  id,
  linked,
  format,
  busy,
  onClose,
  children,
}: {
  id: string;
  linked: LinkedObjects;
  format?: FormatSettings;
  busy?: boolean;
  onClose: () => void;
  children?: React.ReactNode;
}) {
  const { groups, texts: t } = linked;
  return (
    <ActionDialog id={id} title={t.title} busy={busy} onClose={onClose}>
      <div id={`${id}-body`} className={styles.body}>
        {children}
        {groups.map((g) => (
          <Collapsible
            key={g.key}
            id={`${id}-${g.key}`}
            headClassName={styles.groupHead}
            heading={g.label}
          >
            <ul className={styles.records}>
              {g.records.map((r) => (
                <li
                  key={r.id}
                  id={`${id}-${functions.ids.idPart(r.id)}`}
                  className={styles.record}
                >
                  <div className={styles.main}>
                    <div className={styles.overline}>
                      <Icon name="data-document" size={14} />
                      <strong>{r.name}</strong>
                      {r.status && <StatusBadge>{r.status}</StatusBadge>}
                    </div>
                    {r.title && <div className={styles.title}>{r.title}</div>}
                    <RecordMetadata
                      fields={[
                        { label: t.updatedBy, value: r.updatedBy },
                        {
                          label: t.updated,
                          value:
                            r.updated &&
                            functions.format.dateDisplay(r.updated, format),
                        },
                      ]}
                    />
                  </div>
                  {r.href && (
                    <Link
                      id={`${id}-${functions.ids.idPart(r.id)}-view`}
                      className="gn-btn gn-btn--borderless gn-btn--icon"
                      href={r.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      prefetch={false}
                      title={t.view}
                      aria-label={`${t.view} ${r.name}`}
                    >
                      <Icon name="view" size={16} />
                    </Link>
                  )}
                </li>
              ))}
            </ul>
          </Collapsible>
        ))}
      </div>
    </ActionDialog>
  );
}
