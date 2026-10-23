"use client";
import type {
  AttentionRow,
  HomeFilters,
  WidgetData,
} from "@/features/modules/home/types";
import type { OpportunityPage } from "@/features/modules/opportunities/types";
import type { ChartData } from "@/features/modules/home/components/remote-tabs";
import { get, post } from "../http";
import { endpoint, pagedEndpoint, type PagedEndpoint } from "../hooks";

/** A Home widget and the dashboard filters it is drawn for (the server scopes the organisation again). */
export type WidgetQuery = { id: string; filters: HomeFilters };
const widgetPath = (id: string) => `/home/${encodeURIComponent(id)}`;
/** One widget's data (an Insights chart, or a queue's first page). */
export const widget = endpoint<WidgetQuery, WidgetData>((p) => ({
  path: widgetPath(p.id),
  query: { ...p.filters },
}));
/** A Need Attention queue, 25 rows per scroll page (the route pages Oracle with p_offset / p_limit). */
export const queue = pagedEndpoint<WidgetQuery, AttentionRow, WidgetData>(
  // The hook sets each page's own offset over the filters' first-page one.
  (p) => ({ path: widgetPath(p.id), query: { ...p.filters } }),
  (b) => ({ rows: b.attention, hasMore: b.hasMore === true }),
);
/** Whether the user may open Ethics rows; asked on each click, as legacy does. */
export const ethicsAccess = (signal?: AbortSignal) =>
  get<{ allowed: boolean }>("/home/ethics-access", undefined, signal);

export type NotificationPage = {
  rows: { id: string; html: string; read: boolean; date: string }[];
  offset: number;
  limit: number;
  hasMore: boolean;
  empty: string;
};
export type FeaturedPage = OpportunityPage & { empty: string };
/**
 * The Notifications tab, page by page: each "row" is one page as the route answers it, because the panel also shows
 * the page's empty text.
 */
export const notificationPages = pagedEndpoint<
  void,
  NotificationPage,
  NotificationPage
>(
  () => ({ path: "/home/tabs/notifications" }),
  (b) => ({ rows: [b], hasMore: b.hasMore === true }),
);
const FEATURED_PAGE = 25;
/** Featured opportunities, page by page (the route takes a 1-based `page`); each "row" is one page as answered. */
export const featuredPages: PagedEndpoint<void, FeaturedPage> = {
  key: () => "/api/home/tabs/opportunities",
  loadPage: async (_p, offset) => {
    const r = await get<FeaturedPage>("/home/tabs/opportunities", {
      page: offset / FEATURED_PAGE + 1,
    });
    return r.ok
      ? {
          ok: true,
          data: {
            rows: [r.data],
            // The API total, not hasMore (unreliable on DEV), decides whether another page exists.
            hasMore:
              r.data.rows.length > 0 &&
              offset + r.data.rows.length < r.data.total,
            total: r.data.total,
          },
        }
      : r;
  },
  size: FEATURED_PAGE,
};
/** One dynamic chart for the chosen organisation. */
export const dynamicChart = endpoint<
  { id: string; organization?: string },
  ChartData[]
>((p) => ({
  path: "/home/tabs/charts",
  query: { id: p.id, organization: p.organization },
}));
/** WRITES: a dynamic chart's dimensions (the user's own chart-layout preference). */
export const saveChartDimensions = (
  id: string,
  colspan: number,
  rowspan: number,
) =>
  post<{ columns: number; rows: number }>("/home/tabs/charts", {
    infolet_id: Number(id),
    colspan,
    rowspan,
  });
