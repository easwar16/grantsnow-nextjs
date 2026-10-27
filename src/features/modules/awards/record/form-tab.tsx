"use client";
import { useEffect, useRef } from "react";
import { useToast } from "@/components/feedback/toast";
import {
  DynamicForm,
  type DynamicFormHandle,
} from "@/features/record/dynamic-form/dynamic-form";
import {
  AWARD_MODULE,
  EDITABLE_STATUSES,
  formSlotOf,
  type AwardFormTab as FormTabName,
} from "@/shared/awards/award-record";
import type { PageLock } from "@/shared/opportunities/eoi-record";
import { RECORD_SAVE, useAwardRecord } from "./record-shell";
import styles from "@/features/record/shell/record-tab.module.css";
/**
 * Dynamic Form 1–5 (legacy awards-dynamic-form-N: the dynamic-form fragment, AWARD / AWARDS-DYNAMIC-FORM-N).
 * Editable while a draft, read-only once the page is locked or finalized, with its own Submit.
 */
export function AwardFormTab({
  tab,
  awardId,
  number,
  statusCode,
  lock,
  texts,
}: {
  tab: FormTabName;
  awardId: string;
  number: string;
  statusCode: string;
  lock: PageLock;
  texts: Record<"submit" | "saved", string>;
}) {
  const { run, isActive, setGuard } = useAwardRecord(),
    toast = useToast(),
    form = useRef<DynamicFormHandle>(null);
  const editable = EDITABLE_STATUSES.includes(statusCode) && !lock.locked;
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
  return (
    <div id={`award-record-${tab}`} className={styles.tab}>
      <DynamicForm
        ref={form}
        objectType={AWARD_MODULE}
        slot={formSlotOf(tab)}
        parentId={awardId}
        objectId={awardId}
        objectNumber={number}
        editable={editable}
      />
      {editable && (
        <div className={styles.formActions}>
          <button
            type="button"
            id={`award-record-${tab}-submit`}
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
