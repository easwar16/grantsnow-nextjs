"use client";
import { useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { DynamicForm, type DynamicFormHandle } from "@/features/record/dynamic-form/dynamic-form";
import { useToast } from "@/components/feedback/toast";
import styles from "@/features/record/shell/record-tab.module.css";

/** The shared dynamic form reads and writes the selected stakeholder through the protected form host. */
export function ResponsesTab({
  setupId,
  stakeholderId,
  editable,
  saveLabel,
  versions,
  selectedVersion,
  historicalVersion,
}: {
  setupId: string;
  stakeholderId: string;
  editable: boolean;
  saveLabel: string;
  versions: { value: number; label: string }[];
  selectedVersion?: number;
  historicalVersion?: number;
}) {
  const form = useRef<DynamicFormHandle>(null);
  const router = useRouter();
  const query = useSearchParams();
  const toast = useToast();
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(false);
  const save = async () => {
    if (saving) return;
    setSaving(true);
    try {
      if (await form.current?.save()) {
        toast.show("success", "Response saved.");
        setEditing(false);
        router.refresh();
      }
    } finally {
      setSaving(false);
    }
  };
  return (
    <section id="ethics-responses" className={styles.tab} aria-label="Responses">
      {versions.length > 0 && <label htmlFor="ethics-response-version">Version
        <select id="ethics-response-version" className="gn-control"
          value={selectedVersion ?? versions[0].value}
          onChange={(event) => {
            const next = new URLSearchParams(query.toString());
            next.set("version", event.target.value);
            router.replace(`?${next.toString()}`, { scroll: false });
          }}>
          {versions.map((row) => <option key={row.value} value={row.value}>{row.label}</option>)}
        </select>
      </label>}
      <DynamicForm
        key={`${stakeholderId}:${historicalVersion ?? "latest"}`}
        ref={form}
        objectType="ETHICS"
        slot="ETHICS"
        parentId={setupId}
        objectId={stakeholderId}
        objectNumber={stakeholderId}
        editable={editable && editing}
        version={historicalVersion}
      />
      {editable && !editing && <div className={styles.formActions}>
        <button type="button" className="gn-btn gn-btn--outlined" id="ethics-response-edit"
          onClick={() => setEditing(true)}>Edit</button>
      </div>}
      {editable && editing && <div className={styles.formActions}>
        <button type="button" className="gn-btn gn-btn--outlined" id="ethics-response-cancel"
          disabled={saving} onClick={() => { void form.current?.reload(); setEditing(false); }}>Cancel</button>
        <button type="button" className="gn-btn gn-btn--primary" id="ethics-response-save"
          disabled={saving} onClick={() => void save()}>{saveLabel}</button>
      </div>}
    </section>
  );
}
