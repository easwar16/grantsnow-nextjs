import "server-only";
import { read, write, type PageParams } from "../client";

import type { Operation } from "../connection";
import { serverConstants } from "@/server/constants";

/** One module's announcements (legacy getSharedAnnouncements `module_name`: DASHBOARD, OPPORTUNITIES). */
export const announcements = read<{ module: string }, unknown>({
  op: "getSharedAnnouncements",
  ttl: serverConstants.ttl.access,
  headers: (p) => ({ module_name: p.module }),
});
/** Whether the user may open Ethics rows (legacy `/dynamicForms/checkApplApprAccess`). */
export const ethicsAccess = read<void, unknown>({
  op: "getDynamicFormsCheckApplApprAccess",
});
/** The enabled KPI tiles (`report_name` the tile ids, `p_org_id` the organisation chosen on Home). */
export const kpiStatistics = read<{ reports: string; orgId?: string }, unknown>(
  {
    op: "getSharedGetKpiStatistics",
    ttl: serverConstants.ttl.figures,
    stale: serverConstants.ttl.figuresStale,
    headers: (p) => ({ report_name: p.reports, p_org_id: p.orgId }),
  },
);
/** A dynamic chart's data (legacy getDynamicCharts `report_name` = infolet id). */
export const dynamicChart = read<{ report: string; orgId?: string }, unknown>({
  op: "getSharedGetDynamicCharts",
  ttl: serverConstants.ttl.figures,
  stale: serverConstants.ttl.figuresStale,
  headers: (p) => ({ report_name: p.report, p_org_id: p.orgId }),
});

/** A Home widget page: the organisation under the widget's own header name, and the Insights filters. */
export type WidgetParams = PageParams & {
  orgHeader: "p_org_id" | "org_id";
  orgId?: string;
  chartType?: string;
  year?: string;
  quarter?: string;
  month?: string;
};
const widgetOps = [
  "getProposalProp_appr_deadline",
  "getProposalPendingApproval",
  "getContractsContract_appr_deadline",
  "getContractsContractPendingApproval",
  "getDynamicFormsApplApprDeadline2",
  "getDynamicFormsApplPendingApproval",
  "getPost_awardsAwardPendingApproval",
  "getPost_awardsApprovedAwards",
  "getEoiPendingApproval",
  "getProposalGetProposalStatistics",
  "getSharedGetTopOppCategoryStat",
  "getPost_awardsAwardVsCostStatistics",
  "getSharedGetOppFunnelStat",
  "getSharedGetOppCategoryStat",
  "getDynamicFormsApplicationStatistics",
  "getPost_awardsAwardStatistics",
] as const satisfies readonly Operation[];
export type WidgetOperation = (typeof widgetOps)[number];
/** Every held Home figure: the writes that change what they count (approvals, statuses) drop them. */
export const figureOperations = [
  ...widgetOps,
  "getSharedGetKpiStatistics",
  "getSharedGetDynamicCharts",
  "getSharedGetWidgetParameters",
] as const satisfies readonly Operation[];
/** Each queue and chart operation as one listing page (`p_offset` / `p_limit`, legacy's SDP paginate transform). */
export const widget = Object.fromEntries(
  widgetOps.map((op) => [
    op,
    read<WidgetParams, unknown>({
      op,
      headers: (p) => ({
        [p.orgHeader]: p.orgId,
        chart_type: p.chartType,
        year: p.year,
        quarter: p.quarter,
        month: p.month,
      }),
      pages: "page",
      ttl: serverConstants.ttl.figures,
      stale: serverConstants.ttl.figuresStale,
    }),
  ]),
) as Record<WidgetOperation, ReturnType<typeof read<WidgetParams, unknown>>>;
export const isWidgetOperation = (op: Operation): op is WidgetOperation =>
  (widgetOps as readonly Operation[]).includes(op);
/** The gauge's parameters (getWidgetParameters): the token goes as `p_token`; the widget names its other headers. */
export const gauge = read<{ headers: Record<string, string | undefined> }>({
  op: "getSharedGetWidgetParameters",
  ttl: serverConstants.ttl.figures,
  stale: serverConstants.ttl.figuresStale,
  tokenHeader: "p_token",
  headers: (p) => p.headers,
});
/** WRITES: one chart's dimensions, the user's personal layout preference. */
export const saveChartDimensions = write<{ body: unknown }>({
  op: "postSharedSaveDynamicCharts",
  body: (p) => p.body,
});
