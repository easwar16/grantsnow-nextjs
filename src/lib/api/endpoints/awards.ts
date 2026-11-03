"use client";
import {
  serializeAwardFilters,
  type AwardFilters,
} from "@/features/modules/awards/listing/schema";
import type {
  AwardChoiceList,
  AwardListPage,
  AwardListRow,
} from "@/features/modules/awards/listing/types";
import type {
  AdvancedSetup,
  CloneSetup,
  CreateAwardSetup,
} from "@/features/modules/awards/listing/actions";
import type { LinkedObjects } from "@/features/record/linked/model";
import type { CostDialogData } from "@/features/modules/awards/record/projects-types";
import type { CreatorCard } from "@/features/record/shell/creator-types";
import { get, post } from "../http";
import { endpoint, pagedEndpoint } from "../hooks";
import { constants } from "@/lib/constants";

/** The Awards listing, a page at a time: only the filters that differ from the defaults travel (the hook adds the page). */
export const list = pagedEndpoint<AwardFilters, AwardListRow, AwardListPage>(
  (f) => ({
    path: "/awards",
    query: Object.fromEntries(
      new URLSearchParams(serializeAwardFilters({ ...f, offset: 0 })),
    ),
  }),
  (b) => ({ rows: b.rows, hasMore: b.hasMore, total: b.total ?? undefined }),
  { size: constants.paging.awards },
);
/** One of the drawer's held reference lists (org units, people, funders), read once the page shows. */
export const choices = endpoint<"orgs" | "people" | "parties", AwardChoiceList>(
  (list) => ({ path: "/awards/choices", query: { list } }),
  { ttl: constants.ttl.session },
);
const action = (name: string) => `/awards/actions/${name}`;
/** Award links: the linked records, and the proposals an award with none can be linked to. */
export type AwardLinks = LinkedObjects & {
  link: {
    label: string;
    button: string;
    proposals: { value: string; label: string; detail: string }[];
  } | null;
};
/** Dialog setups, read fresh on each open as legacy reads them. */
export const createSetup = () => get<CreateAwardSetup>(action("create"));
export const cloneSetup = (awardId: string) =>
  get<CloneSetup>(action("clone"), { awardId });
export const links = (awardId: string) =>
  get<AwardLinks>(action("links"), { awardId });
/** The Advanced Query's columns and operators (held for the session on the server). */
export const advancedSetup = endpoint<void, AdvancedSetup>(() => ({
  path: action("advanced"),
}));
/** WRITES: a new award from the create dialog. */
export const create = (body: Record<string, unknown>) =>
  post<{ created: true }>(action("create"), body);
/** WRITES: clones an award with the chosen parts. */
export const clone = (awardId: number, parts: string[]) =>
  post<{ cloned: true }>(action("clone"), { awardId, parts });
/** WRITES: links an award with no proposal to one. */
export const link = (awardId: number, proposalId: number) =>
  post<{ linked: true }>(action("link"), { awardId, proposalId });
/** WRITES: finalizes or unlocks one tab's page of an award. */
export const setFinalized = (awardId: string, tab: string, finalize: boolean) =>
  post(`/awards/${awardId}/lock`, { tab, finalize });
/** WRITES: one credit allocation row's credit and effort (fractions). */
export const saveCredit = (
  awardId: string,
  body: { id: string; credit: number; effort: number },
) => post(`/awards/${awardId}/credit`, body);
/** WRITES: hands the award to ERP (Send to ERP); the reply's status is the toast. */
export const sendToErp = (awardId: string) =>
  post<{ status: string }>(`/awards/${awardId}/erp`, {});
/** WRITES: the award header (the Header tab's Save). */
export const saveHeader = (awardId: string, body: Record<string, unknown>) =>
  post(`/awards/${awardId}/header`, body);
/** WRITES: one award period's dates and amount. */
export const savePeriod = (awardId: string, body: Record<string, unknown>) =>
  post(`/awards/${awardId}/periods`, body);
/** WRITES: one budget period (BUDGET_PERIOD "" adds one). */
export const saveBudgetPeriod = (
  awardId: string,
  body: Record<string, unknown>,
) => post(`/awards/${awardId}/budget-periods`, body);
/** The cost dialog's lists for a cost category (`type`) and the line edited (`line`). */
/** The panel's Created by card, read on open. */
export const creator = endpoint<{ awardId: string }, CreatorCard>(
  ({ awardId }) => ({ path: `/awards/${awardId}/creator` }),
);
export const costDialog = endpoint<
  { awardId: string; type: string; line: string },
  CostDialogData
>(({ awardId, type, line }) => ({
  path: `/awards/${awardId}/projects/cost`,
  query: { type, line },
}));
/** WRITES: the Projects tab (project, team, global, cost, period, delete, clone). */
export const saveProjects = (
  awardId: string,
  action:
    "project" | "team" | "global" | "cost" | "period" | "delete" | "clone",
  body: Record<string, unknown>,
) => post(`/awards/${awardId}/projects/${action}`, body);
