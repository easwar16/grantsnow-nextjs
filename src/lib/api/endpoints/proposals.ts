"use client";
import {
  serializeQuery,
  type ProposalQuery,
} from "@/features/modules/proposals/schemas";
import type { ProposalPage } from "@/features/modules/proposals/types";
import type {
  ChoiceGroup,
  ChoiceGroupResult,
} from "@/features/modules/proposals/lookups";
import { download, get, post, put } from "../http";
import { endpoint } from "../hooks";
import { constants } from "@/lib/constants";

/** One of the listing's choice groups (held reference lists), read once the page shows. */
export const choices = endpoint<ChoiceGroup, ChoiceGroupResult>(
  (group) => ({ path: "/proposals/choices", query: { group } }),
  { ttl: constants.ttl.session },
);

/** One listing page for the query (its `page` / `pageSize`); the server builds the where clause. */
export const page = (q: ProposalQuery, signal?: AbortSignal) =>
  get<ProposalPage>(
    "/proposals",
    Object.fromEntries(new URLSearchParams(serializeQuery(q))),
    signal,
  );
export type DeletedProposal = {
  id: number;
  type: string;
  reference: string;
  title: string;
  status: string;
  canRestore: boolean;
};
export type CopyOption = { value: string; label: string; required: boolean };
export type ShareOptions = {
  reports: { value: string; label: string }[];
  people: { value: string; label: string; detail: string }[];
};
export type AdvancedSetup = {
  attributes: { value: string; label: string }[];
  operators: { value: string; label: string }[];
  texts: Record<
    | "title"
    | "attribute"
    | "operator"
    | "value"
    | "add"
    | "edit"
    | "remove"
    | "save"
    | "cancel"
    | "close"
    | "editTitle",
    string
  >;
};
export const advancedSetup = endpoint<void, AdvancedSetup>(() => ({
  path: "/proposals/advanced",
}));
export const recycle = () =>
  get<DeletedProposal[]>("/proposals/list-actions", { action: "recycle" });
export const links = (type: string, id: string) =>
  get<import("@/features/record/linked/model").LinkedObjects>(
    "/proposals/list-actions",
    { action: "links", type, id },
  );
export const copyOptions = (type: string, id: string) =>
  get<CopyOption[]>("/proposals/list-actions", {
    action: "copy-options",
    type,
    id,
  });
export const shareOptions = (type: string, id: string) =>
  get<ShareOptions>("/proposals/list-actions", {
    action: "share-options",
    type,
    id,
  });
export const shareDocument = (
  type: string,
  id: string,
  report: string,
  emails: string[],
) =>
  post<{ shared: boolean }>("/proposals/list-actions", {
    action: "share-document",
    type,
    id,
    report,
    emails,
  });
export const clone = (type: string, id: string, objects: string[]) =>
  post<{ id: number; type: string }>("/proposals/list-actions", {
    action: "copy",
    type,
    id,
    objects,
  });
export const removeFromList = (type: string, id: string) =>
  post<{ deleted: boolean }>("/proposals/list-actions", {
    action: "delete",
    type,
    id,
  });
export const restoreFromRecycle = (id: number) =>
  post<{ restored: boolean }>("/proposals/list-actions", {
    action: "restore",
    id,
  });
export const create = (input: {
  type: "PROPOSAL" | "OUTLINE_PROPOSAL";
  title: string;
  description: string;
  piPersonId: number;
  activityType: string;
  proposalStage: string;
  proposalType: string;
  category: string;
  startDate: string;
  endDate: string;
  costModel: number;
  confidential: "Y" | "N";
  sponsors: {
    relationId: null;
    partyId: number;
    roleCode: string;
    priority: number;
  }[];
  deadlines: {
    id: null;
    type: string;
    date: string | null;
    description: string;
  }[];
  tags: string;
  assignedTo: number | null;
  opportunityTitle: string;
  opportunityUrl: string;
  collaboratorFlag?: "Y" | "N";
  collaborators?: {
    relationId: number | null;
    collaboratorId: number;
    roleCode: string;
    description: string;
    costingEnabled: boolean;
  }[];
  subprojectFlag?: "Y" | "N";
  subprojects?: {
    relationId: number | null;
    personId: number;
    employeeNumber: string;
    orgUnitId: number;
    typeCode: string;
    excludePricing: boolean;
  }[];
  attributes?: Record<string, string | number | string[] | null>;
  sourceRequestId?: number;
}) => post<{ id: number; type: string }>("/proposals/create", input);
export type ApprovedAoi = {
  id: string;
  number: string;
  status: string;
  title: string;
  logo: string;
  funders: string;
  creator: string;
  department: string;
  created: string;
};
export type ApprovedAoiPage = {
  rows: ApprovedAoi[];
  total: number | null;
  hasMore: boolean;
};
export const approvedAois = (offset = 0, signal?: AbortSignal) =>
  get<ApprovedAoiPage>("/proposals/approved-aoi", { offset }, signal);
export const approvedAoiSource = (id: string) =>
  get<{ opportunityId: string }>("/proposals/approved-aoi", { id });
export const setSummaryFinalized = (
  type: string,
  id: string,
  finalize: boolean,
) =>
  post<{ finalized: boolean }>(`/proposals/${type}/${id}/finalize`, {
    finalize,
  });
export const saveSummaryEdit = (
  type: string,
  id: string,
  input: {
    title: string;
    description: string;
    tags: string;
    opportunityTitle: string;
    opportunityUrl: string;
    activityType: string;
    proposalStage: string;
    proposalType: string;
    category: string;
    confidential: string;
    assignedTo: number | null;
    piPersonId?: number;
    startDate: string;
    endDate: string;
    costModel: number;
    version?: {
      newVersion: boolean;
      description: string;
      retainCosting: "RETAIN" | "NO_RETAIN" | null;
    };
    attributes?: Record<string, string | number | string[] | null>;
    deadlines?: {
      id: number | null;
      type: string;
      date: string | null;
      description: string;
    }[];
    sponsors?: {
      relationId: number | null;
      partyId: number;
      roleCode: string;
      priority: number;
    }[];
    collaboratorFlag?: "Y" | "N";
    collaborators?: {
      relationId: number | null;
      collaboratorId: number;
      roleCode: string;
      description: string;
      costingEnabled: boolean;
    }[];
    subprojectFlag?: "Y" | "N";
    subprojects?: {
      relationId: number | null;
      personId: number;
      orgUnitId: number;
      employeeNumber: string;
      typeCode: string;
      excludePricing: boolean;
    }[];
  },
) => post<{ saved: true }>(`/proposals/${type}/${id}/edit`, input);
export const ai = (type: string, id: string, kind: "summary" | "comparison") =>
  get<{ html: string }>(`/proposals/${type}/${id}/ai`, { kind });
export const costingAnalysis = (type: string, id: string, query: string) =>
  post<{
    rows: Record<string, string | number | boolean | null>[];
    chart: { name: string; types: string[] };
  }>(`/proposals/${type}/${id}/fec-summary`, { query });
export const viability = (type: string, id: string) =>
  get<{ columns: string[]; rows: Record<string, string>[] }>(
    `/proposals/${type}/${id}/budget/viability`,
  );
export const quickCostOptions = (type: string, id: string, kind: string) =>
  get<{
    versionId: number;
    sections: { value: string; label: string }[];
    roles: { value: string; label: string }[];
    categories: { value: string; label: string }[];
    items: { category: string; value: string; label: string }[];
    people: { value: string; label: string }[];
  }>(`/proposals/${type}/${id}/budget/quick-cost`, { kind });
export const saveQuickCost = (
  type: string,
  id: string,
  input: {
    kind:
      | "quick"
      | "staff"
      | "student"
      | "pool-tech"
      | "non-staff"
      | "research-partner";
    versionId: number;
    rows: {
      section: string;
      category: string;
      item: string;
      description: string;
      personId: number | null;
      startDate: string;
      endDate: string;
      units: number;
      cost: number | null;
    }[];
  },
) =>
  post<{ saved: boolean }>(`/proposals/${type}/${id}/budget/quick-cost`, input);

export const staffEntryPerson = (type: string, id: string, personId: number) =>
  get<{
    personId: number;
    name: string;
    employeeNumber: string;
    orgUnitId: number;
    orgUnitName: string;
    faculty: string;
    probationEndDate: string;
    firstIncrement: string;
    projectRole: string;
    fundingSection: string;
    salaryModel: string;
    hrFte: string;
  }>(`/proposals/${type}/${id}/budget/staff-entry`, {
    personId: String(personId),
  });

export const staffEntryAvailability = (
  type: string,
  id: string,
  personId: number,
) =>
  get<{
    startDate: string;
    endDate: string;
    items: {
      proposalNumber: string;
      startDate: string;
      endDate: string;
      fte: number;
    }[];
  }>(`/proposals/${type}/${id}/budget/staff-entry`, {
    action: "availability",
    personId: String(personId),
  });

export const createStaffCostHeader = (
  type: string,
  id: string,
  input: {
    kind: "staff" | "student" | "pool-tech";
    versionId: number;
    personId: number | null;
    name: string;
    employeeNumber: string;
    orgUnitId: number | null;
    projectRole: string;
    fundingSection: string;
    salaryModel: string;
    probationEndDate: string;
    firstIncrement: string;
    hrFte: number | null;
    studentNumber: string;
    overrideInflation: boolean;
    inflationRate: number | null;
    additionalAnswers: Record<string, string>;
  },
) =>
  post<{
    costHeaderId: number;
    lines: {
      id: number;
      startDate: string;
      endDate: string;
      unitType: string;
      units: string;
      baseline: string;
      unindexed: string;
      total: string;
    }[];
  }>(`/proposals/${type}/${id}/budget/staff-entry`, input);

export const saveStaffCostLines = (
  type: string,
  id: string,
  input: {
    kind: "staff" | "student" | "pool-tech";
    versionId: number;
    costHeaderId: number;
    lines: {
      id: number;
      startDate: string;
      endDate: string;
      unitType: string;
      units: number;
      baseline: number | null;
    }[];
  },
) => put<{ saved: boolean }>(`/proposals/${type}/${id}/budget/staff-entry`, input);

/** WRITES (generate-report): a Print report file, as the server names it. */
export const printReport = (
  type: string,
  id: string,
  code: string,
  currency: string,
) => download(`/proposals/${type}/${id}/print`, undefined, { code, currency });

export interface StaffContact {
  fullName: string;
  employeeNumber: string;
  email: string;
  orgUnit: string;
  position: string;
  school: string;
  address: string;
}

export const staffContact = endpoint<
  { type: string; id: string; costHeaderId: string; versionId: number | null },
  StaffContact
>((p) => ({
  path: `/proposals/${p.type}/${p.id}/budget/staff/${p.costHeaderId}/contact`,
  query: p.versionId ? { version: p.versionId } : undefined,
}));
