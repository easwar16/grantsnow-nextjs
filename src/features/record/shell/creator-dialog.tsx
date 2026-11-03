"use client";
import { ActionDialog } from "@/components/dialog/action-dialog";
import { ReadonlyField } from "@/components/ui/readonly-field";
import { Skeleton } from "@/components/feedback/skeleton";
import { State } from "@/components/feedback/state";
import { useApi, type Endpoint } from "@/lib/api";
import type { CreatorCard } from "./creator-types";
import styles from "./record-frame.module.css";

/** Legacy dialogCreatorDetails: the record creator's contact card, read-only, read on each open. `id` names its parts. */
export function CreatorDialog<P>({
  id,
  endpoint,
  params,
  onClose,
}: {
  id: string;
  endpoint: Endpoint<P, CreatorCard>;
  params: P;
  onClose: () => void;
}) {
  const { data, error, retry } = useApi(endpoint, params);
  return (
    <ActionDialog
      id={id}
      title={data?.title ?? "Creator Details"}
      width="50vw" /* legacy dialogCreatorDetails oj-md-width-1/2 */
      onClose={onClose}
    >
      {error ? (
        <State
          id={`${id}-error`}
          title="The creator's details could not be loaded"
          message={error.message}
          code={error.code}
          action={error.action}
          retry={retry}
        />
      ) : !data ? (
        <Skeleton kind="lines" count={7} label="Loading creator details" />
      ) : (
        <div id={`${id}-fields`} className={styles.creatorFields}>
          {data.fields.map((f) => (
            <ReadonlyField
              key={f.key}
              id={`${id}-${f.key}`}
              label={f.label}
              value={f.value}
            />
          ))}
        </div>
      )}
    </ActionDialog>
  );
}
