"use client";
import { useEffect, useRef } from "react";
import { useToast } from "@/components/feedback/toast";
import {
  DynamicForm,
  type DynamicFormHandle,
} from "@/features/record/dynamic-form/dynamic-form";
import {
  EDITABLE_STATUSES,
  formOf,
  type FormTab as FormTabName,
} from "@/shared/opportunities/eoi-record";
import { RECORD_SAVE, useRecord } from "./record-context";
import type { PageLock } from "./types";
import styles from "./record.module.css";
/**
 * Dynamic Form 1–5 (GN-Angular eoi-form-tab): one component for the five tabs. Editable while a draft, read-only once
 * the page is locked or finalized, with its own Submit.
 */
export function FormTab({
  tab,
  requestId,
  number,
  statusCode,
  lock,
  texts,
}: {
  tab: FormTabName;
  requestId: string;
  number: string;
  statusCode?: string;
  lock: PageLock;
  texts: Record<"submit" | "saved", string>;
}) {
  const { run, isActive, setGuard } = useRecord(),
    toast = useToast(),
    form = useRef<DynamicFormHandle>(null);
  const editable = EDITABLE_STATUSES.includes(statusCode ?? "") && !lock.locked;
  useEffect(() => {
    setGuard({
      locked: lock.locked,
      dirty: () => form.current?.hasChanges() ?? false,
    });
    return () => setGuard(null);
  }, [setGuard, lock.locked]);
  const submit = () =>
    void run(async () => {
      const f = form.current;
      if (!f || !f.check() || !(await f.save())) return;
      toast.show("success", texts.saved);
    }, RECORD_SAVE);
  const { objectType, slot } = formOf(tab);
  return (
    <div id={`eoi-record-${tab}`} className={styles.tab}>
      <DynamicForm
        ref={form}
        objectType={objectType}
        slot={slot}
        parentId={requestId}
        objectId={requestId}
        objectNumber={number}
        editable={editable}
      />
      {editable && (
        <div className={styles.formActions}>
          <button
            type="button"
            id={`eoi-record-${tab}-submit`}
            className="gn-btn gn-btn--primary"
            disabled={isActive(RECORD_SAVE)}
            onClick={submit}
          >
            {texts.submit}
          </button>
        </div>
      )}
    </div>
  );
}
