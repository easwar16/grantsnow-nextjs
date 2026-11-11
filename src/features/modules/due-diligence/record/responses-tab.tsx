"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  DynamicForm,
  type DynamicFormHandle,
} from "@/features/record/dynamic-form/dynamic-form";
import { useLeaveGuard } from "@/features/record/shell/leave-guard";
import {
  DISCARD_DIALOG,
  type LeaveGuard,
} from "@/features/modules/opportunities/eoi/unsaved";
import { useConfirm } from "@/components/dialog/action-dialog";
import { useToast } from "@/components/feedback/toast";
import { Select } from "@/components/ui/select";
import type { DueDiligenceShellModel } from "@/server/modules/due-diligence/record/shell";
import styles from "@/features/record/shell/record-tab.module.css";

type Respondent = { id: string; name: string; status: string };
export function ResponsesTab({
  setupId,
  respondent,
  respondents,
  access,
  editable,
  versions,
  selectedVersion,
  historicalVersion,
  texts: t,
}: {
  setupId: string;
  respondent: Respondent;
  respondents: Respondent[];
  access: string;
  editable: boolean;
  versions: { value: number; label: string }[];
  selectedVersion?: number;
  historicalVersion?: number;
  texts: DueDiligenceShellModel["responses"];
}) {
  const form = useRef<DynamicFormHandle>(null);
  const guard = useRef<LeaveGuard | null>(null);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(false);
  const toast = useToast();
  const router = useRouter();
  const query = useSearchParams();
  const { ask, element: confirmation } = useConfirm(
    "due-diligence-response-discard",
  );
  useEffect(() => {
    guard.current = editing
      ? { locked: false, dirty: () => form.current?.hasChanges() === true }
      : null;
  }, [editing]);
  const stopEditing = useCallback(() => setEditing(false), []);
  useLeaveGuard(guard, ask, router.push, stopEditing);
  const pickVersion = async (value: string) => {
    if (editing && form.current?.hasChanges() && !(await ask(DISCARD_DIALOG)))
      return;
    setEditing(false);
    const next = new URLSearchParams(query.toString());
    next.set("version", value);
    router.replace(`?${next.toString()}`, { scroll: false });
  };
  const save = async () => {
    if (saving) return;
    setSaving(true);
    try {
      if (await form.current?.save()) {
        toast.show("success", t.saved);
        setEditing(false);
      }
    } finally {
      setSaving(false);
    }
  };
  return (
    <section
      id="due-diligence-responses"
      className={styles.tab}
      aria-label={t.title}
    >
      {versions.length > 1 && (
        <Select
          id="due-diligence-response-version"
          label={t.version}
          clearable={false}
          options={versions.map((row) => ({
            value: String(row.value),
            label: row.label,
          }))}
          value={String(selectedVersion ?? versions[0].value)}
          onChange={(value) => void pickVersion(value)}
        />
      )}
      {respondents.length > 1 && (
        <nav id="due-diligence-response-people" aria-label={t.participants}>
          {respondents.map((row) => (
            <Link
              key={row.id}
              id={`due-diligence-response-person-${row.id}`}
              href={`/due-diligence/${setupId}?access=${encodeURIComponent(access)}&tab=duediligence-responses&respondent=${row.id}`}
              aria-current={row.id === respondent.id ? "page" : undefined}
            >
              {row.name || row.id} {row.status && `— ${row.status}`}
            </Link>
          ))}
        </nav>
      )}
      <DynamicForm
        key={`${respondent.id}:${historicalVersion ?? "latest"}`}
        ref={form}
        objectType="DUE_DILIGENCE"
        slot="DUE_DILIGENCE"
        parentId={setupId}
        objectId={respondent.id}
        objectNumber={respondent.id}
        editable={editable && editing}
        version={historicalVersion}
      />
      {editable && (
        <div className={styles.formActions}>
          {editing ? (
            <>
              <button
                type="button"
                className="gn-btn gn-btn--primary"
                id="due-diligence-response-save"
                disabled={saving}
                onClick={() => void save()}
              >
                {t.save}
              </button>
              <button
                type="button"
                className="gn-btn gn-btn--outlined"
                id="due-diligence-response-cancel"
                disabled={saving}
                onClick={() => {
                  void form.current?.reload();
                  setEditing(false);
                }}
              >
                {t.cancel}
              </button>
            </>
          ) : (
            <button
              type="button"
              className="gn-btn gn-btn--outlined"
              id="due-diligence-response-edit"
              onClick={() => setEditing(true)}
            >
              {t.edit}
            </button>
          )}
        </div>
      )}
      {confirmation}
    </section>
  );
}
