"use client";
import { useCallback, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  DynamicForm,
  type DynamicFormHandle,
} from "@/features/record/dynamic-form/dynamic-form";
import { useToast } from "@/components/feedback/toast";
import { useResponseEdit } from "./response-edit-context";

/** The shared dynamic form reads and writes the selected stakeholder through the protected form host. */
export function ResponsesTab({
  setupId,
  stakeholderId,
  editable,
  historicalVersion,
  texts,
}: {
  setupId: string;
  stakeholderId: string;
  editable: boolean;
  historicalVersion?: number;
  texts: { responseSaved: string };
}) {
  const form = useRef<DynamicFormHandle>(null);
  const router = useRouter();
  const toast = useToast();
  const { editing, saving, setEditing, setSaving, register } =
    useResponseEdit();
  const save = useCallback(async () => {
    if (saving) return;
    setSaving(true);
    try {
      if (await form.current?.save()) {
        toast.show("success", texts.responseSaved);
        setEditing(false);
        router.refresh();
      }
    } finally {
      setSaving(false);
    }
  }, [saving, setSaving, setEditing, router, toast, texts.responseSaved]);
  const cancel = useCallback(() => {
    void form.current?.reload();
    setEditing(false);
  }, [setEditing]);
  useEffect(() => {
    register({ save: () => void save(), cancel });
    return () => register(null);
  }, [register, save, cancel]);
  return (
    <section id="ethics-responses" aria-label="Responses">
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
        legacyReadOnly
      />
    </section>
  );
}
