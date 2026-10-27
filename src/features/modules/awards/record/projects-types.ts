import type { ProjectCosts } from "./projects-model";

type Option = { value: string; label: string };
export interface Field {
  show: boolean;
  required: boolean;
  label: string;
  /** The RB key's More Info (sanitised on the server); null when it has none. */
  help?: string | null;
}
export interface ProjectRow {
  id: string;
  linkId: string;
  templateId: string;
  name: string;
  number: string;
  erpId: string;
  managerEmail: string;
  orgId: string;
  orgName: string;
  start: string;
  end: string;
  intellectualProperty: string;
  researchLocation: string;
  researchOffice: string;
  enteredBy: string;
  creditReceiver: string;
  conflict: string;
  conflictDetails: string;
  indirectSchedule: string;
  allowedSchedule: string;
  editable: boolean;
}
export interface TeamMember {
  id: string;
  personId: string;
  person: string;
  projectId: string;
  projectName: string;
  roleId: string;
  role: string;
  start: string;
  end: string;
  erpId: string;
  editable: boolean;
}
export type ProjectField =
  | "name"
  | "number"
  | "erpId"
  | "managerEmail"
  | "orgId"
  | "start"
  | "end"
  | "intellectualProperty"
  | "researchLocation"
  | "researchOffice"
  | "enteredBy"
  | "creditReceiver"
  | "conflict"
  | "conflictDetails";
export type CostColumn =
  | "item"
  | "role"
  | "start"
  | "end"
  | "glNominal"
  | "unitType"
  | "quantity"
  | "hours"
  | "months"
  | "sponsor"
  | "sponsorPct"
  | "institution"
  | "institutionPct"
  | "total";
export type CostField =
  | "project"
  | "start"
  | "end"
  | "section"
  | "category"
  | "item"
  | "person"
  | "months"
  | "role"
  | "unitType"
  | "units"
  | "hours"
  | "description"
  | "glNominal"
  | "sponsor"
  | "sponsorPct"
  | "institution"
  | "institutionPct"
  | "total";
/** The Projects tab (legacy awards-projects): its three inner tabs' data, gates, fields and texts. */
export interface ProjectsView {
  awardId: string;
  award: { start: string; end: string };
  projects: ProjectRow[];
  team: TeamMember[];
  costs: ProjectCosts[];
  gates: Record<
    | "edit"
    | "remove"
    | "addProject"
    | "addCost"
    | "addTeam"
    | "editGlobal"
    | "splitByPeriod",
    boolean
  >;
  choices: Record<
    | "orgs"
    | "everyone"
    | "staff"
    | "roles"
    | "sections"
    | "categories"
    | "glNominals"
    | "unitTypes",
    Option[]
  >;
  projectFields: Record<ProjectField, Field>;
  teamFields: Record<
    "personId" | "projectId" | "roleId" | "start" | "end",
    Field
  >;
  teamColumns: Record<
    "project" | "projectName" | "person" | "role" | "start" | "end",
    string
  >;
  costColumns: Record<CostColumn, Field>;
  costFields: Record<CostField, Field>;
  globalFields: Record<
    "instiCost" | "instiPct" | "funderCost" | "funderPct" | "total",
    string
  >;
  texts: Record<
    | "projects"
    | "costs"
    | "team"
    | "addProject"
    | "editProject"
    | "projectTitle"
    | "addCost"
    | "costTitle"
    | "editGlobal"
    | "editCost"
    | "deleteCost"
    | "deleteTitle"
    | "deleteMessage"
    | "clone"
    | "addRow"
    | "addTeam"
    | "editTeam"
    | "teamTitle"
    | "save"
    | "cancel"
    | "total"
    | "noData"
    | "required"
    | "projectSaved"
    | "teamSaved",
    string
  >;
}
/** The cost dialog's lists for a line: its category's items and its periods. */
export interface CostDialogData {
  categoryItems: (Option & { glNominal: string })[];
  periods: {
    id: string;
    start: string;
    end: string;
    unitType: string;
    quantity: number | null;
    hours: number | null;
    months: number | null;
    sponsor: number;
    institution: number;
    total: number;
  }[];
}
