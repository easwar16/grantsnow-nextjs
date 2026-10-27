"use client";
import { Fragment, useState } from "react";
import { Icon } from "@/components/ui/icon";
import { HelpButton } from "@/components/ui/help-button";
import { Collapsible } from "@/components/ui/collapsible";
import { ActionMenu } from "@/components/ui/action-menu";
import { ReadonlyField } from "@/components/ui/readonly-field";
import { Select } from "@/components/ui/select";
import { DateInput } from "@/components/ui/date-input";
import { State } from "@/components/feedback/state";
import { Skeleton } from "@/components/feedback/skeleton";
import { useToast } from "@/components/feedback/toast";
import { ActionDialog, useConfirm } from "@/components/dialog/action-dialog";
import { useActionFailure } from "@/components/dialog/action-failure";
import { useInFlight } from "@/lib/hooks/use-in-flight";
import { awards, useApi } from "@/lib/api";
import { dateDisplay, moneyDisplay } from "@/lib/format";
import { idPart } from "@/lib/ids";
import {
  globalChange,
  globalCosts,
  splitChange,
  type Amounts,
  type CostLine,
  type GlobalCosts,
  type GlobalEdit,
  type Split,
} from "./projects-model";
import type {
  CostColumn,
  CostDialogData,
  CostField,
  ProjectsView,
} from "./projects-types";
import {
  DateCell,
  DialogFoot,
  SelectCell,
  TextCell,
  dateBounds,
  type Money,
} from "./projects-tab";
import dialog from "@/components/dialog/dialog.module.css";
import styles from "./tabs.module.css";

/** Legacy shows these four columns whatever the bundle says. */
const ALWAYS: CostColumn[] = ["item", "sponsor", "institution", "total"];
const LEAF_ONLY: CostColumn[] = [
  "role",
  "start",
  "end",
  "glNominal",
  "unitType",
  "hours",
  "months",
];
const STAFF = ["STAFF", "PERSONNEL_COSTS"];
const pct = (n: number) => `${(n * 100).toFixed(2)}%`;
const round = (n: number) => String(Math.round(n * 100) / 100);
const optional = (text: string) => (text.trim() === "" ? null : Number(text));

type Level = "LINE" | "SECTION" | "CATEGORY";
interface CostDraft {
  level: Level;
  lineId: number | null;
  projectId: string;
  section: string;
  category: string;
  itemId: string;
  personId: string;
  roleId: string;
  unitType: string;
  units: string;
  hours: string;
  months: string;
  description: string;
  glNominal: string;
  start: string;
  end: string;
  split: Split;
}
const text = (v: number | null) => (v === null ? "" : String(v));
const splitOf = (a: Amounts): Split => ({
  sponsor: a.sponsor,
  institution: a.institution,
  total: a.total,
  sponsorPct: a.sponsorPct,
  institutionPct: a.institutionPct,
});
/** Legacy editRowData: the dialog opens on the node's first line with the node's sums. */
const draftOf = (level: Level, line: CostLine, a: Amounts): CostDraft => ({
  level,
  lineId: line.id,
  projectId: String(line.project_id),
  section: line.funding_section_lkp_code,
  category: line.cost_category_type_lkp_code,
  itemId: text(line.cost_category_item_id),
  personId: text(line.person_id),
  roleId: text(line.project_role_id),
  unitType: line.unit_type,
  units: text(line.units),
  hours: text(line.project_hours),
  months: text(line.project_months),
  description: line.staff_name,
  glNominal: line.gl_nominal_code || line.gl_nominal,
  start: line.cost_start_date,
  end: line.cost_end_date,
  split: splitOf(a),
});

export function ProjectCostsPanel({
  view,
  format,
  onSaved,
}: {
  view: ProjectsView;
  format?: Money;
  onSaved: () => void;
}) {
  const [draft, setDraft] = useState<CostDraft | null>(null),
    // Collapsed section and category rows (legacy oj-row-expander; all start expanded).
    [closed, setClosed] = useState<ReadonlySet<string>>(new Set()),
    { run, isActive } = useInFlight(),
    fail = useActionFailure(),
    confirm = useConfirm("award-cost-delete");
  const money = (n: number) =>
    moneyDisplay(String(n), format?.currency, format);
  const h = view.costColumns;
  // Quantity belongs to the period rows only (legacy tree columns).
  const shown = (Object.keys(h) as CostColumn[]).filter(
    (k) => k !== "quantity" && (ALWAYS.includes(k) || h[k].show),
  );
  const g = view.gates;
  const add = () =>
    setDraft({
      ...draftOf("LINE", {} as CostLine, {
        sponsor: 0,
        institution: 0,
        total: 0,
        sponsorPct: 0,
        institutionPct: 0,
      }),
      lineId: null,
      projectId: "",
      // Legacy pre-fills the only funding section when the field is required.
      section:
        view.costFields.section.required && view.choices.sections.length === 1
          ? view.choices.sections[0].value
          : "",
      category: "",
      itemId: "",
      personId: "",
      roleId: "",
      unitType: "",
      units: "",
      hours: "",
      months: "",
      description: "",
      glNominal: "",
      start: "",
      end: "",
    });
  const act = async (action: "delete" | "clone", line: CostLine) => {
    // Legacy deleted on the first click; a delete now asks first (owner, 2026-10-26).
    if (
      action === "delete" &&
      !(await confirm.ask({
        title: view.texts.deleteTitle,
        message: view.texts.deleteMessage,
        confirm: view.texts.deleteCost,
        cancel: view.texts.cancel,
        danger: true,
      }))
    )
      return;
    return run(async () => {
      const result = await awards.saveProjects(view.awardId, action, {
        lineId: line.id,
      });
      if (!result.ok) return fail(result.error);
      onSaved();
    }, `${action}-${line.id}`);
  };
  // Live: group rows' amounts bold, every percentage 15px bold.
  const amountCells = (a: Amounts, group = false) =>
    shown.map((k) =>
      k === "sponsor" || k === "institution" || k === "total" ? (
        <td
          key={k}
          className={`${styles.number} ${group ? styles.strong : ""}`}
        >
          {money(a[k])}
        </td>
      ) : k === "sponsorPct" || k === "institutionPct" ? (
        <td key={k} className={`${styles.number} ${styles.pct}`}>
          {pct(a[k])}
        </td>
      ) : null,
    );
  const toggle = (key: string) =>
    setClosed((c) => {
      const next = new Set(c);
      if (!next.delete(key)) next.add(key);
      return next;
    });
  const node = (key: string, name: string) => (
    <th scope="row">
      <span className={styles.node}>
        <button
          type="button"
          id={`award-cost-${idPart(key)}-toggle`}
          className={styles.expander}
          aria-expanded={!closed.has(key)}
          aria-label={name}
          onClick={() => toggle(key)}
        >
          <Icon name="caret-down" size={14} />
        </button>
        <span className={styles.nodeName}>{name}</span>
      </span>
    </th>
  );
  const leafCell = (k: CostColumn, line: CostLine) => {
    const v: Partial<Record<CostColumn, string>> = {
      role: line.cost_category_description,
      start: dateDisplay(line.cost_start_date, format),
      end: dateDisplay(line.cost_end_date, format),
      glNominal: line.gl_nominal,
      unitType:
        view.choices.unitTypes.find((u) => u.value === line.unit_type)?.label ??
        line.unit_type,
      quantity: text(line.units),
      hours: text(line.project_hours),
      months: text(line.project_months),
    };
    return <td key={k}>{v[k]}</td>;
  };
  // Group rows leave the leaf-only columns blank.
  const blanks = (from: number) =>
    shown
      .slice(from)
      .filter((k) => LEAF_ONLY.includes(k))
      .map((k) => <td key={k} />);
  const editButton = (
    id: string,
    label: string,
    disabled: boolean,
    open: () => void,
  ) => (
    <button
      type="button"
      id={id}
      className="gn-btn gn-btn--borderless gn-btn--icon"
      aria-label={label}
      title={view.texts.editCost}
      disabled={disabled}
      onClick={open}
    >
      <Icon name="edit" size={14} />
    </button>
  );
  return (
    <>
      <GlobalCostForm view={view} format={format} onSaved={onSaved} />
      {confirm.element}
      {g.addCost && (
        <div className={styles.actions}>
          <button
            type="button"
            id="award-costs-add"
            className="gn-btn gn-btn--primary"
            onClick={add}
          >
            {view.texts.addCost}
          </button>
        </div>
      )}
      {view.costs.length === 0 && (
        <p id="award-costs-empty" className={styles.empty}>
          {view.texts.noData}
        </p>
      )}
      {view.costs.map((p) => {
        const project = view.projects.find((x) => x.id === String(p.projectId));
        const pid = idPart(String(p.projectId));
        return (
          <Collapsible
            key={p.projectId}
            id={`award-costs-project-${pid}`}
            className={styles.collapsible}
            heading={
              <span>
                {project?.number}
                <br />
                {project?.name}
              </span>
            }
          >
            <div className="gn-table-scroll" data-height="tall">
              <table className="gn-table">
                <thead>
                  <tr>
                    {shown.map((k) => (
                      <th
                        key={k}
                        scope="col"
                        className={
                          LEAF_ONLY.includes(k) || k === "item"
                            ? undefined
                            : styles.number
                        }
                      >
                        {h[k].label}
                      </th>
                    ))}
                    <th scope="col">
                      <span className="sr-only">{view.texts.editCost}</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {p.sections.flatMap((s) => [
                    <tr
                      key={s.key}
                      id={`award-cost-${idPart(s.key)}`}
                      className={styles.level0}
                    >
                      {node(s.key, s.name)}
                      {blanks(1)}
                      {amountCells(s, true)}
                      <td>
                        {editButton(
                          `award-cost-${idPart(s.key)}-edit`,
                          `${view.texts.editCost} ${s.name}`,
                          !g.edit || !s.first.is_editable,
                          () => setDraft(draftOf("SECTION", s.first, s)),
                        )}
                      </td>
                    </tr>,
                    ...(closed.has(s.key) ? [] : s.categories).flatMap((c) => [
                      <tr
                        key={c.key}
                        id={`award-cost-${idPart(c.key)}`}
                        className={styles.level1}
                      >
                        {node(c.key, c.name)}
                        {blanks(1)}
                        {amountCells(c, true)}
                        <td>
                          {editButton(
                            `award-cost-${idPart(c.key)}-edit`,
                            `${view.texts.editCost} ${c.name}`,
                            !g.edit || !c.first.is_editable,
                            () => setDraft(draftOf("CATEGORY", c.first, c)),
                          )}
                        </td>
                      </tr>,
                      ...(closed.has(c.key) ? [] : c.leaves).map((l) => {
                        const id = `award-cost-${idPart(l.key)}`;
                        const busy =
                          isActive(`delete-${l.line.id}`) ||
                          isActive(`clone-${l.line.id}`);
                        return (
                          <tr key={l.key} id={id} className={styles.level2}>
                            <td>{l.line.staff_name}</td>
                            {shown
                              .slice(1)
                              .map((k) =>
                                LEAF_ONLY.includes(k)
                                  ? leafCell(k, l.line)
                                  : null,
                              )}
                            {amountCells(l)}
                            <td className={styles.rowActions}>
                              {/* Legacy projectCostActionMenu: Edit, Delete, Clone. */}
                              <ActionMenu
                                id={`${id}-menu`}
                                label={`${view.texts.editCost} ${l.line.staff_name || l.line.cost_category_description}`}
                                icon="menu"
                                iconSize={16}
                                className="gn-btn gn-btn--borderless gn-btn--icon"
                                disabled={
                                  !l.line.is_editable ||
                                  busy ||
                                  (!g.edit && !g.remove)
                                }
                                items={[
                                  {
                                    key: "edit",
                                    label: view.texts.editCost,
                                    disabled: !g.edit,
                                    run: () =>
                                      setDraft(draftOf("LINE", l.line, l)),
                                  },
                                  {
                                    key: "delete",
                                    label: view.texts.deleteCost,
                                    disabled: !g.remove,
                                    run: () => act("delete", l.line),
                                  },
                                  {
                                    key: "clone",
                                    label: view.texts.clone,
                                    disabled: !g.edit,
                                    run: () => act("clone", l.line),
                                  },
                                ]}
                              />
                            </td>
                          </tr>
                        );
                      }),
                    ]),
                  ])}
                </tbody>
                <tfoot>
                  <tr>
                    <td className={styles.number}>{view.texts.total}</td>
                    {blanks(1)}
                    {amountCells(p)}
                    <td />
                  </tr>
                </tfoot>
              </table>
            </div>
          </Collapsible>
        );
      })}
      {draft && (
        <CostDialog
          view={view}
          format={format}
          initial={draft}
          onClose={() => {
            setDraft(null);
            // Legacy refreshes the tree when the dialog closes (period rows save while it is open).
            onSaved();
          }}
        />
      )}
    </>
  );
}

// ── Global split ──────────────────────────────────────────────────────────────

const GLOBAL_FIELDS: [keyof GlobalCosts, GlobalEdit, boolean][] = [
  ["instiCost", "INSTI-COST", false],
  ["instiPct", "INSTI-PCT", true],
  ["funderCost", "FUND-COST", false],
  ["funderPct", "FUND-PCT", true],
  ["total", "TOTAL", false],
];
/** Legacy vgGlobalCost: the award's split across its lines, edited as one. */
function GlobalCostForm({
  view,
  format,
  onSaved,
}: {
  view: ProjectsView;
  format?: Money;
  onSaved: () => void;
}) {
  const initial = globalCosts(view.costs);
  const [edit, setEdit] = useState<GlobalCosts | null>(null),
    [typed, setTyped] = useState<Partial<Record<keyof GlobalCosts, string>>>(
      {},
    ),
    { run, isActive } = useInFlight(),
    fail = useActionFailure(),
    saving = isActive("global");
  const g = edit ?? initial;
  const commit = (k: keyof GlobalCosts, type: GlobalEdit, percent: boolean) => {
    const t = typed[k];
    if (t === undefined) return;
    setTyped((s) => ({ ...s, [k]: undefined }));
    const n = Number(t);
    if (t.trim() === "" || !Number.isFinite(n)) return;
    const v = percent ? n / 100 : n;
    // Legacy min 0 on the funder fields and the total.
    if (v < 0 && type !== "INSTI-COST" && type !== "INSTI-PCT") return;
    setEdit((s) => s && globalChange(s, type, v));
  };
  const save = () =>
    run(async () => {
      if (!edit) return;
      const result = await awards.saveProjects(view.awardId, "global", {
        sponsor: edit.funderCost,
        institution: edit.instiCost,
        total: edit.total,
      });
      if (!result.ok) return fail(result.error);
      setEdit(null);
      onSaved();
    }, "global");
  // Legacy globalCost: label-edge start, two columns; read-only text until Edit.
  return (
    <div id="award-costs-global" className={styles.globalForm}>
      {GLOBAL_FIELDS.map(([k, type, percent]) => {
        const id = `award-costs-global-${idPart(k)}`;
        if (!edit)
          return (
            <ReadonlyField
              key={k}
              id={id}
              edge="start"
              label={view.globalFields[k]}
              value={
                percent
                  ? pct(g[k])
                  : moneyDisplay(String(g[k]), format?.currency, format)
              }
            />
          );
        return (
          <label key={k} className={styles.startField}>
            <span>{view.globalFields[k]}</span>
            <input
              id={id}
              className="gn-control"
              type="number"
              step="any"
              disabled={saving}
              value={typed[k] ?? round(percent ? g[k] * 100 : g[k])}
              onChange={(e) => setTyped((s) => ({ ...s, [k]: e.target.value }))}
              onBlur={() => commit(k, type, percent)}
              onKeyDown={(e) => e.key === "Enter" && commit(k, type, percent)}
            />
          </label>
        );
      })}
      {view.gates.editGlobal && (
        // Legacy: centred quarter-width buttons with start icons (Edit Global; Cancel and Save while editing).
        <div className={styles.globalActions}>
          {edit ? (
            <>
              <button
                type="button"
                id="award-costs-global-cancel"
                className="gn-btn gn-btn--outlined"
                disabled={saving}
                onClick={() => {
                  setEdit(null);
                  setTyped({});
                }}
              >
                <Icon name="cancel" size={14} />
                {view.texts.cancel}
              </button>
              <button
                type="button"
                id="award-costs-global-save"
                className="gn-btn gn-btn--primary"
                disabled={saving}
                onClick={save}
              >
                <Icon name="save" size={14} />
                {view.texts.save}
              </button>
            </>
          ) : (
            <button
              type="button"
              id="award-costs-global-edit"
              className="gn-btn gn-btn--outlined"
              onClick={() => setEdit(initial)}
            >
              <Icon name="edit" size={14} />
              {view.texts.editGlobal}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ── Cost dialog ───────────────────────────────────────────────────────────────

const SPLIT_FIELDS: [keyof Split, CostField, GlobalEdit, boolean][] = [
  ["sponsor", "sponsor", "FUND-COST", false],
  ["sponsorPct", "sponsorPct", "FUND-PCT", true],
  ["institution", "institution", "INSTI-COST", false],
  ["institutionPct", "institutionPct", "INSTI-PCT", true],
  ["total", "total", "TOTAL", false],
];
/** The split's five inputs, re-derived on commit (blur or Enter) as legacy's value change. */
function SplitInputs({
  id,
  split,
  labels,
  disabled,
  onChange,
  cell = true,
}: {
  id: string;
  split: Split;
  labels: Record<
    keyof Split,
    { label: string; required?: boolean; help?: string | null }
  >;
  disabled: boolean;
  onChange: (edit: GlobalEdit, value: number) => void;
  cell?: boolean;
}) {
  const [typed, setTyped] = useState<Partial<Record<keyof Split, string>>>({});
  const commit = (k: keyof Split, type: GlobalEdit, percent: boolean) => {
    const t = typed[k];
    if (t === undefined) return;
    setTyped((s) => ({ ...s, [k]: undefined }));
    const n = Number(t);
    if (t.trim() === "" || !Number.isFinite(n)) return;
    onChange(type, percent ? n / 100 : n);
  };
  return SPLIT_FIELDS.map(([k, , type, percent]) => {
    const input = (
      <input
        id={`${id}-${idPart(k)}`}
        className="gn-control"
        type="number"
        step="any"
        aria-label={cell ? undefined : labels[k].label}
        value={typed[k] ?? round(percent ? split[k] * 100 : split[k])}
        disabled={disabled}
        onChange={(e) => setTyped((s) => ({ ...s, [k]: e.target.value }))}
        onBlur={() => commit(k, type, percent)}
        onKeyDown={(e) => e.key === "Enter" && commit(k, type, percent)}
      />
    );
    return cell ? (
      <label key={k} className={`gn-field ${dialog.cell}`}>
        <span className="gn-label">
          {labels[k].label}
          {labels[k].required ? " *" : ""}
          <HelpButton id={`award-cost-${k}-help`} html={labels[k].help} />
        </span>
        {input}
      </label>
    ) : (
      <td key={k}>{input}</td>
    );
  });
}

/** Legacy dialogAwardCostEdit: a cost line (LINE) or a section's or category's split. */
function CostDialog({
  view,
  format,
  initial,
  onClose,
}: {
  view: ProjectsView;
  format?: Money;
  initial: CostDraft;
  onClose: () => void;
}) {
  const [d, setD] = useState(initial),
    [touched, setTouched] = useState(false),
    { run, isActive } = useInFlight(),
    fail = useActionFailure(),
    saving = isActive("cost");
  const f = view.costFields;
  const line = d.level === "LINE";
  const lists = useApi(
    awards.costDialog,
    line && d.category
      ? {
          awardId: view.awardId,
          type: d.category,
          line: d.lineId === null ? "" : String(d.lineId),
        }
      : null,
  );
  const staff = STAFF.includes(d.category);
  const isNew = d.lineId === null;
  const set = (k: keyof CostDraft) => (v: string) =>
    setD((s) => ({ ...s, [k]: v }));
  // Legacy PopulateCostCategoryItemsADP(external): a new category clears what depended on the old one.
  const setCategory = (v: string) =>
    setD((s) => ({
      ...s,
      category: v,
      itemId: "",
      personId: "",
      months: "",
      roleId: "",
      unitType: "",
      units: "",
      hours: "",
      description: "",
    }));
  // Legacy CostCatValueItemChangeChain: the item brings its GL nominal.
  const setItem = (v: string) =>
    setD((s) => ({
      ...s,
      itemId: v,
      glNominal:
        lists.data?.categoryItems.find((i) => i.value === v)?.glNominal ||
        s.glNominal,
    }));
  const visible: CostField[] = [
    "project",
    "section",
    ...(d.level !== "SECTION" ? (["category"] as const) : []),
    ...(line
      ? ([
          "start",
          "end",
          "item",
          ...(staff
            ? (["person", "months", "role"] as const)
            : ([
                ...(isNew ? (["unitType", "units", "hours"] as const) : []),
                "description",
              ] as const)),
          "glNominal",
        ] as const)
      : []),
  ];
  const value = (k: CostField) =>
    ({
      project: d.projectId,
      section: d.section,
      category: d.category,
      start: d.start,
      end: d.end,
      item: d.itemId,
      person: d.personId,
      months: d.months,
      role: d.roleId,
      unitType: d.unitType,
      units: d.units,
      hours: d.hours,
      description: d.description,
      glNominal: d.glNominal,
    })[k as string] ?? "";
  const missing = (k: CostField) =>
    f[k].show && f[k].required && value(k) === "";
  const invalid = (k: CostField) => touched && missing(k);
  const bounds = dateBounds(view.award, d.start, d.end);
  const toast = useToast();
  const save = () => {
    setTouched(true);
    if (visible.some(missing)) return toast.show("error", view.texts.required);
    run(async () => {
      const result = await awards.saveProjects(view.awardId, "cost", {
        level: d.level,
        lineId: d.lineId,
        projectId: d.projectId,
        section: d.section,
        category: d.category,
        itemId: d.itemId,
        personId: d.personId,
        roleId: d.roleId,
        unitType: d.unitType,
        units: optional(d.units),
        hours: optional(d.hours),
        months: optional(d.months),
        description: d.description,
        glNominal: d.glNominal,
        start: d.start,
        end: d.end,
        sponsor: d.split.sponsor,
        institution: d.split.institution,
        total: d.split.total,
      });
      if (!result.ok) return fail(result.error);
      onClose();
    }, "cost");
  };
  return (
    <ActionDialog
      id="award-cost-dialog"
      title={view.texts.costTitle}
      width="80vw" /* legacy dialogAwardCostEdit width: 80vw */
      busy={saving}
      onClose={onClose}
    >
      <div className={dialog.convert}>
        {f.project.show && (
          <SelectCell
            id="award-cost-project"
            field={f.project}
            options={view.projects.map((p) => ({
              value: p.id,
              label: p.name,
            }))}
            value={d.projectId}
            invalid={invalid("project")}
            disabled={saving || !line || !isNew}
            onChange={set("projectId")}
          />
        )}
        {line && f.start.show && (
          <DateCell
            id="award-cost-start"
            field={f.start}
            value={d.start}
            min={view.award.start}
            max={bounds.startMax}
            invalid={invalid("start")}
            disabled={saving || !d.projectId || !isNew}
            onChange={set("start")}
          />
        )}
        {line && f.end.show && (
          <DateCell
            id="award-cost-end"
            field={f.end}
            value={d.end}
            min={bounds.endMin}
            max={view.award.end}
            invalid={invalid("end")}
            disabled={saving || !d.projectId || !isNew}
            onChange={set("end")}
          />
        )}
        {f.section.show && (
          <SelectCell
            id="award-cost-section"
            field={f.section}
            options={view.choices.sections}
            value={d.section}
            invalid={invalid("section")}
            disabled={saving || !line}
            onChange={set("section")}
          />
        )}
        {d.level !== "SECTION" && f.category.show && (
          <SelectCell
            id="award-cost-category"
            field={f.category}
            options={view.choices.categories}
            value={d.category}
            invalid={invalid("category")}
            disabled={saving || !line}
            onChange={setCategory}
          />
        )}
        {line && f.item.show && (
          <SelectCell
            id="award-cost-item"
            field={f.item}
            options={lists.data?.categoryItems ?? []}
            value={d.itemId}
            invalid={invalid("item")}
            disabled={saving || !d.category}
            onChange={setItem}
          />
        )}
        {line && staff && f.person.show && (
          <SelectCell
            id="award-cost-person"
            field={f.person}
            options={view.choices.everyone}
            value={d.personId}
            invalid={invalid("person")}
            disabled={saving}
            onChange={set("personId")}
          />
        )}
        {line && staff && f.months.show && (
          <TextCell
            id="award-cost-months"
            field={f.months}
            type="number"
            value={d.months}
            invalid={invalid("months")}
            disabled={saving}
            onChange={set("months")}
          />
        )}
        {line && staff && f.role.show && (
          <SelectCell
            id="award-cost-role"
            field={f.role}
            options={view.choices.roles}
            value={d.roleId}
            invalid={invalid("role")}
            disabled={saving}
            onChange={set("roleId")}
          />
        )}
        {line && !staff && isNew && f.unitType.show && (
          <SelectCell
            id="award-cost-unit-type"
            field={f.unitType}
            options={view.choices.unitTypes}
            value={d.unitType}
            invalid={invalid("unitType")}
            disabled={saving}
            onChange={set("unitType")}
          />
        )}
        {line &&
          !staff &&
          isNew &&
          (["units", "hours"] as const).map(
            (k) =>
              f[k].show && (
                <TextCell
                  key={k}
                  id={`award-cost-${k}`}
                  field={f[k]}
                  type="number"
                  value={d[k]}
                  invalid={invalid(k)}
                  disabled={saving}
                  onChange={set(k)}
                />
              ),
          )}
        {line && !staff && f.description.show && (
          <TextCell
            id="award-cost-description"
            field={f.description}
            value={d.description}
            invalid={invalid("description")}
            disabled={saving}
            onChange={set("description")}
          />
        )}
        {line && f.glNominal.show && (
          <SelectCell
            id="award-cost-gl-nominal"
            field={f.glNominal}
            options={view.choices.glNominals}
            value={d.glNominal}
            invalid={invalid("glNominal")}
            disabled={saving}
            onChange={set("glNominal")}
          />
        )}
        <SplitInputs
          id="award-cost"
          split={d.split}
          labels={f}
          disabled={saving}
          onChange={(type, v) =>
            setD((s) => ({ ...s, split: splitChange(s.split, type, v) }))
          }
        />
        {line && !isNew && d.category && (
          <CostPeriods
            view={view}
            format={format}
            lineId={d.lineId!}
            line={d}
            data={lists.data}
            error={lists.error}
            retry={lists.retry}
            readOnly={!view.gates.edit}
          />
        )}
        <DialogFoot
          id="award-cost"
          saving={saving}
          texts={view.texts}
          onCancel={onClose}
          onSave={save}
        />
      </div>
    </ActionDialog>
  );
}

// ── Split-by-period rows ──────────────────────────────────────────────────────

interface PeriodDraft {
  itemId: number | null;
  start: string;
  end: string;
  unitType: string;
  quantity: string;
  hours: string;
  months: string;
  split: Split;
}
const share = (part: number, total: number) =>
  part && total ? part / total : 0;
/** Legacy lineContriChanged: as the header split, but no negative value at all. */
const periodChange = (s: Split, type: GlobalEdit, v: number) =>
  v < 0 ? s : splitChange(s, type, v);

function CostPeriods({
  view,
  format,
  lineId,
  line,
  data,
  error,
  retry,
  readOnly,
}: {
  view: ProjectsView;
  format?: Money;
  lineId: number;
  line: CostDraft;
  data?: CostDialogData;
  error?: { message: string; code?: string; action?: string };
  retry: () => void;
  readOnly: boolean;
}) {
  const [row, setRow] = useState<PeriodDraft | null>(null),
    { run, isActive } = useInFlight(),
    fail = useActionFailure(),
    confirm = useConfirm("award-cost-period-delete");
  const h = view.costColumns;
  const money = (n: number) =>
    moneyDisplay(String(n), format?.currency, format);
  // Legacy B_start / B_end: the line's dates inside the award's.
  const lineBounds = dateBounds(view.award, line.start, line.end);
  const bStart = lineBounds.endMin || view.award.start,
    bEnd = lineBounds.startMax || view.award.end;
  const rowBounds = row
    ? dateBounds({ start: bStart, end: bEnd }, row.start, row.end)
    : null;
  if (error)
    return (
      <State
        id="award-cost-periods-error"
        title="The cost periods could not be loaded"
        message={error.message}
        code={error.code}
        action={error.action}
        retry={retry}
      />
    );
  if (!data) return <Skeleton kind="lines" count={3} label="Loading periods" />;
  if (data.periods.length === 0 && !row) return null;
  const save = () =>
    run(async () => {
      if (!row) return;
      const result = await awards.saveProjects(view.awardId, "period", {
        lineId,
        itemId: row.itemId,
        start: row.start,
        end: row.end,
        unitType: row.unitType,
        quantity: optional(row.quantity),
        hours: optional(row.hours),
        months: optional(row.months),
        sponsor: row.split.sponsor,
        institution: row.split.institution,
        total: row.split.total,
      });
      if (!result.ok) return fail(result.error);
      setRow(null);
      retry();
    }, "period");
  const remove = async (itemId: number) => {
    if (
      !(await confirm.ask({
        title: view.texts.deleteTitle,
        message: view.texts.deleteMessage,
        confirm: view.texts.deleteCost,
        cancel: view.texts.cancel,
        danger: true,
      }))
    )
      return;
    return run(async () => {
      const result = await awards.saveProjects(view.awardId, "delete", {
        lineId,
        itemId,
      });
      if (!result.ok) return fail(result.error);
      retry();
    }, `period-delete-${itemId}`);
  };
  const saving = isActive("period");
  const setField = (k: keyof PeriodDraft) => (v: string) =>
    setRow((s) => s && { ...s, [k]: v });
  const editing = (
    <tr id="award-cost-period-edit">
      {(["start", "end"] as const).map((k) => (
        <td key={k}>
          <DateInput
            id={`award-cost-period-${k}`}
            label={h[k].label}
            value={row?.[k] ?? ""}
            min={
              (k === "start" ? bStart : rowBounds?.endMin || bStart) ||
              undefined
            }
            max={
              (k === "start" ? rowBounds?.startMax || bEnd : bEnd) || undefined
            }
            disabled={saving}
            onChange={setField(k)}
          />
        </td>
      ))}
      <td>
        <Select
          id="award-cost-period-unit-type"
          label={h.unitType.label}
          options={view.choices.unitTypes}
          value={row?.unitType ?? ""}
          disabled={saving}
          onChange={setField("unitType")}
        />
      </td>
      {(["quantity", "hours", "months"] as const).map(
        (k) =>
          (k === "quantity" || h[k].show) && (
            <td key={k}>
              <input
                id={`award-cost-period-${k}`}
                className="gn-control"
                type="number"
                min={0}
                step="any"
                aria-label={h[k].label}
                value={row?.[k] ?? ""}
                disabled={saving}
                onChange={(e) => setField(k)(e.target.value)}
              />
            </td>
          ),
      )}
      {row && (
        <SplitInputs
          id="award-cost-period"
          cell={false}
          split={row.split}
          labels={{
            sponsor: h.sponsor,
            sponsorPct: h.sponsorPct,
            institution: h.institution,
            institutionPct: h.institutionPct,
            total: h.total,
          }}
          disabled={saving}
          onChange={(type, v) =>
            setRow((s) => s && { ...s, split: periodChange(s.split, type, v) })
          }
        />
      )}
      <td className={styles.rowActions}>
        <button
          type="button"
          id="award-cost-period-save"
          className="gn-btn gn-btn--borderless gn-btn--icon"
          aria-label={view.texts.save}
          title={view.texts.save}
          disabled={saving}
          onClick={save}
        >
          <Icon name="success" size={14} />
        </button>
        <button
          type="button"
          id="award-cost-period-cancel"
          className="gn-btn gn-btn--borderless gn-btn--icon"
          aria-label={view.texts.cancel}
          title={view.texts.cancel}
          disabled={saving}
          onClick={() => setRow(null)}
        >
          <Icon name="close" size={14} />
        </button>
      </td>
    </tr>
  );
  return (
    <div id="award-cost-periods" className={styles.periodRows}>
      {view.gates.splitByPeriod && !readOnly && (
        <div className={styles.actions}>
          <button
            type="button"
            id="award-cost-period-add"
            className="gn-btn gn-btn--outlined"
            disabled={row !== null}
            onClick={() =>
              setRow({
                itemId: null,
                start: "",
                end: "",
                unitType: "",
                quantity: "",
                hours: "",
                months: "",
                split: {
                  sponsor: 0,
                  institution: 0,
                  total: 0,
                  sponsorPct: 0,
                  institutionPct: 0,
                },
              })
            }
          >
            <Icon name="plus" size={14} />
            {view.texts.addRow}
          </button>
        </div>
      )}
      <div className="gn-table-scroll" data-height="dialog">
        <table id="award-cost-periods-table" className="gn-table">
          <thead>
            <tr>
              <th scope="col">{h.start.label}</th>
              <th scope="col">{h.end.label}</th>
              <th scope="col">{h.unitType.label}</th>
              <th scope="col">{h.quantity.label}</th>
              {h.hours.show && <th scope="col">{h.hours.label}</th>}
              {h.months.show && <th scope="col">{h.months.label}</th>}
              <th scope="col">{h.sponsor.label}</th>
              <th scope="col">{h.sponsorPct.label}</th>
              <th scope="col">{h.institution.label}</th>
              <th scope="col">{h.institutionPct.label}</th>
              <th scope="col">{h.total.label}</th>
              <th scope="col">
                <span className="sr-only">{view.texts.editCost}</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {row?.itemId === null && editing}
            {data.periods.map((p) =>
              row?.itemId === Number(p.id) ? (
                <Fragment key={p.id}>{editing}</Fragment>
              ) : (
                <tr key={p.id} id={`award-cost-period-${idPart(p.id)}`}>
                  <td>{dateDisplay(p.start, format)}</td>
                  <td>{dateDisplay(p.end, format)}</td>
                  <td>
                    {view.choices.unitTypes.find((u) => u.value === p.unitType)
                      ?.label ?? p.unitType}
                  </td>
                  <td>{text(p.quantity)}</td>
                  {h.hours.show && <td>{text(p.hours)}</td>}
                  {h.months.show && <td>{text(p.months)}</td>}
                  <td className={styles.number}>{money(p.sponsor)}</td>
                  <td className={styles.number}>
                    {pct(share(p.sponsor, p.total))}
                  </td>
                  <td className={styles.number}>{money(p.institution)}</td>
                  <td className={styles.number}>
                    {pct(share(p.institution, p.total))}
                  </td>
                  <td className={styles.number}>{money(p.total)}</td>
                  <td className={styles.rowActions}>
                    <button
                      type="button"
                      id={`award-cost-period-${idPart(p.id)}-edit`}
                      className="gn-btn gn-btn--borderless gn-btn--icon"
                      aria-label={`${view.texts.editCost} ${p.start}`}
                      title={view.texts.editCost}
                      disabled={readOnly || row !== null}
                      onClick={() =>
                        setRow({
                          itemId: Number(p.id),
                          start: p.start,
                          end: p.end,
                          unitType: p.unitType,
                          quantity: text(p.quantity),
                          hours: text(p.hours),
                          months: text(p.months),
                          split: {
                            sponsor: p.sponsor,
                            institution: p.institution,
                            total: p.total,
                            sponsorPct: share(p.sponsor, p.total),
                            institutionPct: share(p.institution, p.total),
                          },
                        })
                      }
                    >
                      <Icon name="edit" size={14} />
                    </button>
                    <button
                      type="button"
                      id={`award-cost-period-${idPart(p.id)}-delete`}
                      className="gn-btn gn-btn--borderless gn-btn--icon"
                      aria-label={`${view.texts.deleteCost} ${p.start}`}
                      title={view.texts.deleteCost}
                      disabled={
                        !view.gates.remove || isActive(`period-delete-${p.id}`)
                      }
                      onClick={() => remove(Number(p.id))}
                    >
                      <Icon name="trash" size={14} />
                    </button>
                  </td>
                </tr>
              ),
            )}
          </tbody>
        </table>
      </div>
      {confirm.element}
    </div>
  );
}
