import { calendarDate, moneyDisplay, type FormatSettings } from "@/lib/format";
import type { AttentionRow } from "../../types";

/** Legacy `calendarProvider` codes (fp-proposals-calendar); one sidebar entry and colour each. */
export type CalendarProvider =
  | "PROPOSAL"
  | "OUTLINE_PROPOSAL"
  | "SUB_PROPOSAL"
  | "CONTRACT"
  | "ETHICS"
  | "AWARD"
  | "AOI";

// ponytail: English literals as in GN-Angular; legacy reads the dashboard bundle's calendar-provider-* labels.
export const PROVIDER_LABELS: Record<CalendarProvider, string> = {
  PROPOSAL: "Proposals",
  OUTLINE_PROPOSAL: "Outline proposals",
  SUB_PROPOSAL: "Sub Proposals",
  CONTRACT: "Contracts",
  ETHICS: "Ethics",
  AWARD: "Awards",
  AOI: "Applications",
};

/** Legacy VIEW_BUTTONS: anything unlisted (the proposal family) opens a proposal. */
export function viewLabel(provider: CalendarProvider) {
  return (
    (
      {
        CONTRACT: "View Contract",
        AWARD: "View Award",
        ETHICS: "View Ethics",
        AOI: "View Application",
      } as Partial<Record<CalendarProvider, string>>
    )[provider] ?? "View Proposal"
  );
}

// Rows carry their module through `href` (server rowHref); legacy findProposalType splits proposals by number prefix.
const MODULE_PROVIDERS: [string, CalendarProvider][] = [
  ["/contracts", "CONTRACT"],
  ["/modules/ethics", "ETHICS"],
  ["/awards", "AWARD"],
  ["/opportunities/eoi", "AOI"],
];
export function providerOf(row: AttentionRow): CalendarProvider {
  const path = row.href.split("?")[0];
  const match = MODULE_PROVIDERS.find(
    ([prefix]) => path === prefix || path.startsWith(`${prefix}/`),
  );
  if (match) return match[1];
  if (row.reference.startsWith("OP_")) return "OUTLINE_PROPOSAL";
  if (row.reference.startsWith("SP_")) return "SUB_PROPOSAL";
  return "PROPOSAL";
}

/** Legacy palette order; colours are CSS tokens declared in calendar.module.css. */
const PALETTE_SIZE = 5;
export interface ProviderEntry {
  provider: CalendarProvider;
  color: string;
}
/** Distinct providers in first-seen order, each with its palette colour (legacy _rebuildProviderList). */
export function providersOf(rows: readonly AttentionRow[]): ProviderEntry[] {
  return [...new Set(rows.map(providerOf))].map((provider, i) => ({
    provider,
    color: `var(--calendar-provider-${(i % PALETTE_SIZE) + 1})`,
  }));
}

const pendingAt = (row: AttentionRow) =>
  row.stage ? `${row.reference} Pending at: ${row.stage}` : row.reference;
const deadlineType = (row: AttentionRow) =>
  row.deadlineType
    ? `${row.reference} Deadline Type : ${row.deadlineType}`
    : row.reference;
/** Per-queue event titles from the legacy calendar fetch chains (as ported in GN-Angular); others show the number. */
const EVENT_TITLES: Record<string, (row: AttentionRow) => string> = {
  pApproachingDeadlines: deadlineType,
  cApproachingDeadlines: deadlineType,
  pPendingApprovals: pendingAt,
  cPendingApprovals: pendingAt,
  ePendingApprovals: pendingAt,
  aPendingApprovals: pendingAt,
  eoiPendingApprovals: pendingAt,
  aApprovedAwards: (row) =>
    row.title !== row.reference
      ? `${row.reference} ${row.title}`
      : row.reference,
};
export function eventTitle(widgetId: string, row: AttentionRow) {
  return (EVENT_TITLES[widgetId] ?? ((r) => r.reference))(row);
}

/** The row's calendar day as YYYY-MM-DD, read from the string so a date-only value never shifts zone. */
export function eventDay(value?: string) {
  const parts = calendarDate(value);
  if (!parts) return undefined;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${parts.year}-${pad(parts.month)}-${pad(parts.day)}`;
}

export interface CalendarEvent {
  id: string;
  title: string;
  start: string;
  allDay: true;
  backgroundColor: string;
  borderColor: string;
  extendedProps: { rowId: string };
}
/**
 * Events for the visible providers, built from the current rows only: a refetch replaces them, so
 * nothing accumulates across loads or organisations (legacy *Data arrays appended). Undated rows are skipped.
 */
export function toCalendarEvents(
  widgetId: string,
  rows: readonly AttentionRow[],
  hidden: ReadonlySet<CalendarProvider>,
): CalendarEvent[] {
  const colors = new Map(providersOf(rows).map((p) => [p.provider, p.color]));
  return rows.flatMap((row) => {
    const provider = providerOf(row),
      start = eventDay(row.date);
    if (!start || hidden.has(provider)) return [];
    const color = colors.get(provider)!;
    return [
      {
        id: row.id,
        title: eventTitle(widgetId, row),
        start,
        allDay: true,
        backgroundColor: color,
        borderColor: color,
        extendedProps: { rowId: row.id },
      },
    ];
  });
}

/** The record fields shown in List View and in the calendar's detail panel. */
export function rowFields(row: AttentionRow, format?: FormatSettings) {
  return [
    { label: "Org Unit", value: row.context },
    { label: "Created by", value: row.createdBy },
    { label: "Funder", value: row.sponsor },
    // Legacy offsets these three columns by 6px in the list (GN-Dashboard layout spec).
    { label: "Deadline Type", value: row.deadlineType, shifted: true },
    {
      label: "Deadline Description",
      value: row.deadlineDescription,
      shifted: true,
    },
    { label: "Pending at:", value: row.stage },
    {
      label: "Total Cost",
      shifted: true,
      value:
        row.value == null
          ? undefined
          : moneyDisplay(row.value, row.currency, format),
    },
  ];
}
