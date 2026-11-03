"use client";
import { endpoint, pagedEndpoint } from "../hooks";
import { post } from "../http";
import {
  serializeEthicsFilters,
  type EthicsFilters,
} from "@/features/modules/ethics/schema";
import type { EthicsRow } from "@/server/modules/ethics/listing";
import type { SelectOption } from "@/components/ui/select";

type Page = { rows: EthicsRow[]; hasMore: boolean };
export const list = pagedEndpoint<EthicsFilters, EthicsRow, Page>(
  (filters) => ({
    path: "/ethics",
    query: Object.fromEntries(
      new URLSearchParams(serializeEthicsFilters(filters)),
    ),
  }),
  (body) => body,
  { size: 10 },
);
export const choices = endpoint<
  { kind: string; access?: string },
  SelectOption[]
>(({ kind, access }) => ({ path: "/ethics/choices", query: { kind, access } }));
export type DeletedEthics = {
  id: string;
  number: string;
  title: string;
  status: string;
  org: string;
  canRestore: boolean;
};
export const deleted = endpoint<void, DeletedEthics[]>(() => ({
  path: "/ethics/recycle",
}));
export const restore = (id: string) =>
  post<{ restored: boolean }>("/ethics/recycle", { id });
export type CreateSetup = {
  orgs: SelectOption[];
  types: SelectOption[];
  formTypes: SelectOption[];
};
export const createSetup = endpoint<void, CreateSetup>(() => ({
  path: "/ethics/create",
}));
export const createForm = endpoint<
  string,
  { formId: number; sections: { id: string; enabled: boolean }[] }
>((formType) => ({ path: "/ethics/create/form", query: { formType } }));
export type CreateEthics = {
  title: string;
  org: string;
  formType: string;
  ethicsType: string;
  deadline?: string;
  expiry?: string;
};
export const create = (value: CreateEthics) =>
  post<{ id: string }>("/ethics/create", value);
