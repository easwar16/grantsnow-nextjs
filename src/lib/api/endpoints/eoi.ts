"use client";
import {
  serializeEoiFilters,
  type EoiFilters,
} from "@/features/modules/opportunities/eoi-list/schema";
import type {
  EoiFunders,
  EoiListPage,
  EoiListRow,
} from "@/features/modules/opportunities/eoi-list/types";
import type { CreatorCard } from "@/features/record/shell/creator-types";
import { post } from "../http";
import { endpoint, pagedEndpoint } from "../hooks";
import { constants } from "@/lib/constants";

/** The EOI list, a page at a time: only the filters that differ from the defaults travel (the hook adds the page). */
export const list = pagedEndpoint<EoiFilters, EoiListRow, EoiListPage>(
  (f) => ({
    path: "/opportunities/eoi",
    query: Object.fromEntries(
      new URLSearchParams(serializeEoiFilters({ ...f, offset: 0 })),
    ),
  }),
  (b) => ({ rows: b.rows, hasMore: b.hasMore, total: b.total ?? undefined }),
  { size: constants.paging.eoi },
);
/** The drawer's funder options (a held reference list), read once the page shows. */
export const funders = endpoint<void, EoiFunders>(
  () => ({ path: "/opportunities/eoi/funders" }),
  { ttl: constants.ttl.session },
);
/** WRITES: creates the application once its form has validated; the browser sends only the opportunity id. */
export const create = (opportunityId: number) =>
  post<{ requestId: string; number: string | null }>(
    "/opportunities/eoi/create",
    { opportunityId },
  );
/** WRITES: finalizes or unlocks one tab's page of a saved application. */
export const setFinalized = (
  requestId: string,
  tab: string,
  finalize: boolean,
) => post(`/opportunities/eoi/${requestId}/lock`, { tab, finalize });
/** The panel's Created by card, read on open. */
export const creator = endpoint<{ id: string }, CreatorCard>(({ id }) => ({
  path: `/opportunities/eoi/${id}/creator`,
}));
