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
  orgs: SelectOption[];
  types: SelectOption[];
  formTypes: SelectOption[];
  labels: Record<string, string>;
};
export const createSetup = endpoint<void, CreateSetup>(() => ({
  path: "/due-diligence/actions/create",
}));
export const createForm = endpoint<
  string,
  { formId: number; sections: { id: string; enabled: boolean }[] }
>((formType) => ({ path: "/due-diligence/actions/form", query: { formType } }));
export const createPeople = endpoint<
  string,
  { value: string; label: string; detail: string }[]
>((org) => ({ path: "/due-diligence/actions/people", query: { org } }));
export const createSupervisors = endpoint<void, SelectOption[]>(() => ({
  path: "/due-diligence/actions/supervisors",
}));
export type CreateDueDiligence = {
  title: string;
  org: string;
  formType: string;
  dueDiligenceType: string;
  deadline?: string;
  expiry?: string;
  participants?: string[];
  supervisor?: string;
};
export const create = (value: CreateDueDiligence) =>
  post<{ id: string }>("/due-diligence/actions/create", value);
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
