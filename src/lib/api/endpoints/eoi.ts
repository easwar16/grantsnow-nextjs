"use client";
import {
  EOI_PAGE_SIZE,
  serializeEoiFilters,
  type EoiFilters,
} from "@/features/modules/opportunities/eoi-list/schema";
import type {
  EoiListPage,
  EoiListRow,
} from "@/features/modules/opportunities/eoi-list/types";
import { post } from "../http";
import { pagedEndpoint } from "../hooks";

/** The EOI list, a page at a time: only the filters that differ from the defaults travel (the hook adds the page). */
export const list = pagedEndpoint<EoiFilters, EoiListRow, EoiListPage>(
  (f) => ({
    path: "/opportunities/eoi",
    query: Object.fromEntries(
      new URLSearchParams(serializeEoiFilters({ ...f, offset: 0 })),
    ),
  }),
  (b) => ({ rows: b.rows, hasMore: b.hasMore, total: b.total ?? undefined }),
  { size: EOI_PAGE_SIZE },
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
