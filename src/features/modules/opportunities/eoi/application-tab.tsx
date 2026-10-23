"use client";
import { useEffect, useRef, useState } from "react";
import { useToast } from "@/components/feedback/toast";
import {
  DynamicForm,
  type DynamicFormHandle,
} from "@/features/record/dynamic-form/dynamic-form";
import {
  ObjectAttributes,
  type AttributesHandle,
} from "@/features/record/attributes/object-attributes";
import { canSaveApplication, formOf } from "@/shared/opportunities/eoi-record";
import { useActionFailure } from "../../../../components/dialog/action-failure";
import { RECORD_SAVE, useRecord } from "./record-context";
import { eoi } from "@/lib/api";
import type { PageLock } from "./types";
import styles from "./record.module.css";
/**
 * The Application tab (GN-Angular eoi-application): a new application is created only once its form validates
 * (insertRequest), then its answers are saved against it; an existing one is edited through the header's
 * Edit Application / Save as draft / Cancel Edit.
 */
export function ApplicationTab({
  opportunityId,
  requestId,
  number,
  statusCode,
  lock,
  texts,
}: {
  opportunityId: string;
  requestId?: string;
  number?: string;
  statusCode?: string;
  lock: PageLock;
  texts: Record<
    "create" | "save" | "created" | "updated" | "createdNoNumber",
    string
  >;
}) {
  const record = useRecord(),
    toast = useToast(),
    fail = useActionFailure(),
    form = useRef<DynamicFormHandle>(null),
    attributes = useRef<AttributesHandle>(null),
    [formReady, setFormReady] = useState(false),
    // A request created whose answers then failed: a retry saves into it instead of inserting another one.
    created = useRef<{ requestId: string; number: string } | null>(null);
  const { setApplication, setGuard, setEditing, run, navigate } = record;
  const isNew = requestId === undefined;
  const editable = (isNew || record.editing) && !lock.locked;
  const save = () =>
    void run(async () => {
      const f = form.current;
      if (!f || lock.locked) return;
      // Attributes before the form, as legacy saveAOI; both show their errors.
      const attributesOk = attributes.current?.check() ?? true;
      if (!f.check() || !attributesOk) return;
      if (!isNew) {
        if (!(await f.save())) return;
        attributes.current?.reload();
        setEditing(false);
        toast.show("success", texts.updated);
        return;
      }
      if (!created.current) {
        const result = await eoi.create(Number(opportunityId));
        if (!result.ok) return fail(result.error);
        if (result.data.number === null) {
          // Saving files under an unknown folder is the legacy `/undefined/` defect: open the record instead.
          toast.show("warning", texts.createdNoNumber);
          return navigate(
            `/opportunities/eoi/${result.data.requestId}/application`,
            true,
          );
        }
        created.current = {
          requestId: result.data.requestId,
          number: result.data.number,
        };
      }
      const { requestId: id, number: n } = created.current;
      if (!(await f.save(id, n))) return;
      setGuard(null);
      toast.show("success", texts.created);
      // The record now exists: open it, so the header, panel and tabs load for it.
      navigate(`/opportunities/eoi/${id}/application`, true);
    }, RECORD_SAVE);
  const cancel = () => {
    setEditing(false);
    void form.current?.reload();
  };
  useEffect(() => {
    setApplication({ save, cancel });
    setGuard({
      locked: lock.locked,
      dirty: () => form.current?.hasChanges() ?? false,
    });
  });
  // Leaving the tab drops edit mode, as the original's exit gate did.
  useEffect(
    () => () => {
      setApplication(null);
      setGuard(null);
      setEditing(false);
    },
    [setApplication, setGuard, setEditing],
  );
  const { objectType, slot } = formOf("application");
  return (
    <div id="eoi-record-application" className={styles.tab}>
      <ObjectAttributes
        ref={attributes}
        id="eoi-record-attributes"
        host="opportunities-eoi-application"
        parentId={opportunityId}
        objectId={requestId}
        editable={editable}
      />
      <DynamicForm
        ref={form}
        objectType={objectType}
        slot={slot}
        parentId={opportunityId}
        objectId={requestId}
        objectNumber={number}
        editable={editable}
        onReadyChange={setFormReady}
      />
      {canSaveApplication(requestId, record.editing, statusCode) && (
        <div className={styles.formActions}>
          <button
            type="button"
            id="eoi-record-application-save"
            className="gn-btn gn-btn--primary"
            disabled={!formReady || lock.locked || record.isActive(RECORD_SAVE)}
            onClick={save}
          >
            {isNew ? texts.create : texts.save}
          </button>
        </div>
      )}
    </div>
  );
}
