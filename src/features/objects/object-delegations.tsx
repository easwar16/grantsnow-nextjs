"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { State } from "@/components/feedback/state";
import { useFormat } from "@/components/layout/shell-context";
import { DateInput } from "@/components/ui/date-input";
import { Icon } from "@/components/ui/icon";
import { InsideField } from "@/components/ui/inside-field";
import {
  MultiSelect,
  type MultiSelectOption,
} from "@/components/ui/multi-select";
import { dateDisplay } from "@/lib/format";
import { idPart } from "@/lib/ids";
import { useInFlight } from "@/lib/use-in-flight";
import {
  ActionDialog,
  useConfirm,
} from "@/features/opportunities/components/actions/action-dialog";
import { useActionFailure } from "@/features/opportunities/components/actions/request";
import dialogStyles from "@/features/opportunities/components/actions/actions.module.css";
import { heldRead, objectCall, type ObjectHost } from "./request";
import type { Delegate, DelegatedPage, DelegationView } from "./types";
import styles from "./history-delegations.module.css";
type Access = Pick<DelegatedPage, "read" | "edit" | "delete">;
/** The dialog's start: a new delegation, or Edit Access on one delegate (their read pages and common rights). */
type Draft = {
  edit: boolean;
  people: MultiSelectOption[];
  users: string[];
  start: string;
  end: string;
  pages: string[];
  access: Access;
};
/**
 * The shared delegations (legacy `object-delegations` fragment): each delegate, collapsed, with their pages grouped
 * by component type and a Read / Edit / Delete switch per page; Add Delegation and Edit Access open one dialog.
 * Every change refreshes the record from the server; switches show the pending value until it arrives.
 */
export function ObjectDelegations({
  id,
  host,
  view,
}: {
  /** The panel's page-unique id; its parts derive theirs from it. */
  id: string;
  host: ObjectHost;
  view: DelegationView;
}) {
  const { texts, gates } = view;
  const router = useRouter(),
    format = useFormat(),
    [, startTransition] = useTransition(),
    { run, isActive } = useInFlight(),
    fail = useActionFailure(),
    confirm = useConfirm(`${id}-delete-confirm`),
    [draft, setDraft] = useState<Draft | null>(null),
    // Pending switch values per delegation row, dropped when the refreshed view arrives.
    [pending, setPending] = useState<Record<string, Access>>({}),
    [shown, setShown] = useState(view);
  if (view !== shown) {
    setShown(view);
    setPending({});
  }
  const refresh = () => startTransition(() => router.refresh());
  const ask = () =>
    confirm.ask({
      title: texts.deleteTitle,
      message: texts.deleteMessage,
      confirm: texts.deleteYes,
      cancel: texts.deleteNo,
      danger: true,
    });
  const toggle = (page: DelegatedPage, type: keyof Access, value: boolean) =>
    run(async () => {
      const result = await objectCall<Access>(
        "POST",
        `delegations/${page.id}`,
        { ...host },
        { type, value },
      );
      if (!result.ok) return fail(result.error);
      setPending((p) => ({ ...p, [page.id]: result.data }));
      refresh();
    }, page.id);
  const remove = (key: string, path: string, query: Record<string, string>) =>
    run(async () => {
      if (!(await ask())) return;
      const result = await objectCall("DELETE", path, { ...host, ...query });
      if (!result.ok) return fail(result.error);
      refresh();
    }, key);
  // The picker's people load before the dialog opens, as Add Status waits for its statuses.
  const openAdd = () =>
    run(async () => {
      const result = await heldRead<MultiSelectOption[]>("delegations/people", {
        ...host,
      });
      if (!result.ok) return fail(result.error);
      setDraft({
        edit: false,
        people: result.data,
        users: [],
        start: "",
        end: "",
        pages: view.catalogue.flatMap((g) =>
          g.pages.filter((p) => p.locked).map((p) => p.name),
        ),
        access: { read: true, edit: false, delete: false },
      });
    }, "add");
  const editAccess = (d: Delegate) => {
    // Legacy getPages / getPagesAccess, over the read pages only (8997's over-correction fixed, KB Shared-Features).
    const pages = d.groups.flatMap((g) => g.pages).filter((p) => p.read);
    const all = (k: keyof Access) =>
      pages.length > 0 && pages.every((p) => p[k]);
    setDraft({
      edit: true,
      // Legacy shows the delegate from the full person list, which the picker's list may lack.
      people: [{ value: d.personId, label: d.name }],
      users: [d.personId],
      start: d.start,
      end: d.end,
      pages: pages.map((p) => p.name),
      access: { read: true, edit: all("edit"), delete: all("delete") },
    });
  };
  const date = (iso: string) => dateDisplay(iso, format);
  return (
    <section id={id} className={styles.panel}>
      <div className={`${styles.head} ${styles.end}`}>
        <button
          type="button"
          id={`${id}-add`}
          className="gn-btn gn-btn--primary"
          disabled={!gates.edit || isActive("add")}
          aria-busy={isActive("add") || undefined}
          onClick={openAdd}
        >
          <Icon name="plus" />
          {texts.add}
        </button>
      </div>
      {view.delegates.length ? (
        <ul id={`${id}-list`} className={styles.delegates}>
          {view.delegates.map((d) => {
            const key = `${id}-${idPart(d.personId)}`;
            return (
              <li key={d.personId} id={key} className="enter-rise">
                <details className={`gn-collapsible ${styles.delegate}`}>
                  <summary className={styles.person}>
                    <span id={`${key}-name`} className={styles.name}>
                      {d.name}
                    </span>
                    <span className={styles.dates}>
                      {gates.from && d.start && (
                        <span id={`${key}-from`}>
                          {texts.from}: {date(d.start)}
                        </span>
                      )}
                      {gates.to && d.end && (
                        <span id={`${key}-to`}>
                          {texts.to}: {date(d.end)}
                        </span>
                      )}
                    </span>
                    {gates.editAccess && (
                      <button
                        type="button"
                        id={`${key}-edit-access`}
                        className="gn-btn gn-btn--borderless"
                        disabled={!gates.edit}
                        onClick={(e) => {
                          e.preventDefault();
                          editAccess(d);
                        }}
                      >
                        <Icon name="pen" />
                        {texts.editAccess}
                      </button>
                    )}
                    {gates.deleteDelegate && (
                      <button
                        type="button"
                        id={`${key}-delete`}
                        className="gn-btn gn-btn--borderless"
                        disabled={!gates.delete || isActive(key)}
                        onClick={(e) => {
                          e.preventDefault();
                          void remove(key, "delegations", {
                            person: d.personId,
                          });
                        }}
                      >
                        <Icon name="trash" />
                        {texts.delete}
                      </button>
                    )}
                  </summary>
                  {d.groups.map((g) => (
                    <details
                      key={g.type}
                      id={`${key}-${idPart(g.type)}`}
                      className={`gn-collapsible ${styles.group}`}
                    >
                      <summary>{g.label}</summary>
                      <ul className={styles.pages}>
                        {g.pages.map((p) => {
                          const rowKey = `${key}-page-${idPart(p.id)}`;
                          const access = pending[p.id] ?? p;
                          const busy = isActive(p.id);
                          const switchOf = (
                            type: keyof Access,
                            text: string,
                            locked = false,
                          ) => (
                            <label className={styles.switch}>
                              <input
                                id={`${rowKey}-${type}`}
                                type="checkbox"
                                role="switch"
                                checked={access[type]}
                                disabled={!gates.edit || locked || busy}
                                onChange={(e) =>
                                  void toggle(p, type, e.currentTarget.checked)
                                }
                              />
                              <span className={styles.track} />
                              {text}
                            </label>
                          );
                          return (
                            <li key={p.id} id={rowKey} className={styles.page}>
                              <span className={styles.pageName}>{p.label}</span>
                              {switchOf("read", texts.read, p.locked)}
                              {switchOf("edit", texts.edit)}
                              {switchOf("delete", texts.delete)}
                              <button
                                type="button"
                                id={`${rowKey}-remove`}
                                className="gn-btn gn-btn--borderless"
                                disabled={!gates.delete || p.locked || busy}
                                onClick={() =>
                                  void remove(p.id, `delegations/${p.id}`, {})
                                }
                              >
                                <Icon name="close-circle" />
                                {texts.remove}
                              </button>
                            </li>
                          );
                        })}
                      </ul>
                    </details>
                  ))}
                </details>
              </li>
            );
          })}
        </ul>
      ) : (
        <State id={`${id}-empty`} title={texts.noData} />
      )}
      {draft && (
        <DelegationDialog
          id={`${id}-dialog`}
          host={host}
          view={view}
          draft={draft}
          onSaved={() => {
            setDraft(null);
            refresh();
          }}
          onClose={() => setDraft(null)}
        />
      )}
      {confirm.element}
    </section>
  );
}
/** Add Delegation / Edit Access: people (fixed when editing), the rights ladder, dates and the pages to delegate. */
function DelegationDialog({
  id,
  host,
  view: { texts, gates, catalogue, today },
  draft,
  onSaved,
  onClose,
}: {
  id: string;
  host: ObjectHost;
  view: DelegationView;
  draft: Draft;
  onSaved: () => void;
  onClose: () => void;
}) {
  const [users, setUsers] = useState(draft.users),
    [start, setStart] = useState(draft.start),
    [end, setEnd] = useState(draft.end),
    [pages, setPages] = useState(() => new Set(draft.pages)),
    [access, setAccess] = useState(draft.access),
    { run, isActive } = useInFlight(),
    fail = useActionFailure(),
    saving = isActive("save");
  const locked = catalogue.flatMap((g) =>
    g.pages.filter((p) => p.locked).map((p) => p.name),
  );
  const every = (names: string[]) => names.every((n) => pages.has(n));
  const allNames = catalogue.flatMap((g) => g.pages.map((p) => p.name));
  const pick = (names: string[], on: boolean) =>
    setPages((current) => {
      const next = new Set(current);
      for (const n of names)
        if (on) next.add(n);
        else next.delete(n);
      for (const n of locked) next.add(n);
      return next;
    });
  // accessSwitch: Edit turns Read on; Delete turns all three on.
  const setRight = (type: keyof Access, on: boolean) =>
    setAccess((a) =>
      type === "delete" && on
        ? { read: true, edit: true, delete: true }
        : type === "edit" && on
          ? { ...a, read: true, edit: true }
          : { ...a, [type]: on },
    );
  const ready =
    users.length > 0 &&
    (!gates.startRequired || start !== "") &&
    (!gates.endRequired || end !== "") &&
    (start === "" || end === "" || end >= start);
  const save = () =>
    run(async () => {
      const result = await objectCall(
        "POST",
        "delegations",
        { ...host },
        { users, start, end, pages: [...pages], ...access },
      );
      if (!result.ok) return fail(result.error);
      onSaved();
    }, "save");
  // Legacy min is today; an existing earlier start stays valid when editing.
  const minStart =
    draft.edit && draft.start && draft.start < today ? draft.start : today;
  const check = (
    key: string,
    label: string,
    checked: boolean,
    onChange: (on: boolean) => void,
    disabled = false,
  ) => (
    <label key={key} className={styles.check}>
      <input
        id={key}
        type="checkbox"
        className="gn-check"
        checked={checked}
        disabled={saving || disabled}
        onChange={(e) => onChange(e.currentTarget.checked)}
      />
      {label}
    </label>
  );
  return (
    <ActionDialog
      id={id}
      title={texts.dialogTitle}
      width={560}
      busy={saving}
      onClose={onClose}
    >
      <div id={`${id}-form`} className={dialogStyles.form}>
        <InsideField
          htmlFor={`${id}-people-field`}
          label={texts.people}
          filled={users.length > 0}
          required={gates.peopleRequired}
        >
          <MultiSelect
            id={`${id}-people`}
            variant="chips"
            label={texts.people}
            options={draft.people}
            value={users}
            closeOnPick
            disabled={saving || draft.edit}
            onChange={setUsers}
          />
        </InsideField>
        <fieldset id={`${id}-rights`} className={styles.rights}>
          <legend>{texts.privilege}</legend>
          {(["read", "edit", "delete"] as const).map((type) => (
            <label key={type} className={styles.switch}>
              <input
                id={`${id}-${type}`}
                type="checkbox"
                role="switch"
                checked={access[type]}
                disabled={
                  saving ||
                  (type === "read" && (access.edit || access.delete)) ||
                  (type === "edit" && access.delete)
                }
                onChange={(e) => setRight(type, e.currentTarget.checked)}
              />
              <span className={styles.track} />
              {texts[type]}
            </label>
          ))}
        </fieldset>
        <div className={styles.row}>
          <InsideField
            htmlFor={`${id}-start`}
            label={texts.startDate}
            filled={start !== ""}
            required={gates.startRequired}
          >
            <DateInput
              id={`${id}-start`}
              value={start}
              min={minStart}
              max={end || undefined}
              required={gates.startRequired}
              disabled={saving}
              onChange={setStart}
            />
          </InsideField>
          <InsideField
            htmlFor={`${id}-end`}
            label={texts.endDate}
            filled={end !== ""}
            required={gates.endRequired}
          >
            <DateInput
              id={`${id}-end`}
              value={end}
              min={start || minStart}
              required={gates.endRequired}
              disabled={saving}
              onChange={setEnd}
            />
          </InsideField>
        </div>
        <div id={`${id}-pages`} className={styles.catalogue}>
          {check(`${id}-all`, texts.all, every(allNames), (on) =>
            pick(allNames, on),
          )}
          {catalogue.map((g) => {
            const names = g.pages.map((p) => p.name);
            return (
              <div key={g.type} className={styles.groupPick}>
                {check(
                  `${id}-${idPart(g.type)}-all`,
                  g.label,
                  every(names),
                  (on) => pick(names, on),
                )}
                <div className={styles.groupPages}>
                  {g.pages.map((p) =>
                    check(
                      `${id}-${idPart(g.type)}-${idPart(p.name)}`,
                      p.label,
                      pages.has(p.name),
                      (on) => pick([p.name], on),
                      p.locked,
                    ),
                  )}
                </div>
              </div>
            );
          })}
        </div>
        <div className={dialogStyles.foot}>
          <button
            type="button"
            id={`${id}-submit`}
            className="gn-btn gn-btn--primary"
            disabled={saving || !ready}
            aria-busy={saving || undefined}
            onClick={save}
          >
            {texts.submit}
          </button>
        </div>
      </div>
    </ActionDialog>
  );
}
