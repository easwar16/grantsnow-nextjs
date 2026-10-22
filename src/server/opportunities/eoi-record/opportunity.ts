import "server-only";
import { z } from "zod";
import { oracle } from "@/server/api/transport";
import { dashboardRoles } from "@/server/configuration/service";
import {
  label,
  resourceVisible,
  type Resources,
} from "@/server/configuration/resources";
import { sanitizeHtml } from "@/server/html/sanitize";
import { canCreate, splitFunders } from "@/features/opportunities/display";
import { dateDisplay, type FormatSettings } from "@/lib/format";
import { AppError } from "@/lib/errors";
import { pageAccess, type RoleRow } from "../gates";
import type {
  SummaryField,
  SummaryView,
} from "@/features/opportunities/eoi/types";
const BUNDLE = "opportunities-eoi";
const text = z.string().nullish();
const amount = z.union([z.number(), z.string()]).nullish();
const row = z.object({
  opportunities_id: z.number().int().positive(),
  opp_heading: z.string(),
  opp_heading_link: text,
  opportunity_status: text,
  logo: text,
  site: text,
  site_url: text,
  sectors: text,
  summary: text,
  eligible: text,
  funders: text,
  co_funders: text,
  call: text,
  programme: text,
  type_of_mga: text,
  currency_code: text,
  total_fund: amount,
  low_award_range: amount,
  high_award_range: amount,
  funding_type: text,
  opening_date: text,
  closing_date: text,
  deadline_date: text,
  last_updated_date: text,
  publication_date: text,
  aoi_app_count: z.number().nullish(),
  proposal_count: z.number().nullish(),
  outline_proposal_count: z.number().nullish(),
  create_application_of_interest: text,
  create_outline_application: text,
  create_grant_application: text,
});
export type OpportunityRecord = z.infer<typeof row>;
/** The opportunity as Oracle has it now (getOpportunities filtered on its id); null when it is not there. */
export async function readOpportunityRecord(token: string, id: number) {
  const b = z.object({ items: z.array(row) }).parse(
    await oracle(
      "getSharedGetOpportunities",
      { token, p_order_by: "publication_date", p_sort_order: "DESC" },
      new URLSearchParams({
        p_where_clause: `("opportunities_id"='${id}')`,
        p_offset: "0",
        p_limit: "1",
      }),
    ),
  );
  return b.items.find((r) => r.opportunities_id === id) ?? null;
}
const present = (v: string | null | undefined): v is string =>
  v !== null && v !== undefined && v.trim() !== "";
function safeUrl(value: string | null | undefined) {
  if (!present(value)) return undefined;
  try {
    const url = new URL(value);
    return ["https:", "http:"].includes(url.protocol) &&
      !url.username &&
      !url.password
      ? url.href
      : undefined;
  } catch {
    return undefined;
  }
}
/** VBCS isHTMLString: backend text that carries markup is rendered as (sanitised) HTML, otherwise as text. */
export const isHtml = (v: string) => /<\/?[a-z][\s\S]*>/i.test(v);
const richText = (v: string): Pick<SummaryField, "html" | "text"> =>
  isHtml(v) ? { html: sanitizeHtml(v) } : { text: v };
/** The opportunity's create flags (`'Y'` only, as the server's apply / convert gates: fail closed). */
export const allows = (o: OpportunityRecord) => ({
  apply: o.create_application_of_interest === "Y",
  convert: o.create_outline_application === "Y",
  convertToProposal: o.create_grant_application === "Y",
});
/**
 * The Summary tab (GN-Angular eoi-summary): the source column, the details and the counts, each behind its gate;
 * hidden fields never leave the server. `detail` is More Info: the actions bar with Apply / Convert / Convert to
 * Proposal. `roles` null (the dashboard grants could not be read) hides the counts and the actions.
 */
export function summaryView(
  o: OpportunityRecord,
  rows: Resources,
  roles: RoleRow[] | null,
  format: FormatSettings | undefined,
  detail: boolean,
): SummaryView {
  const t = (group: string, key: string, fallback: string) =>
    label(rows, BUNDLE, group, key, fallback);
  const shown = (key: string) => resourceVisible(rows, BUNDLE, "labels", key);
  const date = (v: string | null | undefined) =>
    present(v) ? dateDisplay(v, format) : undefined;
  const field = (
    key: string,
    fallback: string,
    value: Partial<SummaryField> | undefined,
  ): SummaryField[] =>
    // RB-driven: shown only on an explicit 'Y' row (owner rule), never by default.
    value && shown(key)
      ? [{ key, label: t("labels", key, fallback), ...value }]
      : [];
  const val = (v: string | number | null | undefined) =>
    v === null || v === undefined || String(v).trim() === ""
      ? undefined
      : { text: String(v) };
  const funders = splitFunders(o.funders),
    coFunders = splitFunders(o.co_funders);
  const site: SummaryField[] =
    present(o.site) && shown("summary-site")
      ? [
          {
            key: "summary-site",
            label: t("labels", "summary-site", "Site"),
            text: o.site,
            href: safeUrl(o.site_url),
          },
        ]
      : [];
  const access = (page: string) => pageAccess(roles, page).read;
  const counted = (page: string) =>
    (roles ?? []).some((r) => r.page_name === page && r.read_access === "Y");
  const open = canCreate(o.opportunity_status ?? "");
  const flags = allows(o);
  const show = detail && open && roles !== null;
  return {
    heading: o.opp_heading,
    link: safeUrl(o.opp_heading_link),
    logo: safeUrl(o.logo),
    side: [
      ...site,
      ...field("summary-status", "Status", val(o.opportunity_status)),
      ...field("summary-funder", "Funder", val(funders.join(", "))),
      ...field("summary-cofunders", "Co Funders", val(coFunders.join(", "))),
      ...field("summary-sectors", "Sectors", val(o.sectors)),
    ],
    details: [
      ...field(
        "summary",
        "Summary",
        present(o.summary) ? { ...richText(o.summary), wide: true } : undefined,
      ),
      ...field(
        "summary-eligiblity",
        "Eligibility",
        present(o.eligible)
          ? { ...richText(o.eligible), wide: true }
          : undefined,
      ),
      ...field("summary-call-code", "Call Code", val(o.call)),
      ...field("summary-programme", "Programme", val(o.programme)),
      ...field("summary-mga", "MGA", val(o.type_of_mga)),
      ...field("summary-currency", "Currency", val(o.currency_code)),
      ...field("summary-total-fund", "Total Fund", val(o.total_fund)),
      ...field(
        "summary-low-award-range",
        "Low award range",
        val(o.low_award_range),
      ),
      ...field(
        "summary-high-award-range",
        "High award range",
        val(o.high_award_range),
      ),
      ...field(
        "summary-funding-type",
        "Funding Type",
        o.funding_type === "NA" ? undefined : val(o.funding_type),
      ),
      ...field(
        "summary-opening-date",
        "Opening Date",
        val(date(o.opening_date)),
      ),
      ...field(
        "summary-closing-date",
        "Closing Date",
        val(date(o.closing_date)),
      ),
      // No seed row for summary-deadline-date: it shows only once the backend has a visible row.
      ...field(
        "summary-deadline-date",
        "Deadline Date",
        val(date(o.deadline_date)),
      ),
      ...field(
        "summary-last-updated-date",
        "Last Updated Date",
        val(date(o.last_updated_date)),
      ),
      ...field(
        "summary-publication-date",
        "Publication Date",
        val(date(o.publication_date)),
      ),
    ],
    counts: [
      [
        "opportunities-eoi-count",
        "aoi-count",
        "Number of Applications",
        o.aoi_app_count,
      ],
      [
        "opportunities-proposal-count",
        "proposals-count",
        "Number of Proposals",
        o.proposal_count,
      ],
      [
        "opportunities-outline-proposal-count",
        "outline-proposals-count",
        "Number of Outline Proposals",
        o.outline_proposal_count,
      ],
    ].flatMap(([page, key, fallback, n]) =>
      counted(page as string) && shown(key as string)
        ? [
            {
              label: t("labels", key as string, fallback as string),
              value: n === null || n === undefined ? "—" : String(n),
            },
          ]
        : [],
    ),
    closedMessage: open
      ? null
      : t(
          "labels",
          "opportunity-closed-message",
          "This opportunity is closed and cannot accept new applications.",
        ),
    actions: {
      apply:
        show && flags.apply && access("apply-opportunities") && shown("apply")
          ? t("labels", "apply", "Apply")
          : null,
      convert:
        show &&
        flags.convert &&
        access("convert-opportunity") &&
        shown("convert")
          ? t("labels", "convert", "Convert")
          : null,
      convertToProposal:
        show &&
        flags.convertToProposal &&
        access("convert-opportunity-to-proposal") &&
        shown("convert-to-proposal")
          ? t("labels", "convert-to-proposal", "Convert to Proposal")
          : null,
    },
  };
}
export const summaryEmpty = (rows: Resources) =>
  label(rows, BUNDLE, "helper-texts", "eoi-no-data", "No data to display.");
/** The dashboard grants for the summary's counts and actions; a failed read hides both rather than failing the page. */
export async function summaryRoles() {
  try {
    return await dashboardRoles();
  } catch (e) {
    if (e instanceof AppError && e.status === 401) throw e;
    return null;
  }
}
