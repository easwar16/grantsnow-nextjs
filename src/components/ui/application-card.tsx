import Link from "next/link";
import { Icon, type IconName } from "@/components/ui/icon";
import { StatusBadge, type StatusTone } from "@/components/ui/status-badge";
import { RecordMetadata } from "@/components/ui/record-metadata";
import styles from "./application-card.module.css";

/** Legacy status chips on an application card: in progress, rework, rejected, draft, otherwise done. */
export const applicationStatusTone = (code: string): StatusTone =>
  code === "WIP"
    ? "info"
    : code === "REWORK"
      ? "warning"
      : code === "REJ"
        ? "danger"
        : code === "DRFT"
          ? "neutral"
          : "success";
/** The risk chip: high and critical red, medium amber, low green, anything else neutral blue. */
export const applicationRiskTone = (code: string): StatusTone =>
  code === "HIGH" || code === "CRITICAL"
    ? "danger"
    : code === "MEDIUM"
      ? "warning"
      : code === "LOW"
        ? "success"
        : "info";

/**
 * One application in an Ethics or Due Diligence listing (legacy oj-list-view card, 621): the number and its chips, the
 * title, the label-over-value fields, and the row's actions at the card's right edge. Modules pass data only.
 */
export function ApplicationCard({
  id,
  openId,
  metadataId,
  href,
  icon,
  number,
  title,
  status,
  risk,
  response,
  fields,
  actions,
}: {
  id: string;
  /** The number link's id and the fields' id (kept stable: tests and guides find them). */
  openId: string;
  metadataId: string;
  href: string;
  icon: IconName;
  number: string;
  title: string;
  status?: { label: string; code: string };
  risk?: { label: string; code: string };
  /** The response status chip ("Response Status : …"), shown to the administrator view only. */
  response?: string;
  fields: { label: string; value?: React.ReactNode }[];
  actions?: React.ReactNode;
}) {
  return (
    <article id={id} className={styles.card}>
      <div className={styles.body}>
        <div className={styles.head}>
          <Link id={openId} href={href}>
            <Icon name={icon} size={18} /> {number}
          </Link>
          {status?.label && (
            <StatusBadge tone={applicationStatusTone(status.code)}>
              {status.label}
            </StatusBadge>
          )}
          {risk?.label && (
            <StatusBadge tone={applicationRiskTone(risk.code)}>
              {risk.label}
            </StatusBadge>
          )}
          {response && <span className={styles.response}>{response}</span>}
        </div>
        <h2>{title || number}</h2>
        <RecordMetadata id={metadataId} fields={fields} />
      </div>
      {actions && <div className={styles.actions}>{actions}</div>}
    </article>
  );
}
