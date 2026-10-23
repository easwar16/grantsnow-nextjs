import {
  fieldError,
  fieldKey,
  fileIdOf,
  fileNameTaken,
  fileValue,
  gridRows,
  gridRowsComplete,
  isBlank,
  isGridEditable,
  newGridRow,
  readResponses,
  resolve,
  sectionKey,
  startsEnabled,
  toFieldValue,
  toPayload,
  withDependentConditions,
  type GridRow,
  type PayloadForm,
  type Resolution,
} from "./engine";
import type {
  DynField,
  DynForm,
  DynResponse,
  DynSection,
  FieldValue,
} from "./models";
/** The row being edited: which grid, which row, and its values before (null for a row just added). */
interface RowEdit {
  formId: number;
  sectionId: number;
  index: number;
  before: GridRow | null;
}
/** A file picked for a field, waiting for the save to upload it. */
export interface PendingFile {
  formId: number;
  sectionId: number;
  fieldId: number;
  file: File;
}
/**
 * A metadata-driven form's state (port of GN-Angular DynamicFormModel, without Reactive Forms): values, section
 * switches, grid rows, picked files and pending deletes. After every change the conditions are resolved; a hidden
 * field is not live, so it is skipped by validation and sent empty. GRID rows are edited one at a time. React reads
 * it through `subscribe` / `version` (useSyncExternalStore).
 */
export class DynamicFormModel {
  readonly forms: DynForm[];
  resolution: Resolution = {
    hiddenSections: new Set(),
    hiddenFields: new Set(),
    required: new Set(),
  };
  /** The grid row in edit mode; one at a time, as the original's table. */
  rowEdit: RowEdit | null = null;
  /** Grids with a committed row missing a required column, after a save was tried. */
  readonly gridErrors = new Set<string>();
  /** Files to upload on save, by field key. */
  readonly pendingFiles = new Map<string, PendingFile>();
  /** Stored attachments to delete on save. */
  readonly pendingDeletes = new Set<number>();
  version = 0;
  private readonly values = new Map<string, FieldValue>();
  private readonly enabledSections = new Map<string, boolean>();
  private readonly gridData = new Map<string, GridRow[]>();
  private readonly touched = new Set<string>();
  private allTouched = false;
  private rowTouched = false;
  private editable = true;
  private readonly baseline: string;
  private readonly listeners = new Set<() => void>();
  constructor(forms: DynForm[], responses: DynResponse[]) {
    this.forms = withDependentConditions(forms);
    const stored = readResponses(responses);
    this.forms.forEach((form) =>
      form.sections.forEach((section) => {
        const raw = stored[String(form.formId)]?.[String(section.sectionId)];
        const sKey = sectionKey(form.formId, section.sectionId);
        this.enabledSections.set(sKey, startsEnabled(section, raw));
        if (section.sectionType === "GRID")
          this.gridData.set(sKey, gridRows(section, raw));
        else
          section.fields.forEach((field) =>
            this.values.set(
              fieldKey(form.formId, section.sectionId, field.fieldId),
              toFieldValue(field, raw?.[String(field.fieldId)]),
            ),
          );
      }),
    );
    this.sync();
    this.baseline = this.snapshot();
  }
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };
  getVersion = () => this.version;
  // ── Reading ─────────────────────────────────────────────
  value(formId: number, sectionId: number, fieldId: number): FieldValue {
    return this.values.get(fieldKey(formId, sectionId, fieldId)) ?? null;
  }
  sectionEnabled(formId: number, sectionId: number) {
    return this.enabledSections.get(sectionKey(formId, sectionId)) === true;
  }
  /** The switch shows only on an optional section of an editable form. */
  hasSwitch(section: DynSection) {
    return this.editable && section.isMandatory !== "Y";
  }
  shown(formId: number, section: DynSection): boolean {
    return !this.resolution.hiddenSections.has(
      sectionKey(formId, section.sectionId),
    );
  }
  fieldShown(formId: number, sectionId: number, fieldId: number): boolean {
    return !this.resolution.hiddenFields.has(
      fieldKey(formId, sectionId, fieldId),
    );
  }
  required(formId: number, sectionId: number, fieldId: number): boolean {
    return this.resolution.required.has(fieldKey(formId, sectionId, fieldId));
  }
  get isEditable() {
    return this.editable;
  }
  /** Editable, switched on and shown: the field takes input and is validated (the Angular control's `enabled`). */
  live(formId: number, sectionId: number, fieldId: number) {
    return (
      this.editable &&
      this.sectionEnabled(formId, sectionId) &&
      !this.resolution.hiddenSections.has(sectionKey(formId, sectionId)) &&
      this.fieldShown(formId, sectionId, fieldId)
    );
  }
  private field(formId: number, sectionId: number, fieldId: number) {
    return this.forms
      .find((f) => f.formId === formId)
      ?.sections.find((s) => s.sectionId === sectionId)
      ?.fields.find((f) => f.fieldId === fieldId);
  }
  /** The error of a live field, whether shown or not. */
  private invalid(formId: number, sectionId: number, field: DynField) {
    if (!this.live(formId, sectionId, field.fieldId)) return null;
    return fieldError(
      field,
      this.value(formId, sectionId, field.fieldId),
      this.required(formId, sectionId, field.fieldId),
    );
  }
  /** The message under a field: once touched, or after a save was tried. */
  error(formId: number, sectionId: number, fieldId: number): string | null {
    const field = this.field(formId, sectionId, fieldId);
    if (!field) return null;
    const touched =
      this.allTouched || this.touched.has(fieldKey(formId, sectionId, fieldId));
    return touched ? this.invalid(formId, sectionId, field) : null;
  }
  // ── Writing ─────────────────────────────────────────────
  setValue(
    formId: number,
    sectionId: number,
    fieldId: number,
    value: FieldValue,
  ) {
    if (!this.live(formId, sectionId, fieldId)) return;
    this.values.set(fieldKey(formId, sectionId, fieldId), value);
    this.changed();
  }
  /** Marks a field as visited (blur), so its error shows. */
  touch(formId: number, sectionId: number, fieldId: number) {
    const key = fieldKey(formId, sectionId, fieldId);
    if (this.touched.has(key)) return;
    this.touched.add(key);
    this.changed();
  }
  setSectionEnabled(formId: number, section: DynSection, on: boolean) {
    if (!this.hasSwitch(section)) return;
    this.enabledSections.set(sectionKey(formId, section.sectionId), on);
    this.changed();
  }
  /** Read-only (finalized, locked or not editable) disables every control, the section switches too. */
  setEditable(editable: boolean) {
    if (this.editable === editable) return;
    this.editable = editable;
    if (!editable && this.rowEdit) this.cancelRow();
    this.changed();
  }
  // ── Grid rows ───────────────────────────────────────────
  rows(formId: number, sectionId: number): GridRow[] {
    return this.gridData.get(sectionKey(formId, sectionId)) ?? [];
  }
  isEditingRow(formId: number, sectionId: number, index: number) {
    const e = this.rowEdit;
    return (
      !!e &&
      e.formId === formId &&
      e.sectionId === sectionId &&
      e.index === index
    );
  }
  private gridLive(formId: number, section: DynSection) {
    return (
      this.editable &&
      this.sectionEnabled(formId, section.sectionId) &&
      this.shown(formId, section)
    );
  }
  /** Insert Row: a row of defaults, opened for editing. Not while another row is being edited. */
  addRow(formId: number, section: DynSection) {
    if (this.rowEdit || !this.gridLive(formId, section)) return;
    const rows = [...this.rows(formId, section.sectionId), newGridRow(section)];
    this.gridData.set(sectionKey(formId, section.sectionId), rows);
    this.rowEdit = {
      formId,
      sectionId: section.sectionId,
      index: rows.length - 1,
      before: null,
    };
    this.rowTouched = false;
    this.changed();
  }
  editRow(formId: number, section: DynSection, index: number) {
    if (this.rowEdit || !this.gridLive(formId, section)) return;
    const row = this.rows(formId, section.sectionId)[index];
    if (!row) return;
    this.rowEdit = {
      formId,
      sectionId: section.sectionId,
      index,
      before: { ...row },
    };
    this.rowTouched = false;
    this.changed();
  }
  setCell(fieldId: number, value: FieldValue) {
    const e = this.rowEdit;
    if (!e) return;
    const key = sectionKey(e.formId, e.sectionId);
    const rows = [...this.rows(e.formId, e.sectionId)];
    rows[e.index] = { ...rows[e.index], [String(fieldId)]: value };
    this.gridData.set(key, rows);
    this.changed();
  }
  private section(formId: number, sectionId: number) {
    return this.forms
      .find((f) => f.formId === formId)
      ?.sections.find((s) => s.sectionId === sectionId);
  }
  /** An editable cell's error in the row being edited, once Done or a save was tried. */
  cellError(fieldId: number): string | null {
    const e = this.rowEdit;
    if (!e || !this.rowTouched) return null;
    return this.cellInvalid(e, fieldId);
  }
  private cellInvalid(e: RowEdit, fieldId: number) {
    const field = this.section(e.formId, e.sectionId)?.fields.find(
      (f) => f.fieldId === fieldId,
    );
    if (!field || !isGridEditable(field)) return null;
    const value =
      this.rows(e.formId, e.sectionId)[e.index]?.[String(fieldId)] ?? null;
    return fieldError(field, value, field.isRequired === "Y");
  }
  private rowInvalid(e: RowEdit) {
    return (this.section(e.formId, e.sectionId)?.fields ?? []).some(
      (f) => this.cellInvalid(e, f.fieldId) !== null,
    );
  }
  /** Done: keeps the row when its required columns are filled; false (with the errors shown) otherwise. */
  doneRow(): boolean {
    const e = this.rowEdit;
    if (!e) return true;
    this.rowTouched = true;
    if (this.rowInvalid(e)) {
      this.changed();
      return false;
    }
    this.rowEdit = null;
    this.gridErrors.delete(sectionKey(e.formId, e.sectionId));
    this.changed();
    return true;
  }
  /** Cancel: puts the row back; a row just added goes away (the original kept it). */
  cancelRow() {
    const e = this.rowEdit;
    if (!e) return;
    const key = sectionKey(e.formId, e.sectionId);
    const rows = [...this.rows(e.formId, e.sectionId)];
    if (e.before === null) rows.splice(e.index, 1);
    else rows[e.index] = e.before;
    this.gridData.set(key, rows);
    this.rowEdit = null;
    this.changed();
  }
  deleteRow(formId: number, section: DynSection, index: number) {
    if (this.rowEdit || !this.gridLive(formId, section)) return;
    const rows = this.rows(formId, section.sectionId).filter(
      (_, i) => i !== index,
    );
    this.gridData.set(sectionKey(formId, section.sectionId), rows);
    this.changed();
  }
  // ── Files ───────────────────────────────────────────────
  /**
   * A file picked for a field: held until save, the field showing its name. The name must be unique among the form's
   * file fields (the original's file-should-be-unique); a stored file it replaces is deleted on save.
   */
  pickFile(
    formId: number,
    sectionId: number,
    fieldId: number,
    file: File,
  ): "taken" | "ok" {
    const key = fieldKey(formId, sectionId, fieldId);
    const taken =
      fileNameTaken(
        this.forms,
        (f, s, x) => this.values.get(fieldKey(f, s, x)) ?? null,
        file.name,
        key,
      ) ||
      [...this.pendingFiles.entries()].some(
        ([k, p]) => k !== key && p.file.name === file.name,
      );
    if (taken) return "taken";
    this.dropFile(key);
    this.pendingFiles.set(key, { formId, sectionId, fieldId, file });
    this.values.set(key, fileValue(file.name, null));
    this.touched.add(key);
    this.changed();
    return "ok";
  }
  private dropFile(key: string) {
    const id = fileIdOf(this.values.get(key) ?? null);
    if (id !== null) this.pendingDeletes.add(id);
    this.pendingFiles.delete(key);
    this.values.set(key, null);
  }
  /** Delete: clears the field; a stored file is deleted on save, a picked one is just dropped. */
  removeFile(formId: number, sectionId: number, fieldId: number) {
    if (!this.live(formId, sectionId, fieldId)) return;
    this.dropFile(fieldKey(formId, sectionId, fieldId));
    this.changed();
  }
  /** The picked file behind a field, when it has not been uploaded yet. */
  pendingFile(formId: number, sectionId: number, fieldId: number): File | null {
    return (
      this.pendingFiles.get(fieldKey(formId, sectionId, fieldId))?.file ?? null
    );
  }
  /** After an upload: the field holds `name~~attachmentId`, so the save posts the reference. */
  uploaded(p: PendingFile, attachmentId: number) {
    const key = fieldKey(p.formId, p.sectionId, p.fieldId);
    this.pendingFiles.delete(key);
    this.values.set(key, fileValue(p.file.name, attachmentId));
    this.changed();
  }
  deleted(attachmentId: number) {
    this.pendingDeletes.delete(attachmentId);
    this.changed();
  }
  // ── Save ────────────────────────────────────────────────
  /** The save body (`POST /dynamicForms/dynFormResponse`). */
  payload(): PayloadForm[] {
    return toPayload(this.forms, {
      enabled: (f, s) => this.sectionEnabled(f, s),
      valueOf: (f, s, x) => this.value(f, s, x),
      rowsOf: (f, s) => this.rows(f, s),
      resolution: this.resolution,
    });
  }
  /** Unsaved changes: what would be saved differs from what was loaded (toggling a value back is no change). */
  hasChanges(): boolean {
    return (
      this.rowEdit !== null ||
      this.pendingFiles.size > 0 ||
      this.pendingDeletes.size > 0 ||
      this.snapshot() !== this.baseline
    );
  }
  /**
   * Shows every error; true when the live fields are valid, no row is left in edit, and every committed grid row has
   * its required columns (the original never checked committed rows).
   */
  validate(): boolean {
    this.allTouched = true;
    if (this.rowEdit && !this.doneRow()) return false;
    this.gridErrors.clear();
    this.forms.forEach((form) =>
      form.sections
        .filter(
          (s) => s.sectionType === "GRID" && this.gridLive(form.formId, s),
        )
        .forEach((s) => {
          if (!gridRowsComplete(s, this.rows(form.formId, s.sectionId)))
            this.gridErrors.add(sectionKey(form.formId, s.sectionId));
        }),
    );
    this.changed();
    return this.gridErrors.size === 0 && !this.anyInvalid(() => true);
  }
  /** Some live field, or a cell of the row being edited, is required and empty (as opposed to failing a format rule). */
  hasMissing(): boolean {
    const e = this.rowEdit;
    const cellMissing =
      !!e &&
      (this.section(e.formId, e.sectionId)?.fields ?? []).some(
        (f) =>
          isGridEditable(f) &&
          f.isRequired === "Y" &&
          isBlank(
            this.rows(e.formId, e.sectionId)[e.index]?.[String(f.fieldId)],
          ),
      );
    return (
      this.gridErrors.size > 0 ||
      cellMissing ||
      this.anyInvalid(
        (form, section, field) =>
          this.required(form, section, field.fieldId) &&
          isBlank(this.value(form, section, field.fieldId)),
      )
    );
  }
  private anyInvalid(
    also: (formId: number, sectionId: number, field: DynField) => boolean,
  ) {
    return this.forms.some((form) =>
      form.sections.some(
        (section) =>
          section.sectionType === "FORM" &&
          section.fields.some(
            (field) =>
              this.invalid(form.formId, section.sectionId, field) !== null &&
              also(form.formId, section.sectionId, field),
          ),
      ),
    );
  }
  // Compared as the JSON it is saved as: an undefined field is absent there, so it is no change (isEqual would differ).
  private snapshot(): string {
    return JSON.stringify(this.payload());
  }
  private sync() {
    this.resolution = resolve(
      this.forms,
      (f, s, x) => this.values.get(fieldKey(f, s, x)) ?? null,
    );
  }
  private changed() {
    this.sync();
    this.version++;
    this.listeners.forEach((l) => l());
  }
}
