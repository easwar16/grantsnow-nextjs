"use client";
import { endpoint, pagedEndpoint } from "../hooks";
import { post } from "../http";
import {
  serializeDueDiligenceFilters,
  type DueDiligenceFilters,
} from "@/features/modules/due-diligence/schema";
import type { DueDiligenceRow } from "@/server/modules/due-diligence/listing";
import type { SelectOption } from "@/components/ui/select";

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
  path: "/due-diligence/recycle",
}));
export const restore = (id: string) =>
  post<{ restored: boolean }>("/due-diligence/recycle", { id });
export type CreateSetup = {
  orgs: SelectOption[];
  types: SelectOption[];
  formTypes: SelectOption[];
};
export const createSetup = endpoint<void, CreateSetup>(() => ({
  path: "/due-diligence/create",
}));
export const createForm = endpoint<
  string,
  { formId: number; sections: { id: string; enabled: boolean }[] }
>((formType) => ({ path: "/due-diligence/create/form", query: { formType } }));
export const createPeople = endpoint<
  string,
  { value: string; label: string; detail: string }[]
>((org) => ({ path: "/due-diligence/create/people", query: { org } }));
export const createSupervisors = endpoint<void, SelectOption[]>(() => ({
  path: "/due-diligence/create/supervisors",
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
  post<{ id: string }>("/due-diligence/create", value);
