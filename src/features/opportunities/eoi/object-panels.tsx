import { Icon } from "@/components/ui/icon";
import styles from "./record.module.css";
/** What every record page passes to its comments and audit trail (D38). */
export interface ObjectPanelProps {
  /** The panel's page-unique id. */
  id: string;
  /** The backend object type, e.g. `OPPORTUNITIES-EOI`. */
  objectType: string;
  objectId: string;
  /** The record page the user is on; comments and audits are kept per page. */
  page: string;
}
/**
 * A record's comments: the shared object-comments fragment (list, add, edit, delete, @mentions).
 * ponytail: placeholder until the centralised comments are rebuilt; hosts already pass the final inputs.
 */
export function ObjectComments(props: ObjectPanelProps) {
  return (
    <div
      id={props.id}
      className={styles.placeholder}
      data-object-type={props.objectType}
      data-object-id={props.objectId}
      data-page={props.page}
    >
      <Icon name="dynamic" size={32} />
      <p>Comments aren&apos;t rebuilt yet.</p>
    </div>
  );
}
/**
 * A record's audit trail: getObjectAudits for the page, filtered by event (all, inserted, updated, deleted).
 * ponytail: placeholder until the centralised audit trail is rebuilt; hosts already pass the final inputs.
 */
export function ObjectAudit(props: ObjectPanelProps) {
  return (
    <div
      id={props.id}
      className={styles.placeholder}
      data-object-type={props.objectType}
      data-object-id={props.objectId}
      data-page={props.page}
    >
      <Icon name="dynamic" size={32} />
      <p>The audit trail isn&apos;t rebuilt yet.</p>
    </div>
  );
}
