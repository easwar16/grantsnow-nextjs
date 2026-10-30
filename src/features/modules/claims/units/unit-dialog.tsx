"use client";
import { useEffect, useEffectEvent, useState } from "react";
import { Select } from "@/components/ui/select";
import { DateInput } from "@/components/ui/date-input";
import { DataTable } from "@/components/ui/data-table";
import { Skeleton } from "@/components/feedback/skeleton";
import { useToast } from "@/components/feedback/toast";
import { ActionDialog } from "@/components/dialog/action-dialog";
import {
  useActionFailure,
  type ActionError,
} from "@/components/dialog/action-failure";
import { useInFlight } from "@/lib/hooks/use-in-flight";
import { claims } from "@/lib/api";
import { functions } from "@/lib/functions";
import type {
  FundTypeOption,
  GrantOption,
  UnitDialogField,
  UnitDialogSetup,
  UnitFund,
  UnitRow,
} from "./types";
import styles from "@/components/dialog/dialog.module.css";

type Option = { value: string; label: string };
/** A fund in the dialog's table; `saved` is its index on the listing row, null for one added here. */
type Fund = Pick<
  UnitFund,
  | "fundTypeId"
  | "name"
  | "start"
  | "end"
  | "amendmentDate"
  | "claimDate"
  | "grantId"
  | "grantName"
  | "paymentAccount"
  | "status"
> & { saved: number | null };
const BLANK: Fund = {
  saved: null,
  fundTypeId: "",
  name: "",
  start: "",
  end: "",
  amendmentDate: "",
  claimDate: "",
  grantId: "",
  grantName: "",
  paymentAccount: "",
  status: "",
};
// Legacy disables a saved fund's Edit and Delete outside these statuses.
const OPEN = ["DRFT", "REWORK"];
const locked = (f: Fund) => f.status !== "" && !OPEN.includes(f.status);
const sameFund = (a: Fund, b: Fund) =>
  a.fundTypeId === b.fundTypeId && a.grantId === b.grantId;
/** Legacy getPaymentAccounts: the distinct accounts of the loaded grants. */
const accountsOf = (grants: GrantOption[]): Option[] =>
  [...new Set(grants.map((g) => g.paymentAccount).filter(Boolean))].map(
    (a) => ({
      value: a,
      label: a,
    }),
  );

/**
 * Legacy createUnitDialog: a new unit application, or an update of one (Edit on the listing: unit, year and program
 * fixed). Funds are added from the form and edited or removed in the table; Grant and Payment Account follow 9342.
 */
export function UnitDialog({
  id,
  row,
  orgs,
  years,
  onClose,
  onSaved,
}: {
  id: string;
  row?: UnitRow;
  orgs: Option[];
  years: Option[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const editing = row !== undefined;
  const [setup, setSetup] = useState<UnitDialogSetup>(),
    [unit, setUnit] = useState(row?.unitId ?? ""),
    [year, setYear] = useState(
      row?.fiscalYear ?? String(new Date().getFullYear()),
    ),
    [program, setProgram] = useState(row?.programType ?? ""),
    [types, setTypes] = useState<FundTypeOption[]>([]),
    // Keyed by fund type, so a slower reply for an earlier one never replaces the current one's grants.
    [grantList, setGrantList] = useState<{ type: string; list: GrantOption[] }>(
      { type: "", list: [] },
    ),
    [draft, setDraft] = useState<Fund>(BLANK),
    [funds, setFunds] = useState<Fund[]>(
      () => row?.funds.map((f, i) => ({ ...f, saved: i })) ?? [],
    ),
    [edit, setEdit] = useState<{ index: number; fund: Fund } | null>(null),
    { run, isActive } = useInFlight(),
    toast = useToast(),
    fail = useActionFailure(),
    saving = isActive("save");
  const grants = grantList.list;
  const setupFailed = useEffectEvent((error: ActionError) => {
    toast.error(error);
    onClose();
  });
  const typesFailed = useEffectEvent((error: ActionError) =>
    toast.error(error),
  );
  useEffect(() => {
    let live = true;
    claims.unitDialog().then((r) => {
      if (!live) return;
      if (!r.ok) return setupFailed(r.error);
      setSetup(r.data);
    });
    // An update opens on its own program type's fund types (legacy editUnitInquiry).
    if (row?.programType)
      claims.fundTypes(row.programType).then((r) => {
        if (!live) return;
        if (!r.ok) return typesFailed(r.error);
        setTypes(r.data);
      });
    return () => {
      live = false;
    };
  }, [row?.programType]);

  /** Legacy loadFundTypes, on the program type's change. */
  async function loadTypes(code: string) {
    setTypes([]);
    if (!code) return;
    const r = await claims.fundTypes(code);
    if (!r.ok) return toast.error(r.error);
    setTypes(r.data);
  }
  /** Legacy loadGrantValues: the fund type's grants; `pick` takes the first when the backend says auto_select. */
  async function loadGrants(
    fundTypeId: string,
    pick?: (g: GrantOption) => void,
  ) {
    setGrantList({ type: fundTypeId, list: [] });
    if (!fundTypeId || !(setup?.grant.show || setup?.account.show)) return;
    const r = await claims.grants(fundTypeId, year);
    if (!r.ok) return toast.error(r.error);
    setGrantList((s) =>
      s.type === fundTypeId ? { type: fundTypeId, list: r.data.grants } : s,
    );
    if (pick && r.data.autoSelect && r.data.grants[0]) pick(r.data.grants[0]);
  }
  const withGrant = (f: Fund, g?: GrantOption): Fund => ({
    ...f,
    grantId: g?.value ?? "",
    grantName: g?.label ?? "",
    paymentAccount: g?.paymentAccount ?? "",
  });

  if (!setup)
    return (
      <ActionDialog id={id} title="" width="50vw" onClose={onClose}>
        <Skeleton kind="lines" count={4} label="Loading unit options" />
      </ActionDialog>
    );
  const { labels, headers, texts } = setup;
  const typeName = (fundTypeId: string) =>
    types.find((t) => t.value === fundTypeId)?.label ?? "";

  function addFund() {
    if (!draft.fundTypeId) return;
    if (funds.some((f) => sameFund(f, draft)))
      return toast.show("error", texts.duplicate);
    setFunds((all) => [...all, { ...draft, name: typeName(draft.fundTypeId) }]);
    setDraft(BLANK);
  }
  function saveRow() {
    if (!edit) return;
    if (funds.some((f, i) => i !== edit.index && sameFund(f, edit.fund)))
      return toast.show("error", texts.duplicate);
    const name = typeName(edit.fund.fundTypeId) || edit.fund.name;
    setFunds((all) =>
      all.map((f, i) => (i === edit.index ? { ...edit.fund, name } : f)),
    );
    setEdit(null);
  }
  const save = () =>
    run(async () => {
      const result = await claims.saveUnit({
        appId: row ? Number(row.id) : null,
        unitId: unit,
        fiscalYear: year,
        programType: program,
        funds: funds.map((f) => ({
          saved: f.saved,
          fundTypeId: f.fundTypeId,
          start: f.start,
          end: f.end,
          amendmentDate: f.amendmentDate,
          claimDate: f.claimDate,
          grantId: f.grantId,
          paymentAccount: f.paymentAccount,
        })),
      });
      if (!result.ok) return fail(result.error);
      toast.show("success", texts.saved);
      onSaved();
      onClose();
    }, "save");

  const field = (
    k: UnitDialogField,
    control: React.ReactNode,
    required?: boolean,
  ) => (
    <div className={`gn-field ${styles.cell}`}>
      <label
        className="gn-label"
        htmlFor={`${id}-${functions.ids.idPart(k)}-trigger`}
      >
        {labels[k]}
        {required ? " *" : ""}
      </label>
      {control}
    </div>
  );
  const select = (
    k: UnitDialogField,
    options: Option[],
    value: string,
    onChange: (next: string) => void,
    disabled = false,
    required = false,
  ) =>
    field(
      k,
      <Select
        id={`${id}-${functions.ids.idPart(k)}`}
        label={labels[k]}
        options={options}
        value={value}
        disabled={saving || disabled}
        onChange={onChange}
      />,
      required,
    );
  const date = (
    k: "start" | "end" | "amendmentDate" | "claimDate",
    f: Fund,
    set: (next: Fund) => void,
    cellId: string,
    label?: string,
  ) => (
    <DateInput
      id={cellId}
      label={label}
      value={f[k]}
      min={k === "start" ? undefined : f.start || undefined}
      max={k === "end" ? undefined : f.end || undefined}
      disabled={saving || !f.fundTypeId}
      onChange={(v) => set({ ...f, [k]: v })}
    />
  );
  const draftDate = (k: "start" | "end" | "amendmentDate" | "claimDate") =>
    field(
      k,
      date(k, draft, setDraft, `${id}-${functions.ids.idPart(k)}`, labels[k]),
    );

  const rowEditing = (i: number) => edit?.index === i;
  const editFund = edit?.fund;
  const setEditFund = (fund: Fund) => setEdit((e) => (e ? { ...e, fund } : e));
  const cellDate = (
    k: "start" | "end" | "amendmentDate" | "claimDate",
    i: number,
    f: Fund,
  ) =>
    rowEditing(i) && editFund
      ? date(
          k,
          editFund,
          setEditFund,
          `${id}-fund-${i}-${functions.ids.idPart(k)}`,
          headers[k],
        )
      : f[k] && functions.format.dateDisplay(f[k]);

  return (
    <ActionDialog
      id={id}
      title={editing ? texts.updateTitle : texts.createTitle}
      width="50vw" /* legacy createUnitDialog width: 50vw */
      busy={saving}
      onClose={onClose}
    >
      <form
        id={`${id}-form`}
        className={styles.convert}
        style={{ "--cols": 2 } as React.CSSProperties}
        onSubmit={(e) => {
          e.preventDefault();
          save();
        }}
      >
        {select("unit", orgs, unit, setUnit, editing)}
        {select("year", years, year, setYear, editing)}
        {select(
          "program",
          setup.programs,
          program,
          (next) => {
            setProgram(next);
            loadTypes(next);
          },
          editing,
        )}
        {select(
          "fundType",
          types,
          draft.fundTypeId,
          (next) => {
            setDraft((d) => withGrant({ ...d, fundTypeId: next }));
            loadGrants(next, (g) =>
              setDraft((d) => (d.fundTypeId === next ? withGrant(d, g) : d)),
            );
          },
          !program,
        )}
        {setup.grant.show &&
          select(
            "grant",
            grants,
            draft.grantId,
            (next) =>
              setDraft((d) =>
                withGrant(
                  d,
                  grants.find((g) => g.value === next),
                ),
              ),
            !draft.fundTypeId,
            setup.grant.required,
          )}
        {setup.account.show &&
          select(
            "account",
            accountsOf(grants),
            draft.paymentAccount,
            (next) => setDraft((d) => ({ ...d, paymentAccount: next })),
            !draft.fundTypeId,
            setup.account.required,
          )}
        {draftDate("start")}
        {draftDate("end")}
        {draftDate("amendmentDate")}
        {draftDate("claimDate")}
        <div className={styles.wide}>
          <button
            type="button"
            id={`${id}-add-fund`}
            className="gn-btn gn-btn--outlined"
            disabled={saving}
            onClick={addFund}
          >
            {texts.addFund}
          </button>
        </div>
        {funds.length > 0 && (
          <div className={styles.wide}>
            <DataTable
              id={`${id}-funds`}
              rowIds={`${id}-fund`}
              label={headers.fund}
              height="dialog"
              rows={funds.map((f, i) => ({ f, i }))}
              rowKey={({ i }) => String(i)}
              columns={[
                {
                  id: "fund",
                  header: headers.fund,
                  rowHeader: true,
                  cell: ({ f, i }) =>
                    rowEditing(i) && editFund ? (
                      <Select
                        id={`${id}-fund-${i}-type`}
                        label={headers.fund}
                        options={types}
                        value={editFund.fundTypeId}
                        disabled={saving}
                        onChange={(next) => {
                          setEditFund(
                            withGrant({ ...editFund, fundTypeId: next }),
                          );
                          loadGrants(next, (g) =>
                            setEdit((e) =>
                              e && e.fund.fundTypeId === next
                                ? { ...e, fund: withGrant(e.fund, g) }
                                : e,
                            ),
                          );
                        }}
                      />
                    ) : (
                      typeName(f.fundTypeId) || f.name
                    ),
                },
                {
                  id: "start",
                  header: headers.start,
                  cell: ({ f, i }) => cellDate("start", i, f),
                },
                {
                  id: "end",
                  header: headers.end,
                  cell: ({ f, i }) => cellDate("end", i, f),
                },
                {
                  id: "amendment",
                  header: headers.amendmentDate,
                  cell: ({ f, i }) => cellDate("amendmentDate", i, f),
                },
                {
                  id: "claim",
                  header: headers.claimDate,
                  cell: ({ f, i }) => cellDate("claimDate", i, f),
                },
                ...(setup.grant.show
                  ? [
                      {
                        id: "grant",
                        header: headers.grant,
                        cell: ({ f, i }: { f: Fund; i: number }) =>
                          rowEditing(i) && editFund ? (
                            <Select
                              id={`${id}-fund-${i}-grant`}
                              label={headers.grant}
                              options={grants}
                              value={editFund.grantId}
                              disabled={saving}
                              onChange={(next) =>
                                setEditFund(
                                  withGrant(
                                    editFund,
                                    grants.find((g) => g.value === next),
                                  ),
                                )
                              }
                            />
                          ) : (
                            f.grantName || f.grantId
                          ),
                      },
                    ]
                  : []),
                ...(setup.account.show
                  ? [
                      {
                        id: "account",
                        header: headers.account,
                        cell: ({ f, i }: { f: Fund; i: number }) =>
                          rowEditing(i) && editFund ? (
                            <Select
                              id={`${id}-fund-${i}-account`}
                              label={headers.account}
                              options={accountsOf(grants)}
                              value={editFund.paymentAccount}
                              disabled={saving}
                              onChange={(next) =>
                                setEditFund({
                                  ...editFund,
                                  paymentAccount: next,
                                })
                              }
                            />
                          ) : (
                            f.paymentAccount
                          ),
                      },
                    ]
                  : []),
              ]}
              actions={[
                {
                  id: "edit",
                  icon: "edit",
                  label: () => "Edit",
                  hidden: ({ i }) => rowEditing(i),
                  disabled: ({ f }) => saving || locked(f),
                  onClick: ({ f, i }) => {
                    setEdit({ index: i, fund: f });
                    // The row's Grant lists its own fund type's grants.
                    loadGrants(f.fundTypeId);
                  },
                },
                {
                  id: "delete",
                  icon: "trash",
                  label: () => "Delete",
                  hidden: ({ i }) => rowEditing(i),
                  disabled: ({ f }) => saving || locked(f),
                  onClick: ({ i }) =>
                    setFunds((all) => all.filter((_, j) => j !== i)),
                },
                {
                  id: "save",
                  icon: "save",
                  label: () => "Save",
                  hidden: ({ i }) => !rowEditing(i),
                  disabled: () => saving,
                  onClick: saveRow,
                },
                {
                  id: "cancel",
                  icon: "cancel",
                  label: () => "Cancel",
                  hidden: ({ i }) => !rowEditing(i),
                  disabled: () => saving,
                  onClick: () => setEdit(null),
                },
              ]}
              empty={texts.empty}
            />
          </div>
        )}
        <div className={styles.foot}>
          <button
            type="button"
            id={`${id}-cancel`}
            className="gn-btn gn-btn--outlined"
            disabled={saving}
            onClick={onClose}
          >
            {texts.cancel}
          </button>
          <button
            type="submit"
            id={`${id}-save`}
            className="gn-btn gn-btn--primary"
            disabled={saving}
          >
            {editing ? texts.update : texts.create}
          </button>
        </div>
      </form>
    </ActionDialog>
  );
}
