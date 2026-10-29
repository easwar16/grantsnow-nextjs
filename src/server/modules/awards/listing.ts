import "server-only";
import { cache } from "react";
import { z } from "zod";
import { authenticate } from "@/server/identity/session/service";
import { awards, lookups, people } from "@/server/oracle/api";
import { containsClause } from "@/server/oracle/where";
import {
  resources,
  type Resources,
} from "@/server/platform/configuration/resources";
import { AppError } from "@/lib/errors";
import {
  parseConditions,
  type AwardCondition,
  type AwardFilters,
} from "@/features/modules/awards/listing/schema";
import {
  advancedAttributes,
  awardActionGates,
  checkConditions,
} from "./actions";
import { dashboardRoles } from "@/server/platform/configuration/service";
import { AWARD_STATUS_TONE } from "@/shared/awards/award-record";
import {
  type AwardListGates,
  type AwardListPage,
  type AwardListRow,
  type AwardListTextKey,
  type AwardListView,
  type AwardChoiceList,
} from "@/features/modules/awards/listing/types";
import { constants } from "@/lib/constants";
import { serverFunctions } from "@/server/functions";

/** Legacy shell-page maps module access AWARDS to bundle AWARD; the page reads `award`. */
const BUNDLE = "award";
const DRAWER = "awards";

/** Every gate the page and the row read (legacy isResourceVisible: only 'Y' shows). */
export function awardListGates(rows: Resources): AwardListGates {
  const v = (key: string, group = "labels") =>
    serverFunctions.resources.resourceVisible(rows, BUNDLE, group, key);
  return {
    number: v("list-award-number"),
    name: v("list-award-name"),
    proposal: v("list-proposal-name"),
    org: v("list-org-unit"),
    assignedTo: v("list-assigned-to"),
    funder: v("list-funder"),
    billingParty: v("list-billing-party"),
    dateSort: v("list-date-sort"),
    start: v("list-start-date"),
    end: v("list-end-date"),
    pi: v("list-principal-investigator"),
    awarded: v("list-award-date"),
    created: v("list-creation-date"),
    updated: v("list-last-update-date"),
    amount: v("list-amount"),
    view: v("list-view-record", "button-labels"),
    cardView: v("listing-card-view", "button-labels"),
  };
}

const TEXTS: Record<AwardListTextKey, [string, string, string]> = {
  number: ["labels", "list-award-number", "Award Number"],
  name: ["labels", "list-award-name", "Award Name"],
  proposal: ["labels", "list-proposal-name", "Proposal Name"],
  org: ["labels", "list-org-unit", "Org Unit"],
  assignedTo: ["labels", "list-assigned-to", "Assigned To"],
  funder: ["labels", "list-funder", "Funder"],
  billingParty: ["labels", "list-billing-party", "Billing Party"],
  dateSort: ["labels", "list-date-sort", "Date Sort"],
  start: ["labels", "list-start-date", "Start Date"],
  end: ["labels", "list-end-date", "End Date"],
  pi: ["labels", "list-principal-investigator", "Principal Investigator"],
  awarded: ["labels", "list-award-date", "Award Date"],
  created: ["labels", "list-creation-date", "Created On"],
  updated: ["labels", "list-last-update-date", "Last Updated Date"],
  amount: ["labels", "list-amount", "Amount"],
  clear: ["button-labels", "clear", "Clear"],
  toggle: ["button-labels", "toggle", "Toggle"],
  view: ["button-labels", "list-view-record", "View"],
  listView: ["button-labels", "list-view", "List View"],
  cardView: ["button-labels", "listing-card-view", "Card View"],
  // Legacy hard-codes the primary empty text; the bundle's secondary line is shown under it.
  empty: [
    "labels",
    "please-create-an-award-proposal",
    "Please create an award proposal",
  ],
  total: ["labels", "total-count", "Total"],
  createAward: ["button-labels", "create-award", "Create Award"],
  advanced: ["button-labels", "advanced-query", "Advanced Query"],
  link: ["button-labels", "list-link", "Link"],
  clone: ["button-labels", "list-clone", "Clone"],
};

export function awardListTexts(rows: Resources) {
  return Object.fromEntries(
    Object.entries(TEXTS).map(([k, [group, key, fallback]]) => [
      k,
      serverFunctions.resources.label(rows, BUNDLE, group, key, fallback),
    ]),
  ) as Record<AwardListTextKey, string>;
}

/** A filter whose gate is hidden cannot be applied, even by a hand-made request (fail closed). */
export function gatedAwardFilters(
  f: AwardFilters,
  g: AwardListGates,
): AwardFilters {
  return {
    ...f,
    number: g.number ? f.number : "",
    name: g.name ? f.name : "",
    proposal: g.proposal ? f.proposal : "",
    org: g.org ? f.org : "",
    assignedTo: g.assignedTo ? f.assignedTo : "",
    funder: g.funder ? f.funder : "",
    billingParty: g.billingParty ? f.billingParty : "",
    sortBy: g.dateSort ? f.sortBy : "",
    start: g.start ? f.start : "",
    end: g.end ? f.end : "",
    pi: g.pi ? f.pi : "",
  };
}

// Values are validated by the filter schema (codes, digits, dates); text is quote-doubled and LIKE-escaped.
const esc = (v: string) => v.replace(/'/g, "''");
const equals = (column: string, value: string) =>
  value ? `"${column}"='${esc(value)}'` : null;
const contains = (column: string, value: string) =>
  value.trim() ? containsClause(`"${column}"`, value.trim()) : null;

/**
 * The AwardHeader `p_where_clause`, in legacy getPost_awardsAwardHeaderFetch order. Start and end dates match the
 * day exactly (legacy `$eq` on a date: `'YYYY-MM-DD 00:00:00'`). Several principal investigators are an OR group:
 * legacy sent the array as one `'12,34'` literal, which matches nobody.
 */
export function awardWhereClause(
  f: AwardFilters,
  advanced?: { columns: ReadonlySet<string>; conditions: AwardCondition[] },
): string | null {
  const pis = f.pi ? f.pi.split(",") : [];
  // Advanced mode reads another view; legacy dropped these three there (pitfall 2), they stay where it has the column.
  const has = (column: string) => !advanced || advanced.columns.has(column);
  const parts = [
    equals("org_id", f.org),
    equals("award_status_code", f.status),
    contains("award_number", f.number),
    contains("award_name", f.name),
    has("proposal_title") ? contains("proposal_title", f.proposal) : null,
    f.start ? `"award_start_date"='${f.start} 00:00:00'` : null,
    f.end ? `"award_end_date"='${f.end} 00:00:00'` : null,
    contains("sponsor_party_name", f.funder),
    has("billing_party_name")
      ? contains("billing_party_name", f.billingParty)
      : null,
    pis.length > 1
      ? `(${pis.map((p) => equals("pi_pid", p)).join(" OR ")})`
      : equals("pi_pid", pis[0] ?? ""),
    has("assigned_to") ? equals("assigned_to", f.assignedTo) : null,
    ...(advanced?.conditions ?? []).map(conditionClause),
  ].filter((p): p is string => p !== null);
  return parts.length ? `(${parts.join(" AND ")})` : null;
}

const SYMBOL = { $eq: "=", $gt: ">", $lt: "<", $ge: ">=", $le: "<=" } as const;
/** One Advanced Query row as legacy transforms.js renders it: a date-shaped value is bounded to its day. */
export function conditionClause(c: AwardCondition) {
  const column = `"${c.attribute}"`;
  if (c.op === "$co") return containsClause(column, c.value);
  const value = /^\d{4}-\d{2}-\d{2}$/.test(c.value)
    ? `${c.value} ${c.op === "$le" ? "23:59:59" : "00:00:00"}`
    : c.value;
  return `${column}${SYMBOL[c.op]}'${esc(value)}'`;
}

/** Page, clause and sort as query params (legacy transforms.js); the sort only once a date type is chosen. */
export function awardOracleQuery(f: AwardFilters) {
  const where = awardWhereClause(f);
  return new URLSearchParams({
    p_offset: String(f.offset),
    p_limit: String(constants.paging.awards),
    ...(where ? { p_where_clause: where } : {}),
    ...(f.sortBy
      ? {
          p_order_by: `"${f.sortBy}"`,
          p_sort_order: f.dir === "ascending" ? "ASC" : "DESC",
        }
      : {}),
  });
}

const text = z.string().nullish();
const numberish = z.union([z.number(), z.string()]).nullish();
const rowSchema = z.object({
  award_id: z.coerce.number().int().positive(),
  proposal_id: numberish,
  award_number: text,
  award_name: text,
  award_status: text,
  award_status_code: text,
  proposal_title: text,
  award_start_date: text,
  award_end_date: text,
  actual_award_date: text,
  creation_date: text,
  last_update_date: text,
  assigned_to_name: text,
  sponsor_party_name: text,
  billing_party_name: text,
  org_unit_name: text,
  award_pi_full_name: text,
  award_amount: numberish,
});
const listSchema = z.object({
  items: z.array(rowSchema),
  total_count: z.coerce.number().int().nonnegative().optional(),
  hasMore: z.union([z.boolean(), z.enum(["true", "false"])]).optional(),
});

const present = (show: boolean, v: string | number | null | undefined) =>
  show && v !== null && v !== undefined && v !== "" ? String(v) : undefined;

/** The allowlisted display model: gated fields only, nothing else from the Oracle row. */
export function mapAwardRow(
  r: z.infer<typeof rowSchema>,
  g: AwardListGates,
): AwardListRow {
  const code = r.award_status_code ?? "";
  return {
    id: String(r.award_id),
    number: r.award_number || undefined,
    status: r.award_status || undefined,
    tone: r.award_status ? AWARD_STATUS_TONE[code] : undefined,
    // Legacy: the award name when its label is visible, otherwise the proposal title, then the award name.
    title:
      (g.name ? r.award_name : (r.proposal_title ?? r.award_name)) || undefined,
    proposal: present(g.proposal, r.proposal_title),
    start: present(g.start, r.award_start_date),
    end: present(g.end, r.award_end_date),
    awarded: present(g.awarded, r.actual_award_date),
    created: present(g.created, r.creation_date),
    updated: present(g.updated, r.last_update_date),
    assignedTo: present(g.assignedTo, r.assigned_to_name),
    funder: present(g.funder, r.sponsor_party_name),
    billingParty: present(g.billingParty, r.billing_party_name),
    org: present(g.org, r.org_unit_name),
    pi: present(g.pi, r.award_pi_full_name),
    // Legacy shows the amount only when truthy, so a zero amount is left out (live: no "£0.00").
    amount:
      Number(r.award_amount) === 0
        ? undefined
        : present(g.amount, r.award_amount),
  };
}

export function mapAwardPage(raw: unknown, g: AwardListGates): AwardListPage {
  const b = listSchema.parse(raw);
  const rows = b.items.map((r) => mapAwardRow(r, g));
  if (new Set(rows.map((r) => r.id)).size !== rows.length)
    throw new AppError("CONTRACT", "Oracle returned duplicate awards.");
  return {
    rows,
    total: b.total_count ?? null,
    // ORDS' flag (a string on DEV) wins; without one, a full page means there may be more.
    hasMore:
      b.hasMore === undefined
        ? b.items.length >= constants.paging.awards
        : b.hasMore === true || b.hasMore === "true",
  };
}

const sortChoices = cache(async () =>
  serverFunctions.choices.objectDateChoices(
    await lookups.objectDates({ objectType: "AWARD" }),
  ),
);

const settled = <T>(r: PromiseSettledResult<T[]>) =>
  r.status === "fulfilled" ? r.value : [];

/** Gates, texts, status tabs and date sorts; a failed list degrades to empty and is reported. */
export async function awardListView(): Promise<AwardListView> {
  const { user } = await authenticate();
  serverFunctions.permissions.requireDrawerAccess(user, DRAWER);
  const [rows, roles] = await Promise.all([resources(), dashboardRoles()]);
  const gates = awardListGates(rows);
  const [statuses, sorts] = await Promise.allSettled([
    lookups
      .codes({ types: "AWARD_STATUS" })
      .then((raw) =>
        serverFunctions.choices.statusChoices(raw, "AWARD_STATUS"),
      ),
    gates.dateSort ? sortChoices() : [],
  ]);
  return {
    gates,
    actions: awardActionGates(rows, roles),
    texts: awardListTexts(rows),
    statuses: settled(statuses),
    // fetchDateTypes leaves the select empty on a failure, without a message.
    sorts: settled(sorts),
    errors:
      statuses.status === "rejected"
        ? ["Award statuses could not be loaded."]
        : [],
  };
}

const CHOICE_FAILURES = {
  orgs: "Org units could not be loaded.",
  people: "People could not be loaded.",
  parties: "Funders could not be loaded.",
} as const;

/** One of the drawer's choice lists, read on its own so a slow one never holds the others. */
export async function awardChoices(list: string): Promise<AwardChoiceList> {
  const { user } = await authenticate();
  serverFunctions.permissions.requireDrawerAccess(user, DRAWER);
  if (!Object.hasOwn(CHOICE_FAILURES, list))
    throw new AppError("BAD_REQUEST", "Unknown choice list.", 400);
  const key = list as keyof typeof CHOICE_FAILURES;
  const gates = awardListGates(await resources());
  const read = {
    orgs: () =>
      gates.org
        ? lookups.orgUnits({ module: "AWARD" }).then((raw) =>
            serverFunctions.organizations.orgUnitRows(raw).map((o) => ({
              value: o.id,
              label: "\u00a0".repeat(o.depth) + o.name,
            })),
          )
        : [],
    people: () =>
      gates.pi || gates.assignedTo
        ? people
            .all()
            .then((all) =>
              all.flatMap((p) =>
                p.full_name
                  ? [{ value: String(p.person_id), label: p.full_name }]
                  : [],
              ),
            )
        : [],
    parties: () =>
      gates.funder || gates.billingParty
        ? lookups
            .sponsors()
            .then((raw) =>
              serverFunctions.choices.nameChoices(raw, "party_name"),
            )
        : [],
  }[key];
  return serverFunctions.choices.choiceList(read, CHOICE_FAILURES[key]);
}
/** One page of awards; the session, the drawer grant and every filter gate are checked here. */
export async function listAwards(
  filters: AwardFilters,
  signal?: AbortSignal,
): Promise<AwardListPage> {
  const { user } = await authenticate();
  serverFunctions.permissions.requireDrawerAccess(user, DRAWER);
  const gates = awardListGates(await resources());
  const f = gatedAwardFilters(filters, gates);
  const conditions = parseConditions(f.conditions);
  if (conditions.length) {
    // Legacy getPost_awardsAdvancedSearchFetch: the drawer filters and the rows, no sort.
    await checkConditions(conditions);
    const columns = new Set((await advancedAttributes()).map((a) => a.value));
    const where = awardWhereClause(f, { columns, conditions });
    const raw = await awards.advancedSearch(
      {
        query: {
          p_offset: String(f.offset),
          p_limit: String(constants.paging.awards),
          ...(where ? { p_where_clause: where } : {}),
        },
      },
      { signal },
    );
    return mapAwardPage(raw, gates);
  }
  if (f.sortBy && !(await sortChoices()).some((c) => c.value === f.sortBy))
    throw new AppError("BAD_REQUEST", "Unknown date sort option.", 400);
  const raw = await awards.list(
    { query: Object.fromEntries(awardOracleQuery(f)) },
    { signal },
  );
  return mapAwardPage(raw, gates);
}
