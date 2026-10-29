"use client";
import { useState, useTransition } from "react";
import omit from "lodash/omit";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/ui/icon";
import { HelpButton } from "@/components/ui/help-button";
import { Collapsible } from "@/components/ui/collapsible";
import { Select } from "@/components/ui/select";
import { DateInput } from "@/components/ui/date-input";
import { useToast } from "@/components/feedback/toast";
import { ActionDialog } from "@/components/dialog/action-dialog";
import { useActionFailure } from "@/components/dialog/action-failure";
import { useInFlight } from "@/lib/hooks/use-in-flight";
import { awards } from "@/lib/api";
import { type FormatSettings } from "@/lib/format";
import { periodBound } from "./budget-model";
import { ProjectCostsPanel } from "./project-costs";
import type {
  Field,
  ProjectField,
  ProjectRow,
  ProjectsView,
  TeamMember,
} from "./projects-types";
import dialog from "@/components/dialog/dialog.module.css";
import styles from "./tabs.module.css";
import { functions } from "@/lib/functions";

export type Money = FormatSettings & { currency?: string };
const INNER = ["projects", "costs", "team"] as const;
type Inner = (typeof INNER)[number];

/** Projects (legacy awards-projects): the Projects, Project Costs and Project Team inner tabs. */
export function ProjectsTab({
  view,
  format,
}: {
  view: ProjectsView;
  format?: Money;
}) {
  const [inner, setInner] = useState<Inner>("projects"),
    router = useRouter(),
    [, startTransition] = useTransition();
  const refresh = () => startTransition(() => router.refresh());
  const select = (next: Inner, focus?: HTMLElement) => {
    setInner(next);
    focus?.focus();
  };
  return (
    <div id="award-record-projects" className={styles.tab}>
      <div
        id="award-projects-tabs"
        role="tablist"
        aria-label={view.texts.projects}
        className={styles.innerTabs}
        onKeyDown={(e) => {
          if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(e.key))
            return;
          e.preventDefault();
          const at = INNER.indexOf(inner),
            last = INNER.length - 1;
          const next =
            e.key === "Home"
              ? 0
              : e.key === "End"
                ? last
                : (at + (e.key === "ArrowRight" ? 1 : last)) % INNER.length;
          select(
            INNER[next],
            e.currentTarget.querySelectorAll<HTMLElement>('[role="tab"]')[next],
          );
        }}
      >
        {INNER.map((t) => (
          <button
            key={t}
            type="button"
            role="tab"
            id={`award-projects-tab-${t}`}
            aria-selected={inner === t}
            aria-controls={`award-projects-panel-${t}`}
            tabIndex={inner === t ? 0 : -1}
            onClick={() => select(t)}
          >
            {view.texts[t]}
          </button>
        ))}
      </div>
      <div
        key={inner}
        id={`award-projects-panel-${inner}`}
        role="tabpanel"
        aria-labelledby={`award-projects-tab-${inner}`}
        className={styles.tab}
      >
        {inner === "projects" && (
          <ProjectsPanel view={view} format={format} onSaved={refresh} />
        )}
        {inner === "costs" && (
          <ProjectCostsPanel view={view} format={format} onSaved={refresh} />
        )}
        {inner === "team" && (
          <TeamPanel view={view} format={format} onSaved={refresh} />
        )}
      </div>
    </div>
  );
}

/** A labelled text input for a dialog cell. */
export function TextCell({
  id,
  field,
  value,
  invalid,
  disabled,
  readOnly,
  type = "text",
  onChange,
}: {
  id: string;
  field: Field;
  value: string;
  invalid?: boolean;
  disabled?: boolean;
  readOnly?: boolean;
  type?: "text" | "email" | "number";
  onChange?: (next: string) => void;
}) {
  return (
    <label className={`gn-field ${dialog.cell}`}>
      <span className="gn-label">
        {field.label}
        {field.required && !readOnly ? " *" : ""}
        <HelpButton id={`${id}-help`} html={field.help} />
      </span>
      <input
        id={id}
        className="gn-control"
        type={type}
        min={type === "number" ? 0 : undefined}
        step={type === "number" ? "any" : undefined}
        value={value}
        readOnly={readOnly}
        disabled={disabled}
        aria-invalid={invalid || undefined}
        onChange={(e) => onChange?.(e.target.value)}
      />
    </label>
  );
}
/** A labelled searchable select for a dialog cell. */
export function SelectCell({
  id,
  field,
  options,
  value,
  invalid,
  disabled,
  onChange,
}: {
  id: string;
  field: Field;
  options: { value: string; label: string }[];
  value: string;
  invalid?: boolean;
  disabled?: boolean;
  onChange: (next: string) => void;
}) {
  return (
    <div className={`gn-field ${dialog.cell}`}>
      <label className="gn-label" htmlFor={`${id}-trigger`}>
        {field.label}
        {field.required ? " *" : ""}
        <HelpButton id={`${id}-help`} html={field.help} />
      </label>
      <Select
        id={id}
        label={field.label}
        options={options}
        value={value}
        disabled={disabled}
        invalid={invalid}
        onChange={onChange}
      />
    </div>
  );
}
/** A labelled date for a dialog cell, bounded as legacy getPeriodDateBound. */
export function DateCell({
  id,
  field,
  value,
  min,
  max,
  invalid,
  disabled,
  onChange,
}: {
  id: string;
  field: Field;
  value: string;
  min: string;
  max: string;
  invalid?: boolean;
  disabled?: boolean;
  onChange: (next: string) => void;
}) {
  return (
    <div className={`gn-field ${dialog.cell}`}>
      <span className="gn-label">
        <span aria-hidden="true">
          {field.label}
          {field.required ? " *" : ""}
        </span>
        <HelpButton id={`${id}-help`} html={field.help} />
      </span>
      <DateInput
        id={id}
        label={field.label}
        value={value}
        min={min || undefined}
        max={max || undefined}
        disabled={disabled}
        invalid={invalid}
        onChange={onChange}
      />
    </div>
  );
}
/** The start/end bounds inside the award (legacy getDate / getPeriodDateBound). */
export const dateBounds = (
  award: { start: string; end: string },
  start: string,
  end: string,
) => ({
  startMax: periodBound(award.end, end, false, award.start),
  endMin: periodBound(award.start, start, true, award.end),
});
/** The dialog's foot: Cancel and Save, both held while saving. */
export function DialogFoot({
  id,
  saving,
  texts,
  onCancel,
  onSave,
}: {
  id: string;
  saving: boolean;
  texts: { save: string; cancel: string };
  onCancel: () => void;
  onSave: () => void;
}) {
  return (
    <div className={dialog.foot}>
      <button
        type="button"
        id={`${id}-cancel`}
        className="gn-btn gn-btn--outlined"
        disabled={saving}
        onClick={onCancel}
      >
        {texts.cancel}
      </button>
      <button
        type="button"
        id={`${id}-save`}
        className="gn-btn gn-btn--primary"
        disabled={saving}
        onClick={onSave}
      >
        {texts.save}
      </button>
    </div>
  );
}

// ── Projects ──────────────────────────────────────────────────────────────────

const PROJECT_COLUMNS = [
  "name",
  "number",
  "erpId",
  "managerEmail",
  "orgId",
  "start",
  "end",
] as const;
const PROJECT_TEXT: ProjectField[] = [
  "intellectualProperty",
  "researchLocation",
  "researchOffice",
  "enteredBy",
  "creditReceiver",
  "conflict",
  "conflictDetails",
];
const EMPTY_PROJECT = {
  id: "",
  name: "",
  number: "",
  managerEmail: "",
  orgId: "",
  start: "",
  end: "",
  intellectualProperty: "",
  researchLocation: "",
  researchOffice: "",
  enteredBy: "",
  creditReceiver: "",
  conflict: "",
  conflictDetails: "",
};
type ProjectDraft = typeof EMPTY_PROJECT;
const draftOf = (p: ProjectRow): ProjectDraft => ({
  id: p.id,
  name: p.name,
  number: p.number,
  managerEmail: p.managerEmail,
  orgId: p.orgId,
  start: p.start,
  end: p.end,
  intellectualProperty: p.intellectualProperty,
  researchLocation: p.researchLocation,
  researchOffice: p.researchOffice,
  enteredBy: p.enteredBy,
  creditReceiver: p.creditReceiver,
  conflict: p.conflict,
  conflictDetails: p.conflictDetails,
});

function ProjectsPanel({
  view,
  format,
  onSaved,
}: {
  view: ProjectsView;
  format?: Money;
  onSaved: () => void;
}) {
  const [draft, setDraft] = useState<ProjectDraft | null>(null);
  const f = view.projectFields;
  const cell = (p: ProjectRow, k: (typeof PROJECT_COLUMNS)[number]) =>
    k === "start" || k === "end"
      ? functions.format.dateDisplay(p[k], format)
      : k === "orgId"
        ? p.orgName
        : p[k];
  const shown = PROJECT_COLUMNS.filter((k) => f[k].show);
  return (
    <>
      {view.gates.addProject && (
        <div className={styles.actions}>
          <button
            type="button"
            id="award-projects-add"
            className="gn-btn gn-btn--primary"
            onClick={() => setDraft(EMPTY_PROJECT)}
          >
            {view.texts.addProject}
          </button>
        </div>
      )}
      <div className="gn-table-scroll" data-height="short">
        <table id="award-projects-table" className="gn-table">
          <thead>
            <tr>
              {shown.map((k) => (
                <th key={k} scope="col">
                  {f[k].label}
                </th>
              ))}
              <th scope="col">
                <span className="sr-only">{view.texts.editProject}</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {view.projects.map((p) => (
              <tr key={p.id} id={`award-project-${functions.ids.idPart(p.id)}`}>
                {shown.map((k) => (
                  <td key={k}>{cell(p, k)}</td>
                ))}
                <td>
                  <button
                    type="button"
                    id={`award-project-${functions.ids.idPart(p.id)}-edit`}
                    className="gn-btn gn-btn--borderless gn-btn--icon"
                    aria-label={`${view.texts.editProject} ${p.name}`}
                    title={view.texts.editProject}
                    disabled={!view.gates.edit || !p.editable}
                    onClick={() => setDraft(draftOf(p))}
                  >
                    <Icon name="edit" size={14} />
                  </button>
                </td>
              </tr>
            ))}
            {view.projects.length === 0 && (
              <tr>
                <td colSpan={shown.length + 1} className="gn-table-empty">
                  {view.texts.noData}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {draft && (
        <ProjectDialog
          view={view}
          initial={draft}
          onClose={() => setDraft(null)}
          onSaved={() => {
            setDraft(null);
            onSaved();
          }}
        />
      )}
    </>
  );
}

function ProjectDialog({
  view,
  initial,
  onClose,
  onSaved,
}: {
  view: ProjectsView;
  initial: ProjectDraft;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [d, setD] = useState(initial),
    [touched, setTouched] = useState(false),
    { run, isActive } = useInFlight(),
    toast = useToast(),
    fail = useActionFailure(),
    saving = isActive("project");
  const f = view.projectFields;
  const set = (k: keyof ProjectDraft) => (v: string) =>
    setD((s) => ({ ...s, [k]: v }));
  const missing = (k: ProjectField) =>
    f[k].show && f[k].required && k in d && d[k as keyof ProjectDraft] === "";
  const bounds = dateBounds(view.award, d.start, d.end);
  const save = () => {
    setTouched(true);
    if ((Object.keys(f) as ProjectField[]).some(missing))
      return toast.show("error", view.texts.required);
    run(async () => {
      const result = await awards.saveProjects(
        view.awardId,
        "project",
        omit(d, "number"),
      );
      if (!result.ok) return fail(result.error);
      toast.show("success", view.texts.projectSaved);
      onSaved();
    }, "project");
  };
  const invalid = (k: ProjectField) => touched && missing(k);
  return (
    <ActionDialog
      id="award-project-dialog"
      title={view.texts.projectTitle}
      width="83.333vw" /* legacy dialogAwardProjectEdit oj-md-10 */
      busy={saving}
      onClose={onClose}
    >
      <div className={dialog.convert}>
        {f.name.show && (
          <TextCell
            id="award-project-name"
            field={f.name}
            value={d.name}
            invalid={invalid("name")}
            disabled={saving}
            onChange={set("name")}
          />
        )}
        {d.id && (
          <TextCell
            id="award-project-number"
            field={f.number}
            value={d.number}
            readOnly
          />
        )}
        {f.managerEmail.show && (
          <TextCell
            id="award-project-manager-email"
            field={f.managerEmail}
            type="email"
            value={d.managerEmail}
            invalid={invalid("managerEmail")}
            disabled={saving}
            onChange={set("managerEmail")}
          />
        )}
        {f.orgId.show && (
          <SelectCell
            id="award-project-org"
            field={f.orgId}
            options={view.choices.orgs}
            value={d.orgId}
            invalid={invalid("orgId")}
            disabled={saving}
            onChange={set("orgId")}
          />
        )}
        {f.start.show && (
          <DateCell
            id="award-project-start"
            field={f.start}
            value={d.start}
            min={view.award.start}
            max={bounds.startMax}
            invalid={invalid("start")}
            disabled={saving}
            onChange={set("start")}
          />
        )}
        {f.end.show && (
          <DateCell
            id="award-project-end"
            field={f.end}
            value={d.end}
            min={bounds.endMin}
            max={view.award.end}
            invalid={invalid("end")}
            disabled={saving}
            onChange={set("end")}
          />
        )}
        {PROJECT_TEXT.map(
          (k) =>
            f[k].show && (
              <TextCell
                key={k}
                id={`award-project-${functions.ids.idPart(k)}`}
                field={f[k]}
                value={d[k as keyof ProjectDraft]}
                invalid={invalid(k)}
                disabled={saving}
                onChange={set(k as keyof ProjectDraft)}
              />
            ),
        )}
        <DialogFoot
          id="award-project"
          saving={saving}
          texts={view.texts}
          onCancel={onClose}
          onSave={save}
        />
      </div>
    </ActionDialog>
  );
}

// ── Project Team ──────────────────────────────────────────────────────────────

type TeamDraft = Pick<
  TeamMember,
  "id" | "personId" | "projectId" | "roleId" | "start" | "end"
>;
const TEAM_FIELDS = [
  "personId",
  "projectId",
  "roleId",
  "start",
  "end",
] as const;

function TeamPanel({
  view,
  format,
  onSaved,
}: {
  view: ProjectsView;
  format?: Money;
  onSaved: () => void;
}) {
  const [draft, setDraft] = useState<TeamDraft | null>(null);
  const c = view.teamColumns;
  const only = <T,>(list: T[], required: boolean) =>
    required && list.length === 1 ? list[0] : undefined;
  // Legacy pre-fills the only project and the only role when the field is required.
  const add = () =>
    setDraft({
      id: "",
      personId: "",
      projectId:
        only(view.projects, view.teamFields.projectId.required)?.id ?? "",
      roleId:
        only(view.choices.roles, view.teamFields.roleId.required)?.value ?? "",
      start: "",
      end: "",
    });
  return (
    <>
      {view.gates.addTeam && (
        <div className={styles.actions}>
          <button
            type="button"
            id="award-team-add"
            className="gn-btn gn-btn--primary"
            onClick={add}
          >
            {view.texts.addTeam}
          </button>
        </div>
      )}
      {view.projects.map((p) => {
        const members = view.team.filter((m) => m.projectId === p.id);
        return (
          <Collapsible
            key={p.id}
            id={`award-team-project-${functions.ids.idPart(p.id)}`}
            className={styles.collapsible}
            heading={<span>{p.number || p.name}</span>}
          >
            <div className="gn-table-scroll" data-height="none">
              <table className="gn-table">
                <thead>
                  <tr>
                    <th scope="col">{c.project}</th>
                    <th scope="col">{c.projectName}</th>
                    <th scope="col">{c.person}</th>
                    <th scope="col">{c.role}</th>
                    <th scope="col">{c.start}</th>
                    <th scope="col">{c.end}</th>
                    <th scope="col">
                      <span className="sr-only">{view.texts.editTeam}</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {members.map((m) => (
                    <tr
                      key={m.id}
                      id={`award-team-${functions.ids.idPart(m.id)}`}
                    >
                      <td>{p.number}</td>
                      <td>{m.projectName || p.name}</td>
                      <td>{m.person}</td>
                      <td>{m.role}</td>
                      <td>{functions.format.dateDisplay(m.start, format)}</td>
                      <td>{functions.format.dateDisplay(m.end, format)}</td>
                      <td>
                        <button
                          type="button"
                          id={`award-team-${functions.ids.idPart(m.id)}-edit`}
                          className="gn-btn gn-btn--borderless gn-btn--icon"
                          aria-label={`${view.texts.editTeam} ${m.person}`}
                          title={view.texts.editTeam}
                          disabled={!view.gates.edit || !m.editable}
                          onClick={() => setDraft(m)}
                        >
                          <Icon name="edit" size={14} />
                        </button>
                      </td>
                    </tr>
                  ))}
                  {members.length === 0 && (
                    <tr>
                      <td colSpan={7} className="gn-table-empty">
                        {view.texts.noData}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </Collapsible>
        );
      })}
      {view.projects.length === 0 && (
        <p id="award-team-empty" className={styles.empty}>
          {view.texts.noData}
        </p>
      )}
      {draft && (
        <TeamDialog
          view={view}
          initial={draft}
          onClose={() => setDraft(null)}
          onSaved={() => {
            setDraft(null);
            onSaved();
          }}
        />
      )}
    </>
  );
}

function TeamDialog({
  view,
  initial,
  onClose,
  onSaved,
}: {
  view: ProjectsView;
  initial: TeamDraft;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [d, setD] = useState<TeamDraft>({
      id: initial.id,
      personId: initial.personId,
      projectId: initial.projectId,
      roleId: initial.roleId,
      start: initial.start,
      end: initial.end,
    }),
    [touched, setTouched] = useState(false),
    { run, isActive } = useInFlight(),
    toast = useToast(),
    fail = useActionFailure(),
    saving = isActive("team");
  const f = view.teamFields;
  const set = (k: keyof TeamDraft) => (v: string) =>
    setD((s) => ({ ...s, [k]: v }));
  const missing = (k: (typeof TEAM_FIELDS)[number]) =>
    f[k].show && f[k].required && d[k] === "";
  const invalid = (k: (typeof TEAM_FIELDS)[number]) => touched && missing(k);
  const bounds = dateBounds(view.award, d.start, d.end);
  const save = () => {
    setTouched(true);
    if (TEAM_FIELDS.some(missing))
      return toast.show("error", view.texts.required);
    run(async () => {
      const result = await awards.saveProjects(view.awardId, "team", d);
      if (!result.ok) return fail(result.error);
      toast.show("success", view.texts.teamSaved);
      onSaved();
    }, "team");
  };
  return (
    <ActionDialog
      id="award-team-dialog"
      title={view.texts.teamTitle}
      width="57.307vw" /* legacy dialogAwardTeamEdit 1000px at 1745px */
      busy={saving}
      onClose={onClose}
    >
      <div className={dialog.convert}>
        {f.personId.show && (
          <SelectCell
            id="award-team-person"
            field={f.personId}
            options={view.choices.staff}
            value={d.personId}
            invalid={invalid("personId")}
            disabled={saving}
            onChange={set("personId")}
          />
        )}
        {f.projectId.show && (
          <SelectCell
            id="award-team-project"
            field={f.projectId}
            options={view.projects.map((p) => ({
              value: p.id,
              label: p.number || p.name,
            }))}
            value={d.projectId}
            invalid={invalid("projectId")}
            disabled={saving}
            onChange={set("projectId")}
          />
        )}
        {f.roleId.show && (
          <SelectCell
            id="award-team-role"
            field={f.roleId}
            options={view.choices.roles}
            value={d.roleId}
            invalid={invalid("roleId")}
            disabled={saving}
            onChange={set("roleId")}
          />
        )}
        {f.start.show && (
          <DateCell
            id="award-team-start"
            field={f.start}
            value={d.start}
            min={view.award.start}
            max={bounds.startMax}
            invalid={invalid("start")}
            disabled={saving || !d.projectId}
            onChange={set("start")}
          />
        )}
        {f.end.show && (
          <DateCell
            id="award-team-end"
            field={f.end}
            value={d.end}
            min={bounds.endMin}
            max={view.award.end}
            invalid={invalid("end")}
            disabled={saving || !d.projectId}
            onChange={set("end")}
          />
        )}
        <DialogFoot
          id="award-team"
          saving={saving}
          texts={view.texts}
          onCancel={onClose}
          onSave={save}
        />
      </div>
    </ActionDialog>
  );
}
