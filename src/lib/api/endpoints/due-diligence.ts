"use client";
import { endpoint, pagedEndpoint } from "../hooks";
import { del, post } from "../http";
import {
  serializeDueDiligenceFilters,
  type DueDiligenceFilters,
} from "@/features/modules/due-diligence/listing/schema";
import type { DueDiligenceRow } from "@/server/modules/due-diligence/listing";
import type { SelectOption } from "@/components/ui/select";
import type { LinkedObjects } from "@/features/record/linked/model";

type Page = { rows: DueDiligenceRow[]; hasMore: boolean };
export const list = pagedEndpoint<DueDiligenceFilters, DueDiligenceRow, Page>(
  (filters) => ({
    path: "/due-diligence",
    query: Object.fromEntries(
      new URLSearchParams(serializeDueDiligenceFilters(filters)),
    ),
  }),
  (body) => body,
  { size: 10 },
);
export const choices = endpoint<
  { kind: string; access?: string },
  SelectOption[]
>(({ kind, access }) => ({
  path: "/due-diligence/choices",
  query: { kind, access },
}));
export type DeletedDueDiligence = {
  id: string;
  number: string;
  title: string;
  status: string;
  org: string;
  canRestore: boolean;
};
export const deleted = endpoint<void, DeletedDueDiligence[]>(() => ({
  path: "/due-diligence/actions/recycle",
}));
export const links = endpoint<{ id: string; access: string }, LinkedObjects>(
  ({ id, access }) => ({
    path: `/due-diligence/${id}/links`,
    query: { access },
  }),
);
export const restore = (id: string) =>
  post<{ restored: boolean }>("/due-diligence/actions/restore", { id });
export type CreateSetup = {
  currentPersonId: string;
  adminAnswer: boolean;
  orgs: SelectOption[];
  types: SelectOption[];
  formTypes: SelectOption[];
  labels: Record<string, string>;
};
export const createSetup = endpoint<void, CreateSetup>(() => ({
  path: "/due-diligence/actions/create",
}));
type SetupTarget = { id?: string; access?: string };
export const createForm = endpoint<
  SetupTarget & { formType: string },
  { formId: number; sections: { id: string; enabled: boolean }[] }
>(({ formType, id, access }) => ({ path: "/due-diligence/actions/form", query: { formType, id, access } }));
export const createPeople = endpoint<
  SetupTarget & { org: string },
  { value: string; label: string; detail: string }[]
>(({ org, id, access }) => ({ path: "/due-diligence/actions/people", query: { org, id, access } }));
export const createSupervisors = endpoint<SetupTarget, SelectOption[]>(({ id, access }) => ({
  path: "/due-diligence/actions/supervisors", query: { id, access },
}));
export type CreateDueDiligence = {
  action?: "draft" | "submit";
  title: string;
  org: string;
  formType: string;
  dueDiligenceType: string;
  deadline?: string;
  expiry?: string;
  participants?: string[];
  supervisor?: string;
  parent?: { type: "PROPOSAL" | "AWARD"; id: string; proposalType?: string };
};
export const create = (value: CreateDueDiligence) =>
  post<{ id: string; respondentId: string | null }>("/due-diligence/actions/create", value);
export const editSetup = endpoint<{ id: string; access: string }, {
  setup: CreateSetup;
  initial: CreateDueDiligence;
}>(({ id, access }) => ({
  path: "/due-diligence/actions/edit", query: { id, access },
}));
export const update = (value: CreateDueDiligence & { id: string; access: string }) =>
  post<{ id: string }>("/due-diligence/actions/edit", value);
export const cloneOptions = endpoint<
  { id: string; access: string },
  { value: string; label: string; selected: boolean }[]
>(({ id, access }) => ({
  path: "/due-diligence/actions/clone-options",
  query: { id, access },
}));
export const clone = (id: string, access: string, objects: string[]) =>
  post<{ cloned: true }>("/due-diligence/actions/clone", {
    id,
    access,
    objects,
  });
export const remove = (id: string, access: string) =>
  del<{ deleted: true }>("/due-diligence/actions/delete", undefined, {
    id,
    access,
  });

export type DueDiligenceParent = { type: "PROPOSAL" | "AWARD"; id: string; proposalType?: string };
export const linkCandidates = endpoint<DueDiligenceParent & {
  number?: string; title?: string; offset?: number;
}, Page>(({ type, id, proposalType, number, title, offset }) => ({
  path: "/due-diligence/actions/link",
  query: { type, id, proposalType, number, title, offset },
}));
export const link = (parent: DueDiligenceParent, id: string) =>
  post<{ linked: boolean; alreadyLinked: boolean }>("/due-diligence/actions/link", { parent, id });
export const referenceTypes = endpoint<{ id: string; access: string }, SelectOption[]>(
  ({ id, access }) => ({ path: "/due-diligence/actions/reference-types", query: { id, access } }),
);
export const referenceItems = endpoint<{ id: string; access: string; type: string },
  { value: string; label: string; detail: string }[]>(
  ({ id, access, type }) => ({ path: "/due-diligence/actions/reference-items", query: { id, access, type } }),
);
export const linkReferences = (id: string, access: string, type: string, objects: string[]) =>
  post<{ linked: boolean }>("/due-diligence/actions/reference-link", { id, access, type, objects });
