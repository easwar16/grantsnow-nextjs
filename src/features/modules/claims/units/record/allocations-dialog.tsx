"use client";
import { useState } from "react";
import { ActionDialog } from "@/components/dialog/action-dialog";
import { useActionFailure } from "@/components/dialog/action-failure";
import { useToast } from "@/components/feedback/toast";
import { State } from "@/components/feedback/state";
import { TableSkeleton } from "@/components/feedback/skeleton";
import { DataTable } from "@/components/ui/data-table";
import { DateInput } from "@/components/ui/date-input";
import { HelpButton } from "@/components/ui/help-button";
import { Icon } from "@/components/ui/icon";
import { InsideField } from "@/components/ui/inside-field";
import { Select } from "@/components/ui/select";
import { claims, useApi } from "@/lib/api";
import type { FormatSettings } from "@/lib/format";
import { functions } from "@/lib/functions";
import { useInFlight } from "@/lib/hooks/use-in-flight";
import type { UnitAllocationRow, UnitAllocationsView } from "../types";
import styles from "./summary.module.css";

type Format = FormatSettings & { currency?: string };
/** The add / edit form's values, as the controls hold them (the date as the picker's yyyy-MM-dd). */
interface Draft {
  type: string;
  date: string;
  amount: string;
}
const BLANK: Draft = { type: "", date: "", amount: "" };
const draftOf = (r: UnitAllocationRow): Draft => ({
  type: r.type,
  date: r.date.slice(0, 10),
  amount: r.amount === null ? "" : String(r.amount),
});

/**
 * Legacy fundAllocationDialog: Add New opens the add form above the table; a row's Edit edits it in place (status
 * stays read-only); every change reads the list again. Closing reads the Fund Summary again (`onClose`).
 */
export function AllocationsDialog({
  appId,
  fund,
  format,
  onClose,
}: {
  appId: string;
  fund: string;
  format?: Format;
  onClose: () => void;
}) {
  const id = "claims-unit-allocations";
  const list = useApi(claims.allocations, { appId, fund });
  const view = list.data;
  if (!view)
    return (
      <ActionDialog
        id={id}
        title=""
        width="50vw"
        className={styles.allocationsDialog}
        onClose={onClose}
      >
        {list.error ? (
          <State
            id={`${id}-error`}
            title="Couldn't load the allocations"
            message={list.error.message}
            retry={list.retry}
          />
        ) : (
          <TableSkeleton label="Loading allocations" />
        )}
      </ActionDialog>
    );
  return (
    <Allocations
      id={id}
      appId={appId}
      fund={fund}
      view={view}
      format={format}
      reload={list.retry}
      onClose={onClose}
    />
  );
}

function Allocations({
  id,
  appId,
  fund,
  view,
  format,
  reload,
  onClose,
}: {
  id: string;
  appId: string;
  fund: string;
  view: UnitAllocationsView;
  format?: Format;
  reload: () => void;
  onClose: () => void;
}) {
  const toast = useToast(),
    fail = useActionFailure(),
    { run, isActive } = useInFlight(),
    [adding, setAdding] = useState(false),
    [draft, setDraft] = useState<Draft>(BLANK),
    [edit, setEdit] = useState<{ key: string; draft: Draft } | null>(null);
  const busy = isActive("save") || isActive("delete");
  const name = (options: { value: string; label: string }[], code: string) =>
    options.find((o) => o.value === code)?.label ?? "";
  // Legacy cancelEditAllocation: the form closes and the list is read again.
  const done = () => {
    setAdding(false);
    setDraft(BLANK);
    setEdit(null);
    reload();
  };
  const save = (value: Draft, allocId?: string) =>
    void run(async () => {
      if (value.amount !== "" && Number(value.amount) < 0)
        return toast.show("error", view.texts.negative, undefined, false);
      const result = await claims.saveAllocation(appId, {
        fund,
        ...(allocId ? { allocId } : {}),
        ...value,
      });
      if (!result.ok) return fail(result.error);
      toast.show(
        "success",
        result.data.saved === "created"
          ? view.texts.created
          : view.texts.updated,
      );
      done();
    }, "save");
  const remove = (allocId: string) =>
    void run(async () => {
      const result = await claims.deleteAllocation(appId, { fund, allocId });
      if (!result.ok) return fail(result.error);
      reload();
    }, "delete");

  const typeSelect = (
    fieldId: string,
    value: Draft,
    set: (d: Draft) => void,
    label: string,
  ) => (
    <Select
      id={fieldId}
      label={label}
      options={view.types}
      value={value.type}
      disabled={busy}
      onChange={(type) => set({ ...value, type })}
    />
  );
  const dateInput = (
    fieldId: string,
    value: Draft,
    set: (d: Draft) => void,
    label?: string,
  ) => (
    <DateInput
      id={fieldId}
      label={label}
      value={value.date}
      disabled={busy}
      onChange={(date) => set({ ...value, date })}
    />
  );
  const amountInput = (
    fieldId: string,
    value: Draft,
    set: (d: Draft) => void,
    label?: string,
  ) => (
    <input
      id={fieldId}
      type="number"
      min={0}
      step="any"
      aria-label={label}
      value={value.amount}
      disabled={busy}
      onChange={(e) => set({ ...value, amount: e.target.value })}
    />
  );
  const editing = (r: UnitAllocationRow) => edit?.key === r.key;
  const setEditDraft = (d: Draft) =>
    setEdit((e) => (e ? { ...e, draft: d } : e));
  const header = (key: keyof UnitAllocationsView["headers"]) => (
    <>
      {view.headers[key].label}
      <HelpButton id={`${id}-${key}-help`} html={view.headers[key].help} />
    </>
  );

  return (
    <ActionDialog
      id={id}
      title={view.title}
      width="50vw" /* legacy fundAllocationDialog: 50vw */
      className={styles.allocationsDialog}
      busy={busy}
      onClose={onClose}
    >
      <div className={styles.allocations}>
        <div>
          <button
            type="button"
            id={`${id}-add-new`}
            className="gn-btn gn-btn--outlined"
            disabled={busy || adding}
            onClick={() => {
              setEdit(null);
              setDraft(BLANK);
              setAdding(true);
            }}
          >
            <Icon name="plus" size={14} />
            {view.texts.addNew}
          </button>
        </div>
        {adding && (
          <form
            id={`${id}-form`}
            className={styles.allocationForm}
            onSubmit={(e) => {
              e.preventDefault();
              save(draft);
            }}
          >
            <div className={styles.fields}>
              <InsideField
                htmlFor={`${id}-type-trigger`}
                label={view.labels.type}
                filled={draft.type !== ""}
              >
                {typeSelect(`${id}-type`, draft, setDraft, view.labels.type)}
              </InsideField>
              <InsideField
                htmlFor={`${id}-date`}
                label={view.labels.date}
                filled={draft.date !== ""}
              >
                {dateInput(`${id}-date`, draft, setDraft)}
              </InsideField>
              <InsideField
                htmlFor={`${id}-amount`}
                label={view.labels.amount}
                filled={draft.amount !== ""}
              >
                {amountInput(`${id}-amount`, draft, setDraft)}
              </InsideField>
            </div>
            <div className={styles.formActions}>
              <button
                type="button"
                id={`${id}-cancel`}
                className="gn-btn gn-btn--danger"
                disabled={busy}
                onClick={() => {
                  setAdding(false);
                  setDraft(BLANK);
                }}
              >
                {view.texts.cancel}
              </button>
              <button
                type="submit"
                id={`${id}-add`}
                className="gn-btn gn-btn--primary"
                disabled={busy}
              >
                {view.texts.add}
              </button>
            </div>
          </form>
        )}
        <DataTable
          id={`${id}-table`}
          rowIds={`${id}-row`}
          label={view.title}
          height="dialog"
          rows={view.rows}
          rowKey={(r) => r.key}
          empty={view.empty}
          columns={[
            {
              id: "type",
              header: header("type"),
              rowHeader: true,
              cell: (r) =>
                editing(r) && edit
                  ? typeSelect(
                      `${id}-row-${r.key}-type`,
                      edit.draft,
                      setEditDraft,
                      view.headers.type.label,
                    )
                  : name(view.types, r.type),
            },
            {
              id: "status",
              header: header("status"),
              cell: (r) => name(view.statuses, r.status),
            },
            {
              id: "date",
              header: header("date"),
              cell: (r) =>
                editing(r) && edit
                  ? dateInput(
                      `${id}-row-${r.key}-date`,
                      edit.draft,
                      setEditDraft,
                      view.headers.date.label,
                    )
                  : r.date
                    ? functions.format.dateDisplay(r.date, format)
                    : "",
            },
            {
              id: "amount",
              header: header("amount"),
              cell: (r) =>
                editing(r) && edit
                  ? amountInput(
                      `${id}-row-${r.key}-amount`,
                      edit.draft,
                      setEditDraft,
                      view.headers.amount.label,
                    )
                  : r.amount === null
                    ? ""
                    : functions.format.moneyDisplay(
                        String(r.amount),
                        format?.currency,
                        format,
                      ),
            },
          ]}
          actions={[
            {
              id: "edit",
              icon: "edit",
              label: () => "Edit",
              hidden: (r) => editing(r),
              disabled: () => busy,
              onClick: (r) => {
                setAdding(false);
                setEdit({ key: r.key, draft: draftOf(r) });
              },
            },
            {
              id: "delete",
              icon: "trash",
              label: () => "Delete",
              hidden: (r) => editing(r),
              disabled: () => busy,
              onClick: (r) => remove(r.key),
            },
            {
              id: "save",
              icon: "check",
              label: () => "Save",
              hidden: (r) => !editing(r),
              disabled: () => busy,
              onClick: (r) => edit && save(edit.draft, r.key),
            },
            {
              id: "cancel",
              icon: "close",
              label: () => "Cancel",
              hidden: (r) => !editing(r),
              disabled: () => busy,
              onClick: done,
            },
          ]}
        />
      </div>
    </ActionDialog>
  );
}
