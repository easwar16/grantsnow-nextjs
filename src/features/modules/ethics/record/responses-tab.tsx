"use client";
import { useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  DynamicForm,
  type DynamicFormHandle,
} from "@/features/record/dynamic-form/dynamic-form";
import { useToast } from "@/components/feedback/toast";
import { Select } from "@/components/ui/select";
import type { EthicsShellModel } from "@/server/modules/ethics/record/shell";
import styles from "@/features/record/shell/record-tab.module.css";

/** The shared dynamic form reads and writes the selected stakeholder through the protected form host. */
export function ResponsesTab({
  setupId,
  stakeholderId,
  editable,
  texts: t,
  versions,
  selectedVersion,
  historicalVersion,
}: {
  setupId: string;
  stakeholderId: string;
  editable: boolean;
  texts: Pick<
    EthicsShellModel["labels"],
    | "responseTitle"
    | "responseVersion"
    | "responseEdit"
    | "responseCancel"
    | "responseSave"
    | "responseSaved"
  >;
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
        toast.show("success", t.responseSaved);
        setEditing(false);
        router.refresh();
      }
    } finally {
      setSaving(false);
    }
  };
  return (
    <section
      id="ethics-responses"
      className={styles.tab}
      aria-label={t.responseTitle}
    >
      {versions.length > 0 && (
        <Select
          id="ethics-response-version"
          label={t.responseVersion}
          clearable={false}
          options={versions.map((row) => ({
            value: String(row.value),
            label: row.label,
          }))}
          value={String(selectedVersion ?? versions[0].value)}
          onChange={(value) => {
            const next = new URLSearchParams(query.toString());
            next.set("version", value);
            router.replace(`?${next.toString()}`, { scroll: false });
          }}
        />
      )}
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
      {editable && !editing && (
        <div className={styles.formActions}>
          <button
            type="button"
            className="gn-btn gn-btn--outlined"
            id="ethics-response-edit"
            onClick={() => setEditing(true)}
          >
            {t.responseEdit}
          </button>
        </div>
      )}
      {editable && editing && (
        <div className={styles.formActions}>
          <button
            type="button"
            className="gn-btn gn-btn--outlined"
            id="ethics-response-cancel"
            disabled={saving}
            onClick={() => {
              void form.current?.reload();
              setEditing(false);
            }}
          >
            {t.responseCancel}
          </button>
          <button
            type="button"
            className="gn-btn gn-btn--primary"
            id="ethics-response-save"
            disabled={saving}
            onClick={() => void save()}
          >
            {t.responseSave}
          </button>
        </div>
      )}
    </section>
  );
}
