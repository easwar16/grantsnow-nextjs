"use client";
import { idPart } from "@/lib/ids";
import {
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { useToast } from "@/components/feedback/toast";
import { Skeleton } from "@/components/feedback/skeleton";
import { HelpButton } from "@/components/ui/help-button";
import { useInFlight } from "@/lib/hooks/use-in-flight";
import {
  deleteFormFile,
  downloadFormFile,
  loadFormData,
  RequestFailed,
  saveAnswers,
  saveBlob,
  uploadFormFile,
  type FormTargetQuery,
} from "./api";
import {
  fieldKey,
  fieldWidth,
  fileIdOf,
  fileNameOf,
  fileProblem,
  sectionWidth,
} from "./engine";
import { DynamicFormModel } from "./model";
import type { DynamicFormData, DynField, DynForm, DynSection } from "./models";
import { DynFieldView } from "./dyn-field";
import { DynGrid } from "./dyn-grid";
import styles from "./dynamic-form.module.css";
/**
 * The dynamic forms engine (port of GN-Angular shared/dynamic-form, D40/D42). CONTRACT between the record pages and the
 * engine: hosts render <DynamicForm ref=…> and drive it through the handle instead of trigger flags.
 */
export interface DynamicFormHandle {
  /** Validates (marks and focuses the first invalid field, toasts) and returns whether the form is valid. */
  check(): boolean;
  /**
   * Saves: pending file deletes → uploads → answers, stopping at the first failure. `objectId` / `objectNumber`
   * override the props for a record created just before the save (EOI Create). Resolves true on success.
   */
  save(objectId?: string, objectNumber?: string): Promise<boolean>;
  /** Re-reads forms and answers from the server, dropping local edits. */
  reload(): Promise<void>;
  /** Whether the would-be payload differs from the loaded answers (unsaved-changes guard). */
  hasChanges(): boolean;
}
export interface DynamicFormProps {
  /** Object type for dynForms `p_obj_type` (e.g. OPPORTUNITIES for the EOI Application, OPPORTUNITIES-EOI for Dynamic Form 1–5). */
  objectType: string;
  /** The form slot: dynForms `p_ref_module` and dynFormResponse `P_OBJECT_TYPE` (e.g. OPPORTUNITIES-EOI-APPLICATION). */
  slot: string;
  /**
   * The parent id the forms belong to (the opportunity id for an EOI application): authorises a new application's
   * form and is checked against a saved one. dynForms `p_id` itself is the record id, as the original sends it.
   */
  parentId: string;
  /** The saved object's id (EOI request id); absent for a new application. */
  objectId?: string;
  /** The saved object's number (e.g. AOI_513), used for the file folder (the server reads it again; never trusted). */
  objectNumber?: string;
  /** Editable when true; read-only otherwise (locked, finalized or not in edit mode). */
  editable: boolean;
  /** Called whenever the dirty state changes, for the host's unsaved-changes guard. */
  onDirtyChange?: (dirty: boolean) => void;
  /** Called when the form becomes ready or stops being ready, so the host can hold its save until then. */
  onReadyChange?: (ready: boolean) => void;
  ref?: React.Ref<DynamicFormHandle>;
}
/** What was loaded, for which target (`key`); another key means the current target is still loading. */
type Loaded = { key: string } & (
  | { status: "loading" }
  | { status: "failed" }
  | { status: "ready"; data: DynamicFormData; model: DynamicFormModel }
);
const INVALID = [
  'input[aria-invalid="true"]',
  'select[aria-invalid="true"]',
  'textarea[aria-invalid="true"]',
  '[contenteditable][aria-invalid="true"]',
  '[role="radiogroup"][aria-invalid="true"] input',
  '[role="group"][aria-invalid="true"] input',
].join(",");
const withRecord = (key: string, recordId: string): FormTargetQuery => ({
  ...(JSON.parse(key) as FormTargetQuery),
  objectId: recordId,
});
const failure = (e: unknown) =>
  e instanceof RequestFailed
    ? e.error
    : {
        code: "UPSTREAM",
        message: "The request could not be completed. Please retry.",
      };
/** One read of the form for a target, as the state it leads to; a failure degrades to "failed" with its error. */
async function fetchLoaded(
  key: string,
  signal: AbortSignal,
  editable: boolean,
): Promise<Loaded & { error?: ReturnType<typeof failure> }> {
  try {
    const data = await loadFormData(JSON.parse(key) as FormTargetQuery, signal);
    const model = new DynamicFormModel(data.forms, data.answers);
    model.setEditable(editable);
    return { key, status: "ready", data, model };
  } catch (e) {
    return { key, status: "failed", error: failure(e) };
  }
}
/** The slot code (e.g. OPPORTUNITIES-EOI-APPLICATION) as a kebab-case id prefix. */
const slotPrefix = (slot: string) =>
  slot.toLowerCase().replace(/[^a-z0-9]+/g, "-");
const noStore = () => () => {};
const zero = () => 0;
export function DynamicForm({
  objectType,
  slot,
  parentId,
  objectId,
  editable,
  onDirtyChange,
  onReadyChange,
  ref,
}: DynamicFormProps) {
  const toast = useToast(),
    { run, isActive } = useInFlight(),
    prefix = slotPrefix(slot),
    host = useRef<HTMLDivElement>(null),
    [state, setLoaded] = useState<Loaded>({ key: "", status: "loading" }),
    // The record saved by this form before the host's props catch up (EOI Create), so reloads read it.
    [savedId, setSavedId] = useState<string | undefined>(undefined),
    request = useRef<AbortController | null>(null),
    editableRef = useRef(editable),
    dirtyRef = useRef(false),
    onDirty = useRef(onDirtyChange),
    onReady = useRef(onReadyChange);
  const id = objectId ?? savedId;
  // The target's identity as a string, so effects and callbacks follow its values, not a new object per render.
  const targetKey = JSON.stringify({
    objectType,
    slot,
    parentId,
    objectId: id,
  });
  const loaded: Loaded =
    state.key === targetKey ? state : { key: targetKey, status: "loading" };
  const model = loaded.status === "ready" ? loaded.model : null;
  const texts = loaded.status === "ready" ? loaded.data.texts : null;
  useSyncExternalStore(
    model?.subscribe ?? noStore,
    model?.getVersion ?? zero,
    zero,
  );
  const load = useCallback(
    (key: string) => {
      request.current?.abort();
      const controller = new AbortController();
      request.current = controller;
      return fetchLoaded(key, controller.signal, editableRef.current).then(
        (next) => {
          if (controller.signal.aborted) return;
          if (next.error) toast.error(next.error);
          setLoaded(next);
        },
      );
    },
    [toast],
  );
  /** Reload: the skeleton again, then the fresh form (the original's reloadTrigger). */
  const reload = useCallback(
    (key: string) => {
      setLoaded({ key, status: "loading" });
      return load(key);
    },
    [load],
  );
  useEffect(() => {
    void load(targetKey);
    return () => request.current?.abort();
  }, [load, targetKey]);
  useEffect(() => {
    editableRef.current = editable;
    model?.setEditable(editable);
  }, [model, editable]);
  useEffect(() => {
    onDirty.current = onDirtyChange;
    onReady.current = onReadyChange;
  }, [onDirtyChange, onReadyChange]);
  const ready = loaded.status === "ready";
  useEffect(() => onReady.current?.(ready), [ready]);
  const dirty = model?.hasChanges() ?? false;
  useEffect(() => {
    if (dirtyRef.current === dirty) return;
    dirtyRef.current = dirty;
    onDirty.current?.(dirty);
  }, [dirty]);
  const fail = useCallback(
    (e: unknown) => {
      const error = failure(e);
      if (error.code === "WRITES_DISABLED") toast.show("info", error.message);
      else toast.error(error);
    },
    [toast],
  );
  const check = useCallback(() => {
    // Not loaded (or failed) is not valid: a host must not create a record whose answers cannot be saved.
    if (!model) {
      if (loaded.status === "failed")
        toast.show(
          "error",
          "The form could not be loaded, so it can't be saved.",
        );
      return false;
    }
    if (model.validate()) return true;
    // The required message when something is missing; otherwise the fields are filled but a rule failed.
    toast.show(
      "error",
      model.hasMissing()
        ? (texts?.requiredFields ?? "Please fill all the required fields")
        : "Please correct the fields marked in red",
      undefined,
      false,
    );
    requestAnimationFrame(() =>
      host.current?.querySelector<HTMLElement>(INVALID)?.focus(),
    );
    return false;
  }, [loaded.status, model, texts, toast]);
  const save = useCallback(
    async (overrideId?: string): Promise<boolean> => {
      if (loaded.status === "failed") {
        toast.show(
          "error",
          "The form could not be loaded, so it can't be saved.",
        );
        return false;
      }
      const m = model;
      // Nothing to save (no form) counts as saved, as the original.
      if (!m || m.forms.length === 0) return true;
      if (!check()) return false;
      const recordId = overrideId ?? id;
      if (recordId === undefined) {
        toast.show("error", "Save the application first.");
        return false;
      }
      const t = withRecord(targetKey, recordId);
      const done = await run(async () => {
        try {
          // One at a time; a failure stops the save (deleteOrder keeps answers off deleted files).
          const remove = async (ids: number[]) => {
            for (const attachmentId of ids) {
              try {
                await deleteFormFile(t, attachmentId);
              } catch (e) {
                // Already gone from the record's list: nothing left to delete.
                if (!(e instanceof RequestFailed && e.status === 404)) throw e;
              }
              m.deleted(attachmentId);
            }
          };
          const { before, after } = m.deleteOrder();
          await remove(before);
          for (const p of [...m.pendingFiles.values()])
            m.uploaded(p, await uploadFormFile(t, p.file));
          await saveAnswers(t, m.payload());
          await remove(after);
        } catch (e) {
          fail(e);
          return false;
        }
        // A new record id changes the target, and its effect reloads; otherwise reload here.
        if (JSON.stringify(t) === targetKey) await reload(targetKey);
        else setSavedId(recordId);
        return true;
      }, "save");
      return done ?? false;
    },
    [loaded.status, model, check, id, targetKey, run, fail, reload, toast],
  );
  useImperativeHandle(
    ref,
    () => ({
      check,
      save: (overrideId?: string) => save(overrideId),
      reload: () => reload(targetKey),
      hasChanges: () => model?.hasChanges() ?? false,
    }),
    [check, save, reload, targetKey, model],
  );
  if (loaded.status === "loading")
    return <Skeleton kind="lines" count={6} label="Loading form" />;
  const data = loaded.status === "ready" ? loaded.data : null;
  if (!model || !data || !model.forms.some((f) => f.sections.length > 0))
    // The backend can send a form with no sections for a record (seen on dev for AOI_476).
    return (
      <p id={`${prefix}-empty`} className={styles.empty}>
        {data?.texts.noData ?? "No data to display."}
      </p>
    );
  const saving = isActive("save");
  const download = (form: DynForm, section: DynSection, field: DynField) => {
    const pending = model.pendingFile(
      form.formId,
      section.sectionId,
      field.fieldId,
    );
    // A picked file downloads from the browser before it is saved (the original could not).
    if (pending) return saveBlob(pending, pending.name);
    const value = model.value(form.formId, section.sectionId, field.fieldId);
    const attachmentId = fileIdOf(value);
    if (attachmentId === null || id === undefined) return;
    void run(
      async () => {
        try {
          saveBlob(
            await downloadFormFile(withRecord(targetKey, id), attachmentId),
            fileNameOf(value),
          );
        } catch (e) {
          fail(e);
        }
      },
      `download:${fieldKey(form.formId, section.sectionId, field.fieldId)}`,
    );
  };
  const pick = (
    form: DynForm,
    section: DynSection,
    field: DynField,
    file: File,
  ) => {
    const problem = fileProblem(
      file,
      data.settings.maxMb,
      data.settings.accept,
    );
    if (problem) return toast.show("warning", data.texts.fileLarge, problem);
    if (
      model.pickFile(form.formId, section.sectionId, field.fieldId, file) ===
      "taken"
    )
      toast.show("error", data.texts.fileUnique);
  };
  return (
    <div ref={host} id={`${prefix}-form`} className={styles.form}>
      <fieldset
        id={`${prefix}-sections`}
        className={styles.sections}
        disabled={saving}
      >
        {model.forms.map((form) =>
          form.sections.map((section) => {
            if (!model.shown(form.formId, section)) return null;
            const on = model.sectionEnabled(form.formId, section.sectionId);
            const sectionDomId = `${prefix}-section-${idPart(section.sectionId)}`;
            return (
              <section
                key={`${form.formId}/${section.sectionId}`}
                id={sectionDomId}
                className={`${styles.section} enter-fade`}
                style={{ flexBasis: sectionWidth(section.colspan) }}
                aria-labelledby={`${sectionDomId}-title`}
              >
                <header className={styles.sectionHead}>
                  <h3 id={`${sectionDomId}-title`}>{section.sectionName}</h3>
                  <HelpButton
                    id={`${sectionDomId}-help`}
                    html={section.helperText}
                    label={data.texts.moreInfo}
                  />
                  {/* Mandatory sections have no switch; read-only forms show none. */}
                  {model.hasSwitch(section) && (
                    <label className={styles.switch}>
                      <input
                        id={`${sectionDomId}-switch`}
                        type="checkbox"
                        role="switch"
                        aria-label={section.sectionName}
                        checked={on}
                        onChange={(e) =>
                          model.setSectionEnabled(
                            form.formId,
                            section,
                            e.target.checked,
                          )
                        }
                      />
                      <span className={styles.track} aria-hidden="true" />
                    </label>
                  )}
                </header>
                {on &&
                  (section.sectionType === "GRID" ? (
                    <DynGrid
                      id={`${prefix}-grid-${section.sectionId}`}
                      model={model}
                      formId={form.formId}
                      section={section}
                      texts={data.texts}
                      decimals={data.settings.decimals}
                    />
                  ) : (
                    <div
                      id={`${sectionDomId}-fields`}
                      className={styles.fields}
                    >
                      {section.fields.map((field) =>
                        model.fieldShown(
                          form.formId,
                          section.sectionId,
                          field.fieldId,
                        ) ? (
                          <div
                            key={field.fieldId}
                            className={styles.cell}
                            style={{
                              flexBasis: fieldWidth(
                                field.colspan,
                                section.maxColumns,
                              ),
                            }}
                          >
                            <DynFieldView
                              model={model}
                              formId={form.formId}
                              section={section}
                              field={field}
                              id={`${prefix}-field-${field.fieldId}`}
                              data={data}
                              busy={saving}
                              onPick={(file) =>
                                pick(form, section, field, file)
                              }
                              onDownload={() => download(form, section, field)}
                            />
                          </div>
                        ) : null,
                      )}
                    </div>
                  ))}
              </section>
            );
          }),
        )}
      </fieldset>
    </div>
  );
}
