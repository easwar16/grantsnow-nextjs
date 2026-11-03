"use client";
import type { InfiniteData } from "@tanstack/react-query";
import { appStore } from "@/lib/store/app-store";
import type { OpportunityQuery } from "@/features/modules/opportunities/schemas";
import type {
  OpportunityCardModel,
  OpportunityRow,
} from "@/features/modules/opportunities/types";
import type { ShareSetup } from "@/features/modules/opportunities/components/actions/share-dialog";
import type { ConvertSetup } from "@/features/modules/opportunities/components/actions/convert-dialog";
import { apiUrl, get, post, type ApiResult } from "../http";
import { endpoint, type Endpoint, type PagedEndpoint } from "../hooks";

import { constants } from "@/lib/constants";

/** One finder page as the route answers it: the rows, the true total and the card the gates allow. */
export type FinderPage = {
  rows: OpportunityRow[];
  total: number;
  card: OpportunityCardModel;
  countsUnavailable?: true;
};
type FinderListPage = FinderPage & { hasMore: boolean };
/**
 * The finder list of one tab and filter state, held per tab and filters, so a tab already seen shows at once (and
 * refreshes in the background). The request travels as one JSON `q`; a short page is the last.
 */
export const finder: PagedEndpoint<
  Omit<OpportunityQuery, "offset">,
  OpportunityRow,
  FinderListPage
> = {
  key: (p) => apiUrl("/opportunities", { q: JSON.stringify(p) }),
  loadPage: async (p, offset) => {
    const r = await get<FinderPage>("/opportunities", {
      q: JSON.stringify({ ...p, offset }),
    });
    return r.ok
      ? {
          ok: true,
          data: {
            ...r.data,
            hasMore: r.data.rows.length >= constants.paging.opportunities,
          },
        }
      : r;
  },
  size: constants.paging.opportunities,
};

/** After a bookmark or notes save: every held finder list shows the change, so a tab revisited is not stale. */
export function patchHeldRow(
  id: string,
  change: Partial<Pick<OpportunityRow, "bookmarked" | "notes">>,
) {
  appStore()?.update<InfiniteData<FinderListPage>>(
    `${apiUrl("/opportunities")}?`,
    (data) => ({
      ...data,
      pages: data.pages.map((page) => ({
        ...page,
        rows: page.rows.map((r) => (r.id === id ? { ...r, ...change } : r)),
      })),
    }),
  );
}

type Option = { value: string; label: string; detail?: string };
const action = (name: string) => `/opportunities/actions/${name}`;
// Dialog setups stay fresh briefly, so a hover's read serves the open without serving a stale setup much later.
// Reference lists several dialogs share (people, roles, groups, org units).
/** The share dialog's texts and comment limit. */
export const shareSetup = endpoint<void, ShareSetup>(
  () => ({ path: action("share") }),
  { ttl: constants.ttl.setup },
);
/** Share recipients of one kind: roles, groups or every person. */
export const shareValues = endpoint<{ type: string }, Option[]>(
  (p) => ({ path: action("share-values"), query: { type: p.type } }),
  { ttl: constants.ttl.list },
);
export type ConvertSetupQuery = {
  opener: string;
  kind: string;
  opportunityId: string;
  requestId?: string;
};
/** The convert dialog's setup for one opportunity (and, from the EOI record, its application). */
export const convertSetup = endpoint<ConvertSetupQuery, ConvertSetup>(
  (p) => ({ path: action("convert"), query: p }),
  { ttl: constants.ttl.setup },
);
/** A principal investigator's org units. */
export const orgUnits = endpoint<{ personId: string }, Option[]>(
  (p) => ({ path: action("org-units"), query: { personId: p.personId } }),
  { ttl: constants.ttl.list },
);
/** Starts an endpoint's read in the app store on intent (hover, focus, a click before a confirm); reads only. */
export function warm<P, T>(ep: Endpoint<P, T>, params: P) {
  appStore()?.prefetch(ep.key(params), () => ep.load(params), ep.ttl);
}
/** An endpoint's answer through the app store: the warmed or held read while fresh, otherwise a new one. */
export function take<P, T>(ep: Endpoint<P, T>, params: P) {
  const store = appStore();
  return (
    store
      ? store.load(ep.key(params), () => ep.load(params), { ttl: ep.ttl })
      : ep.load(params)
  ) as Promise<ApiResult<T>>;
}

/** WRITES: bookmarks or un-bookmarks an opportunity. */
export const bookmark = (opportunityId: number, bookmarked: boolean) =>
  post(action("bookmark"), { opportunityId, bookmarked });
/** WRITES: the user's notes; the reply carries them sanitised. */
export const saveNotes = (opportunityId: number, notes: string) =>
  post<{ notes: string }>(action("notes"), { opportunityId, notes });
/** WRITES: shares an opportunity with a role, a group or chosen people. */
export const share = (body: {
  opportunityId: number;
  sendTo: string;
  personIds?: number[];
  sendToValue?: string;
  comment: string;
}) => post(action("share"), body);
/** Apply: the server checks the gates and answers the new application's page. */
export const apply = (body: { opportunityId: number; tab?: string }) =>
  post<{ href: string }>(action("apply"), body);
/** WRITES: converts an opportunity (or an approved application) into a proposal. */
export const convert = (body: Record<string, unknown>) =>
  post<{ href: string; message: string; seedError?: string }>(
    action("convert"),
    body,
  );
