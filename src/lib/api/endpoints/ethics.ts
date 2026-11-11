"use client";
import { endpoint, pagedEndpoint } from "../hooks";
import { del, download, post } from "../http";
import {
  serializeEthicsFilters,
  type EthicsFilters,
} from "@/features/modules/ethics/listing/schema";
import type { EthicsRow } from "@/server/modules/ethics/listing";
import type { SelectOption } from "@/components/ui/select";
import type { LinkedObjects } from "@/features/record/linked/model";
import type { AttributeValues } from "@/features/record/attributes/model";

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
  path: "/ethics/actions/recycle",
}));
export const links = endpoint<{ id: string; access: string }, LinkedObjects>(
  ({ id, access }) => ({ path: `/ethics/${id}/links`, query: { access } }),
);
export const versions = endpoint<
  { id: string; access: string },
  { value: number; label: string }[]
>(({ id, access }) => ({ path: `/ethics/${id}/versions`, query: { access } }));
export const restore = (id: string) =>
  post<{ restored: boolean }>("/ethics/actions/restore", { id });
export type CreateSetup = {
  currentPersonId: string;
  adminAnswer: boolean;
  orgs: SelectOption[];
  types: SelectOption[];
  formTypes: SelectOption[];
  labels: Record<string, string>;
};
export const createSetup = endpoint<void, CreateSetup>(() => ({
  path: "/ethics/actions/create",
}));
export const createForm = endpoint<
  { formType: string; id?: string; access?: string },
  { formId: number; sections: { id: string; enabled: boolean }[] }
>(({ formType, id, access }) => ({
  path: "/ethics/actions/form",
  query: { formType, id, access },
}));
export type CreateEthics = {
  title: string;
  org: string;
  formType: string;
  ethicsType: string;
  deadline?: string;
  expiry?: string;
  action?: "draft" | "submit";
  participants?: string[];
  supervisor?: string;
  attributes?: AttributeValues;
  parent?: {
    type: "PROPOSAL";
    id: string;
    proposalType:
      "PROPOSAL" | "OUTLINE_PROPOSAL" | "SUB_PROPOSAL" | "EXTENSION_PROPOSAL";
  };
};
export const create = (value: CreateEthics) =>
  post<{ id: string; respondentId: string | null }>(
    "/ethics/actions/create",
    value,
  );
export const update = (value: CreateEthics & { id: string; access: string }) =>
  post<{ id: string }>("/ethics/actions/update", value);
export const createPeople = endpoint<
  { org: string; id?: string; access?: string },
  { value: string; label: string; detail: string }[]
>(({ org, id, access }) => ({
  path: "/ethics/actions/people",
  query: { org, id, access },
}));
export const createSupervisors = endpoint<
  { id?: string; access?: string },
  SelectOption[]
>(({ id, access }) => ({
  path: "/ethics/actions/supervisors",
  query: { id, access },
}));
export const cloneOptions = endpoint<
  { id: string; access: string },
  { value: string; label: string; selected: boolean }[]
>(({ id, access }) => ({
  path: "/ethics/actions/clone-options",
  query: { id, access },
}));
export const clone = (id: string, access: string, objects: string[]) =>
  post<{ cloned: true }>("/ethics/actions/clone", { id, access, objects });
export const remove = (id: string, access: string) =>
  del<{ deleted: true }>("/ethics/actions/delete", undefined, { id, access });
export const referenceTypes = endpoint<
  { id: string; access: string },
  SelectOption[]
>(({ id, access }) => ({
  path: "/ethics/actions/reference-types",
  query: { id, access },
}));
export const referenceItems = endpoint<
  { id: string; access: string; type: string },
  { value: string; label: string; detail: string }[]
>(({ id, access, type }) => ({
  path: "/ethics/actions/reference-items",
  query: { id, access, type },
}));
export const linkReferences = (
  id: string,
  access: string,
  type: string,
  objects: string[],
) =>
  post<{ linked: true }>("/ethics/actions/link", { id, access, type, objects });
export const unlinkReference = (
  id: string,
  access: string,
  relationId: string,
  page: string,
) =>
  del<{ unlinked: true }>("/ethics/actions/unlink", undefined, {
    id,
    access,
    relationId,
    page,
  });

/** WRITES: finalizes or unlocks the participant's page. */
export const finalize = (
  id: string,
  body: {
    access: string;
    participant: string;
    page: string;
    finalize: boolean;
  },
) => post<{ finalized: boolean }>(`/ethics/${id}/finalize`, body);
/** WRITES: submits the participant's response for approval (legacy auto submit). */
export const autoSubmit = (
  id: string,
  body: { access: string; participant: string },
) => post<{ submitted: true }>(`/ethics/${id}/auto-submit`, body);
/** WRITES (generate-report): a Print report file, as the server names it. */
export const print = (
  id: string,
  body: { access: string; participant: string; code: string },
) => download(`/ethics/${id}/print`, undefined, body);
