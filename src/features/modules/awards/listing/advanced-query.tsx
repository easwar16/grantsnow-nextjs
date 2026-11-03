"use client";
import { useState } from "react";
import { Icon } from "@/components/ui/icon";
import { Select } from "@/components/ui/select";
import { InsideField } from "@/components/ui/inside-field";
import { Skeleton } from "@/components/feedback/skeleton";
import { State } from "@/components/feedback/state";
import { ActionDialog } from "@/components/dialog/action-dialog";
import { awards, useApi } from "@/lib/api";
import { conditionSchema, type AwardCondition } from "./schema";
import styles from "./award-list.module.css";
import { DataTable } from "@/components/ui/data-table";
import dialog from "@/components/dialog/dialog.module.css";

const BLANK = { attribute: "", op: "", value: "" };
type Draft = typeof BLANK;
const parse = (d: Draft) => conditionSchema.safeParse(d);

/**
 * Legacy Advanced Query (the listing's end drawer): pick an attribute, an operator and a value, Add Condition; the
 * conditions list is read-only with Edit (a dialog over a detached copy) and Delete. Changing the rows re-reads the list.
 */
export function AdvancedQuery({
  conditions,
  onChange,
  onClose,
}: {
  conditions: AwardCondition[];
  onChange: (next: AwardCondition[]) => void;
  onClose: () => void;
}) {
  const setup = useApi(awards.advancedSetup, undefined);
  const [draft, setDraft] = useState<Draft>(BLANK),
    [touched, setTouched] = useState(false),
    [editing, setEditing] = useState<{ index: number; draft: Draft } | null>(
      null,
    );
  const s = setup.data;
  const labelOf = (list: { value: string; label: string }[], v: string) =>
    list.find((o) => o.value === v)?.label ?? v;
  const fields = (
    prefix: string,
    d: Draft,
    set: (d: Draft) => void,
    showErrors: boolean,
  ) =>
    s && (
      <>
        <InsideField
          htmlFor={`${prefix}-attribute-trigger`}
          label={s.texts.attribute}
          filled={d.attribute !== ""}
          required
        >
          <Select
            id={`${prefix}-attribute`}
            label={s.texts.attribute}
            options={s.attributes}
            value={d.attribute}
            invalid={showErrors && d.attribute === ""}
            onChange={(attribute) => set({ ...d, attribute })}
          />
        </InsideField>
        <InsideField
          htmlFor={`${prefix}-operator-trigger`}
          label={s.texts.operator}
          filled={d.op !== ""}
          required
        >
          <Select
            id={`${prefix}-operator`}
            label={s.texts.operator}
            options={s.operators}
            value={d.op}
            invalid={showErrors && d.op === ""}
            onChange={(op) => set({ ...d, op })}
          />
        </InsideField>
        <InsideField
          htmlFor={`${prefix}-value`}
          label={s.texts.value}
          filled={d.value !== ""}
          required
        >
          <input
            id={`${prefix}-value`}
            type="text"
            maxLength={200}
            value={d.value}
            aria-invalid={(showErrors && d.value.trim() === "") || undefined}
            onChange={(e) => set({ ...d, value: e.target.value })}
          />
        </InsideField>
      </>
    );
  const add = () => {
    setTouched(true);
    const row = parse(draft);
    if (!row.success) return;
    onChange([...conditions, row.data]);
    setDraft(BLANK);
    setTouched(false);
  };
  return (
    <aside
      id="awards-advanced"
      className={styles.advanced}
      aria-label={s?.texts.title ?? "Advanced Query"}
    >
      <div className={styles.advancedHead}>
        <button
          type="button"
          id="awards-advanced-close"
          className="gn-btn gn-btn--borderless gn-btn--icon"
          aria-label={s?.texts.close ?? "Close"}
          title={s?.texts.close ?? "Close"}
          onClick={onClose}
        >
          <Icon name="close" size={14} />
        </button>
      </div>
      {setup.error ? (
        <State
          title="Advanced Query unavailable"
          message={setup.error.message}
          code={setup.error.code}
          retry={setup.retry}
        />
      ) : !s ? (
        <Skeleton kind="lines" count={3} label="Loading Advanced Query" />
      ) : (
        <>
          <div id="awards-advanced-form" className={styles.advancedForm}>
            {fields("awards-advanced", draft, setDraft, touched)}
          </div>
          <button
            type="button"
            id="awards-advanced-add"
            className="gn-btn gn-btn--solid"
            disabled={editing !== null}
            onClick={add}
          >
            {s.texts.add}
          </button>
          {conditions.length > 0 && (
            <DataTable
              id="awards-advanced-conditions"
              rowIds="awards-advanced-condition"
              className={styles.conditions}
              columns={[
                {
                  id: "attribute",
                  header: s.texts.attribute,
                  cell: ({ c }) => labelOf(s.attributes, c.attribute),
                },
                {
                  id: "operator",
                  header: s.texts.operator,
                  cell: ({ c }) => labelOf(s.operators, c.op),
                },
                {
                  id: "value",
                  header: s.texts.value,
                  cell: ({ c }) => c.value,
                },
              ]}
              rows={conditions.map((c, i) => ({ c, i }))}
              rowKey={(r) => String(r.i)}
              actions={[
                {
                  id: "edit",
                  icon: "pen",
                  size: 14,
                  label: () => s.texts.edit,
                  disabled: () => editing !== null,
                  onClick: ({ c, i }) =>
                    setEditing({ index: i, draft: { ...c } }),
                },
                {
                  id: "delete",
                  icon: "trash",
                  size: 14,
                  label: () => s.texts.remove,
                  disabled: () => editing !== null,
                  onClick: ({ i }) =>
                    onChange(conditions.filter((_, j) => j !== i)),
                },
              ]}
              actionsClassName={styles.conditionActions}
            />
          )}
          {editing && (
            <ActionDialog
              id="awards-advanced-edit"
              title={s.texts.editTitle}
              width="41.667vw" /* legacy dialogEditAwardFilterRow oj-md-5 */
              onClose={() => setEditing(null)}
            >
              <div className={dialog.form}>
                {fields(
                  "awards-advanced-edit",
                  editing.draft,
                  (d) => setEditing({ ...editing, draft: d }),
                  true,
                )}
                <div className={dialog.foot}>
                  <button
                    type="button"
                    id="awards-advanced-edit-cancel"
                    className="gn-btn gn-btn--solid"
                    onClick={() => setEditing(null)}
                  >
                    {s.texts.cancel}
                  </button>
                  <button
                    type="button"
                    id="awards-advanced-edit-save"
                    className="gn-btn gn-btn--primary"
                    onClick={() => {
                      const row = parse(editing.draft);
                      if (!row.success) return;
                      onChange(
                        conditions.map((c, j) =>
                          j === editing.index ? row.data : c,
                        ),
                      );
                      setEditing(null);
                    }}
                  >
                    {s.texts.save}
                  </button>
                </div>
              </div>
            </ActionDialog>
          )}
        </>
      )}
    </aside>
  );
}
