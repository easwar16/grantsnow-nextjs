"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { DynamicForm, type DynamicFormHandle } from "@/features/record/dynamic-form/dynamic-form";
import { useToast } from "@/components/feedback/toast";
import styles from "@/features/record/shell/record-tab.module.css";

type Respondent = { id: string; name: string; status: string };
export function ResponsesTab({
  setupId, respondent, respondents, access, editable, versions, selectedVersion, historicalVersion,
}: {
  setupId: string;
  respondent: Respondent;
  respondents: Respondent[];
  access: string;
  editable: boolean;
  versions: { value: number; label: string }[];
  selectedVersion?: number;
  historicalVersion?: number;
}) {
  const form = useRef<DynamicFormHandle>(null);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(false);
  const toast = useToast();
  const router = useRouter();
  const query = useSearchParams();
  useEffect(() => {
    if (!editing) return;
    const warn = (event: BeforeUnloadEvent) => {
      if (!form.current?.hasChanges()) return;
      event.preventDefault();
    };
    window.addEventListener("beforeunload", warn);
    const guardLink = (event: MouseEvent) => {
      const anchor = (event.target as Element | null)?.closest("a[href]");
      if (!anchor || !form.current?.hasChanges()) return;
      if (!window.confirm("Discard unsaved response changes?")) {
        event.preventDefault();
        event.stopPropagation();
      }
    };
    document.addEventListener("click", guardLink, true);
    return () => {
      window.removeEventListener("beforeunload", warn);
      document.removeEventListener("click", guardLink, true);
    };
  }, [editing]);
  const save = async () => {
    if (saving) return;
    setSaving(true);
    try {
      if (await form.current?.save()) {
        toast.show("success", "Response saved.");
        setEditing(false);
      }
    } finally {
      setSaving(false);
    }
  };
  return (
    <section id="due-diligence-responses" className={styles.tab} aria-label="Responses">
      {versions.length > 1 && <label htmlFor="due-diligence-response-version">Version
        <select id="due-diligence-response-version" className="gn-control"
          value={selectedVersion ?? versions[0].value}
          onChange={(event) => {
            if (editing && form.current?.hasChanges() && !window.confirm("Discard unsaved response changes?")) return;
            setEditing(false);
            const next = new URLSearchParams(query.toString());
            next.set("version", event.target.value);
            router.replace(`?${next.toString()}`, { scroll: false });
          }}>
          {versions.map((row) => <option key={row.value} value={row.value}>{row.label}</option>)}
        </select>
      </label>}
      {respondents.length > 1 && (
        <nav aria-label="Participant responses">
          {respondents.map((row) => (
            <Link key={row.id}
              href={`/due-diligence/${setupId}?access=${encodeURIComponent(access)}&tab=duediligence-responses&respondent=${row.id}`}
              aria-current={row.id === respondent.id ? "page" : undefined}>
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
          {editing ? <>
            <button type="button" className="gn-btn gn-btn--primary"
              id="due-diligence-response-save" disabled={saving} onClick={() => void save()}>Save response</button>
            <button type="button" className="gn-btn gn-btn--outlined"
              id="due-diligence-response-cancel" disabled={saving}
              onClick={() => { void form.current?.reload(); setEditing(false); }}>Cancel</button>
          </> : <button type="button" className="gn-btn gn-btn--outlined"
            id="due-diligence-response-edit" onClick={() => setEditing(true)}>Edit response</button>}
        </div>
      )}
    </section>
  );
}
