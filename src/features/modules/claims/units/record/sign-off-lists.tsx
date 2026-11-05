"use client";
import { useRef, useState } from "react";
import { ActionDialog } from "@/components/dialog/action-dialog";
import { useActionFailure } from "@/components/dialog/action-failure";
import { useToast } from "@/components/feedback/toast";
import { State } from "@/components/feedback/state";
import { TableSkeleton } from "@/components/feedback/skeleton";
import { DataTable } from "@/components/ui/data-table";
import { DateInput } from "@/components/ui/date-input";
import { FileDrop } from "@/components/ui/file-drop";
import { HelpButton } from "@/components/ui/help-button";
import { Icon } from "@/components/ui/icon";
import { InsideField } from "@/components/ui/inside-field";
import { Select } from "@/components/ui/select";
import { TabBar } from "@/components/ui/tab-bar";
import { claims, useApi } from "@/lib/api";
import type { FormatSettings } from "@/lib/format";
import { functions } from "@/lib/functions";
import { useInFlight } from "@/lib/hooks/use-in-flight";
import { saveBlob } from "@/features/record/dynamic-form/api";
import type { SignOffView } from "@/shared/claims/unit-record";
import {
  DynamicForm,
  type DynamicFormHandle,
} from "@/features/record/dynamic-form/dynamic-form";
import type { UnitSignOffList } from "../types";
import { useRecordAudit } from "@/features/record/shell/record-frame";
import styles from "./summary.module.css";

type Format = FormatSettings & { currency?: string };
type Row = UnitSignOffList["rows"][number];
const day = (v: string, format?: Format) =>
  v ? functions.format.dateDisplay(v, format) : "";
// Legacy's literal toasts (saveStakeholder); meetings and documents had none on success.
const SAVED: Record<SignOffView, [string, string]> = {
  stakeholders: [
    "Stakeholder added successfully!",
    "Stakeholder updated successfully!",
  ],
  meetings: ["", ""],
  documents: ["", ""],
};

/**
 * The sign-off tabs (legacy signOffTabs): each list is read when its tab opens. With the list's right on an editable
 * summary: Add, stakeholders edited in their row, meetings and documents in a dialog with one file; Delete.
 */
export function SignOffLists({
  appId,
  tabs,
  assurance,
  format,
}: {
  appId: string;
  tabs: { view: SignOffView; name: string }[];
  /** The Assurance tab's name; the fourth tab, the shared dynamic form. */
  assurance: string;
  format?: Format;
}) {
  const [tab, setTab] = useState<SignOffView | "assurance">(
    tabs[0]?.view ?? "stakeholders",
  );
  return (
    <div id="claims-unit-sign-off">
      <TabBar
        id="claims-unit-sign-off"
        label="Sign-off"
        tabs={[
          ...tabs.map((t) => ({ key: t.view, name: t.name })),
          { key: "assurance" as const, name: assurance },
        ]}
        selected={tab}
        onSelect={setTab}
      />
      <div
        id={`claims-unit-sign-off-panel-${tab}`}
        role="tabpanel"
        aria-labelledby={`claims-unit-sign-off-tab-${tab}`}
      >
        {tab === "assurance" ? (
          <AssurancePanel appId={appId} />
        ) : (
          <ListPanel
            key={tab}
            appId={appId}
            view={tab}
            name={tabs.find((t) => t.view === tab)?.name ?? ""}
            format={format}
          />
        )}
      </div>
    </div>
  );
}

/** One list, read when its tab opens (legacy reads it again on every selection). */
function ListPanel({
  appId,
  view,
  name,
  format,
}: {
  appId: string;
  view: SignOffView;
  name: string;
  format?: Format;
}) {
  const list = useApi(claims.signOffList, { appId, view });
  if (list.error)
    return (
      <State
        id={`claims-unit-${view}-error`}
        title={`Couldn't load ${name}`}
        message={list.error.message}
        retry={list.retry}
      />
    );
  if (!list.data) return <TableSkeleton label={`Loading ${name}`} />;
  return (
    <SignOffList
      appId={appId}
      view={view}
      name={name}
      list={list.data}
      format={format}
      reload={list.retry}
    />
  );
}

/**
 * Legacy Assurance tab: the shared dynamic form (CLAIMS / SUMMARY-ASSURANCE) on the application's ASSURANCE
 * requirement; Submit Assurance (an editable summary only) saves the requirement first, then the answers.
 */
function AssurancePanel({ appId }: { appId: string }) {
  const read = useApi(claims.assurance, appId);
  const toast = useToast(),
    fail = useActionFailure(),
    { run, isActive } = useInFlight(),
    form = useRef<DynamicFormHandle>(null),
    openAudit = useRecordAudit();
  if (read.error)
    return (
      <State
        id="claims-unit-assurance-error"
        title="Couldn't load the assurance"
        message={read.error.message}
        retry={read.retry}
      />
    );
  if (!read.data) return <TableSkeleton label="Loading assurance" />;
  const view = read.data;
  const submit = () =>
    void run(async () => {
      const f = form.current;
      if (!f || !f.check()) return;
      const saved = await claims.saveAssurance(appId);
      if (!saved.ok) return fail(saved.error);
      if (!(await f.save(saved.data.requirementId))) return;
      toast.show("success", view.texts.saved);
      if (view.requirementId === null) read.retry();
    }, "submit");
  return (
    <div id="claims-unit-assurance" className={styles.signOffList}>
      <DynamicForm
        ref={form}
        objectType="CLAIMS"
        slot="SUMMARY-ASSURANCE"
        parentId={appId}
        objectId={view.requirementId ?? undefined}
        editable={view.editable}
      />
      {view.audit && view.requirementId && (
        <div className={styles.signOffBar}>
          <button
            type="button"
            id="claims-unit-assurance-audit"
            className={`gn-btn gn-btn--outlined ${styles.pushEnd}`}
            onClick={() =>
              openAudit({ page: "summary-assurance", title: view.audit! })
            }
          >
            <Icon name="audits" size={14} />
            {view.audit}
          </button>
        </div>
      )}
      {view.editable && (
        <div className={styles.goalActions}>
          <button
            type="button"
            id="claims-unit-assurance-submit"
            className="gn-btn gn-btn--primary"
            disabled={isActive("submit")}
            onClick={submit}
          >
            {view.texts.submit}
          </button>
        </div>
      )}
    </div>
  );
}

function SignOffList({
  appId,
  view,
  name,
  list,
  format,
  reload,
}: {
  appId: string;
  view: SignOffView;
  name: string;
  list: UnitSignOffList;
  format?: Format;
  reload: () => void;
}) {
  const id = `claims-unit-${view}`;
  const toast = useToast(),
    fail = useActionFailure(),
    { run, isActive } = useInFlight(),
    // A stakeholder edited in its row; a meeting or document (or a new row) in the dialog.
    [inline, setInline] = useState<{
      key: string;
      values: Record<string, string>;
    } | null>(null),
    [dialog, setDialog] = useState<Row | "new" | null>(null);
  const manage = list.manage;
  const busy = isActive("save") || isActive("delete");
  const save = (
    values: Record<string, string>,
    row?: string,
    file?: File | null,
  ) =>
    run(async () => {
      const result = await claims.saveSignOff(
        appId,
        view,
        { ...values, ...(row ? { row } : {}) },
        file,
      );
      if (!result.ok) {
        fail(result.error);
        return false;
      }
      const [added, updated] = SAVED[view];
      const text = result.data.saved === "created" ? added : updated;
      if (text) toast.show("success", text);
      setInline(null);
      setDialog(null);
      reload();
      return true;
    }, "save");
  const remove = (r: Row) =>
    void run(async () => {
      const result = await claims.deleteSignOff(appId, view, r.key);
      if (!result.ok) return fail(result.error);
      reload();
    }, "delete");
  const open = (r: Row) =>
    void run(async () => {
      const result = await claims.signOffFile(appId, view, r.key);
      if (!result.ok) return fail(result.error);
      saveBlob(result.data.blob, r.attachment?.name ?? result.data.filename);
    }, `file-${r.key}`);
  const exportFile = (report: "list" | "sign-in") =>
    void run(async () => {
      const result = await claims.exportStakeholders(appId, report);
      if (!result.ok) return fail(result.error);
      saveBlob(result.data.blob, result.data.filename);
    }, `export-${report}`);
  // The table's columns carry the stakeholder row's inputs while it is edited (legacy editRow).
  const fieldOf = (header: string) =>
    ({
      "first-name": "first",
      "last-name": "last",
      email: "email",
      role: "role",
    })[header];
  return (
    <div className={styles.signOffList}>
      {(manage || list.exports) && (
        <div className={styles.signOffBar}>
          {manage && (
            <button
              type="button"
              id={`${id}-add`}
              className="gn-btn gn-btn--outlined"
              disabled={busy}
              onClick={() => setDialog("new")}
            >
              <Icon name="plus" size={14} />
              {manage.add}
            </button>
          )}
          {list.exports && (
            <div className={styles.signOffExports}>
              <button
                type="button"
                id={`${id}-export`}
                className="gn-btn gn-btn--solid"
                disabled={isActive("export-list")}
                onClick={() => exportFile("list")}
              >
                {list.exports.list}
              </button>
              <button
                type="button"
                id={`${id}-sign-in-sheet`}
                className="gn-btn gn-btn--solid"
                disabled={isActive("export-sign-in")}
                onClick={() => exportFile("sign-in")}
              >
                {list.exports.signIn}
              </button>
            </div>
          )}
        </div>
      )}
      <DataTable
        id={`${id}-table`}
        rowIds={id}
        label={name}
        rows={list.rows}
        rowKey={(r) => r.key}
        empty={list.empty}
        columns={list.headers.map((h) => ({
          id: h.key,
          header: (
            <>
              {h.label}
              <HelpButton id={`${id}-${h.key}-help`} html={h.help} />
            </>
          ),
          cell: (r: Row) => {
            const field = fieldOf(h.key);
            if (inline?.key === r.key && field)
              return (
                <input
                  id={`${id}-${functions.ids.idPart(r.key)}-${field}`}
                  aria-label={h.label}
                  value={inline.values[field] ?? ""}
                  disabled={busy}
                  onChange={(e) =>
                    setInline((x) =>
                      x
                        ? {
                            ...x,
                            values: { ...x.values, [field]: e.target.value },
                          }
                        : x,
                    )
                  }
                />
              );
            if (h.key.endsWith("-attachment"))
              return r.attachment ? (
                <button
                  type="button"
                  id={`${id}-${functions.ids.idPart(r.key)}-file`}
                  className={styles.fileLink}
                  title={r.attachment.name}
                  disabled={isActive(`file-${r.key}`)}
                  onClick={() => open(r)}
                >
                  {r.attachment.name}
                </button>
              ) : (
                r.cells[h.key]
              );
            return list.dates.includes(h.key)
              ? day(r.cells[h.key], format)
              : r.cells[h.key];
          },
        }))}
        actions={
          manage
            ? [
                {
                  id: "edit",
                  icon: "edit",
                  label: () => "Edit",
                  hidden: (r) => inline?.key === r.key,
                  disabled: () => busy,
                  onClick: (r) =>
                    manage.inline
                      ? setInline({ key: r.key, values: r.values })
                      : setDialog(r),
                },
                {
                  id: "delete",
                  icon: "trash",
                  label: () => "Delete",
                  hidden: (r) => inline?.key === r.key,
                  disabled: () => busy,
                  onClick: remove,
                },
                {
                  id: "save",
                  icon: "check",
                  label: () => "Save",
                  hidden: (r) => inline?.key !== r.key,
                  disabled: () => busy,
                  onClick: (r) => inline && void save(inline.values, r.key),
                },
                {
                  id: "cancel",
                  icon: "close",
                  label: () => "Cancel",
                  hidden: (r) => inline?.key !== r.key,
                  disabled: () => busy,
                  onClick: () => setInline(null),
                },
              ]
            : undefined
        }
      />
      {manage && dialog && (
        <SignOffDialog
          id={`${id}-dialog`}
          manage={manage}
          row={dialog === "new" ? null : dialog}
          busy={busy}
          onClose={() => setDialog(null)}
          onSave={(values, file) =>
            void save(values, dialog === "new" ? undefined : dialog.key, file)
          }
        />
      )}
    </div>
  );
}

/** Legacy stakeholderDialog / meetingsDialog / orgChartDialog: the row's fields, one file for meetings and documents. */
function SignOffDialog({
  id,
  manage,
  row,
  busy,
  onClose,
  onSave,
}: {
  id: string;
  manage: NonNullable<UnitSignOffList["manage"]>;
  row: Row | null;
  busy: boolean;
  onClose: () => void;
  onSave: (values: Record<string, string>, file: File | null) => void;
}) {
  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      manage.fields
        .filter((f) => f.kind !== "file")
        .map((f) => [f.key, row?.values[f.key] ?? ""]),
    ),
  );
  const [file, setFile] = useState<File | null>(null);
  const set = (key: string, value: string) =>
    setValues((v) => ({ ...v, [key]: value }));
  return (
    <ActionDialog
      id={id}
      title={manage.title}
      width="50vw"
      busy={busy}
      onClose={onClose}
    >
      <form
        id={`${id}-form`}
        className={styles.signOffForm}
        onSubmit={(e) => {
          e.preventDefault();
          onSave(values, file);
        }}
      >
        <div className={styles.fields}>
          {manage.fields.map((f) => {
            const fieldId = `${id}-${f.key}`;
            if (f.kind === "file")
              return (
                <div key={f.key} className={styles.wideField}>
                  <FileDrop
                    id={fieldId}
                    file={file}
                    disabled={busy}
                    onPick={(picked) => setFile(picked ?? null)}
                  />
                  {!file && row?.attachment && (
                    <span className={styles.currentFile}>
                      {row.attachment.name}
                    </span>
                  )}
                </div>
              );
            return (
              <InsideField
                key={f.key}
                htmlFor={f.kind === "select" ? `${fieldId}-trigger` : fieldId}
                label={f.label}
                filled={values[f.key] !== ""}
              >
                {f.kind === "select" ? (
                  <Select
                    id={fieldId}
                    label={f.label}
                    options={manage.options}
                    value={values[f.key]}
                    disabled={busy}
                    onChange={(next) => set(f.key, next)}
                  />
                ) : f.kind === "date" ? (
                  <DateInput
                    id={fieldId}
                    value={values[f.key]}
                    disabled={busy}
                    onChange={(next) => set(f.key, next)}
                  />
                ) : (
                  <input
                    id={fieldId}
                    value={values[f.key]}
                    disabled={busy}
                    onChange={(e) => set(f.key, e.target.value)}
                  />
                )}
              </InsideField>
            );
          })}
        </div>
        <div className={styles.formActions}>
          <button
            type="submit"
            id={`${id}-save`}
            className="gn-btn gn-btn--primary"
            disabled={busy}
          >
            {manage.save}
          </button>
        </div>
      </form>
    </ActionDialog>
  );
}
