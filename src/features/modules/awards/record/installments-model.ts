/**
 * Legacy awards-installments-start-page.js, ported as is: installments live in the browser tab only (per-tab
 * sessionStorage, the legacy key), each one prorated over the award's cost lines by their funder share.
 */
export type InstallmentMode = "AMOUNT" | "PERCENT";
export interface Installment {
  title: string | null;
  mode: InstallmentMode;
  amount: number | null;
  pct: number | null;
  /** ISO yyyy-mm-dd. */
  due_date: string | null;
  status: string;
}
/** The cost-line fields the page reads (award_summary['Award Project Cost Line']). */
export interface InstallmentLine {
  project_id: number;
  funding_section_lkp_code: string;
  funding_section: string;
  cost_category_type_lkp_code: string;
  cost_category: string;
  costing_group_id: number | null;
  staff_name: string;
  sponsor_contribution: number;
}
export interface InstallmentProject {
  project_id: number;
  project_number: string;
  project_name: string;
}

// Legacy STATUSES (hard-coded there until the backend has an installment-status lookup).
export const STATUSES = [
  { value: "INITIATED", label: "Initiated", editable: true, tone: "info" },
  {
    value: "IN_PROGRESS",
    label: "In Progress",
    editable: true,
    tone: "warning",
  },
  { value: "ON_HOLD", label: "On Hold", editable: true, tone: "neutral" },
  { value: "BLOCKED", label: "Blocked", editable: true, tone: "danger" },
  { value: "OVERDUE", label: "Overdue", editable: true, tone: "overdue" },
  { value: "FULFILLED", label: "Fulfilled", editable: false, tone: "success" },
] as const;
export type Status = (typeof STATUSES)[number];

export const storageKey = (awardId: string) => `awards-installments:${awardId}`;
/** The tab's stored installments as text ("[]" when there are none or storage is blocked). */
export function storedInstallments(awardId: string) {
  try {
    return sessionStorage.getItem(storageKey(awardId)) ?? "[]";
  } catch {
    return "[]";
  }
}
/** The stored text as installments; anything unreadable is none. */
export function parseInstallments(raw: string): Installment[] {
  try {
    const saved: unknown = JSON.parse(raw);
    return Array.isArray(saved) ? (saved as Installment[]) : [];
  } catch {
    return [];
  }
}
/** Best effort: if storage is full or blocked, the installments still live on the page. */
export function saveInstallments(awardId: string, list: Installment[]) {
  try {
    sessionStorage.setItem(storageKey(awardId), JSON.stringify(list));
  } catch {
    // The page state is unaffected.
  }
}

const roundTo = (n: number, decimals?: number | null) => {
  const scale = 10 ** (decimals ?? 2);
  return Math.round(n * scale) / scale;
};
const sum = <T>(items: T[], value: (item: T) => number) =>
  items.reduce((acc, item) => acc + (value(item) || 0), 0);
// A Map keeps first-seen order, as legacy's groupBy (an object would sort numeric keys).
const groupBy = <T>(items: T[], keyOf: (item: T) => string | number) =>
  items.reduce((acc, item) => {
    const key = keyOf(item);
    return acc.set(key, [...(acc.get(key) ?? []), item]);
  }, new Map<string | number, T[]>());

export const statusOf = (value?: string | null): Status =>
  STATUSES.find((s) => s.value === value) ?? STATUSES[0];
/** Overdue once the due date has passed, unless Fulfilled; the stored status is kept. `today` is local yyyy-mm-dd. */
export function effectiveStatus(
  installment: Installment,
  today = new Date().toLocaleDateString("en-CA"),
): Status {
  const status = statusOf(installment.status);
  const pastDue =
    !!installment.due_date && installment.due_date.slice(0, 10) < today;
  return pastDue && status.value !== "FULFILLED" ? statusOf("OVERDUE") : status;
}
export const funderTotal = (lines: InstallmentLine[]) =>
  sum(lines, (l) => l.sponsor_contribution);
/** What an installment works out to; a percentage is of the whole funder total, not of the balance. */
export const installmentTotal = (
  i: Pick<Installment, "mode" | "amount" | "pct">,
  total: number,
  decimals?: number | null,
) =>
  roundTo(
    i.mode === "PERCENT" ? total * (i.pct ?? 0) : (i.amount ?? 0),
    decimals,
  );
/** The funder total not yet given to an installment; `exceptIndex` leaves that one out, so editing reuses its share. */
export function balance(
  lines: InstallmentLine[],
  list: Installment[],
  decimals?: number | null,
  exceptIndex = -1,
) {
  const total = funderTotal(lines);
  const allocated = list.reduce(
    (acc, i, index) =>
      index === exceptIndex ? acc : acc + installmentTotal(i, total, decimals),
    0,
  );
  return roundTo(total - allocated, decimals);
}
/** The smallest amount accepted, so a zero installment cannot be saved. */
export const minAmount = (decimals?: number | null) => 10 ** -(decimals ?? 2);
/** The value input's ceiling: the balance this installment may use (a fraction in PERCENT mode). */
export function maxValue(
  lines: InstallmentLine[],
  list: Installment[],
  decimals: number | null | undefined,
  exceptIndex: number,
  mode: InstallmentMode,
) {
  const left = balance(lines, list, decimals, exceptIndex);
  const min = minAmount(decimals);
  if (mode !== "PERCENT") return Math.max(min, left);
  const total = funderTotal(lines);
  return Math.max(min / 100, total ? left / total : 0);
}
/** One segment per installment sized by its share of the funder total; the legend counts per status. */
export function progress(
  lines: InstallmentLine[],
  list: Installment[],
  decimals?: number | null,
) {
  const total = funderTotal(lines);
  const segments = !total
    ? []
    : list.map((i, index) => ({
        index,
        title: i.title,
        status: effectiveStatus(i),
        width: `${Math.min(100, Math.max(0, (installmentTotal(i, total, decimals) / total) * 100))}%`,
      }));
  const legend = STATUSES.map((s) => ({
    ...s,
    count: list.filter((i) => effectiveStatus(i).value === s.value).length,
  }));
  return { segments, legend };
}

interface Leaf extends InstallmentLine {
  unique_id: string;
  share_pct: number;
  allocated: number;
}
/**
 * Prorates `amount` across the lines by funder share, one row per costing group, staff first; the largest line
 * absorbs the rounding drift so the rows always add up to `amount`.
 */
function prorateLeaves(
  lines: InstallmentLine[],
  total: number,
  amount: number,
  decimals?: number | null,
): Leaf[] {
  const ratio = total ? amount / total : 0;
  const staffFirst = [...lines].sort(
    (a, b) =>
      Number(b.cost_category_type_lkp_code === "STAFF") -
      Number(a.cost_category_type_lkp_code === "STAFF"),
  );
  const leaves = [
    ...groupBy(staffFirst, (l) =>
      [
        l.project_id,
        l.funding_section_lkp_code,
        l.cost_category_type_lkp_code,
        l.costing_group_id,
      ].join("-"),
    ),
  ].map(([unique_id, group]) => {
    const sponsor = sum(group, (l) => l.sponsor_contribution);
    return {
      ...group[0],
      unique_id: String(unique_id),
      sponsor_contribution: sponsor,
      share_pct: total ? sponsor / total : 0,
      allocated: roundTo(sponsor * ratio, decimals),
    };
  });
  const largest = leaves.reduce<Leaf | null>(
    (max, l) =>
      !max || l.sponsor_contribution > max.sponsor_contribution ? l : max,
    null,
  );
  if (largest)
    largest.allocated = roundTo(
      largest.allocated +
        roundTo(amount, decimals) -
        sum(leaves, (l) => l.allocated),
      decimals,
    );
  return leaves;
}

export interface Amounts {
  sponsor_contribution: number;
  share_pct: number;
  installment_amount: number;
  remaining_balance: number;
}
export interface InstallmentRow extends Amounts {
  key: string;
  name: string;
  children: InstallmentRow[];
}
export interface InstallmentProjectTable extends Amounts {
  project_id: number;
  title: string;
  sections: InstallmentRow[];
}
export interface InstallmentSection {
  index: number;
  installment: Installment;
  total: number;
  status: Status;
  projects: InstallmentProjectTable[];
}
const rollUp = (
  children: (Amounts & { children?: unknown })[],
  decimals?: number | null,
): Amounts => ({
  sponsor_contribution: sum(children, (c) => c.sponsor_contribution),
  share_pct: sum(children, (c) => c.share_pct),
  installment_amount: roundTo(
    sum(children, (c) => c.installment_amount),
    decimals,
  ),
  remaining_balance: roundTo(
    sum(children, (c) => c.remaining_balance),
    decimals,
  ),
});
/**
 * Every installment with its project tables (project > funding section > cost category > item). Prorating the
 * running total and taking the difference keeps each line exact; Remaining Balance is what is left on the line after
 * this installment and every earlier one.
 */
export function buildInstallments(
  lines: InstallmentLine[],
  projects: InstallmentProject[],
  list: Installment[],
  decimals?: number | null,
): InstallmentSection[] {
  const total = funderTotal(lines);
  let before = 0;
  return list.map((installment, index) => {
    const amount = installmentTotal(installment, total, decimals);
    const prior = prorateLeaves(lines, total, before, decimals);
    before = roundTo(before + amount, decimals);
    const leaves = prorateLeaves(lines, total, before, decimals).map(
      (leaf, i) => ({
        ...leaf,
        installment_amount: roundTo(
          leaf.allocated - prior[i].allocated,
          decimals,
        ),
        remaining_balance: roundTo(
          leaf.sponsor_contribution - leaf.allocated,
          decimals,
        ),
      }),
    );
    return {
      index,
      installment,
      total: amount,
      status: effectiveStatus(installment),
      projects: [...groupBy(leaves, (l) => l.project_id)].map(
        ([projectId, projectLeaves]) => {
          const sections = [
            ...groupBy(projectLeaves, (l) => l.funding_section_lkp_code),
          ].map(([section, sectionLeaves]) => {
            const categories = [
              ...groupBy(sectionLeaves, (l) => l.cost_category_type_lkp_code),
            ].map(([type, typeLeaves]) => {
              const items = typeLeaves.map((l) => ({
                key: l.unique_id,
                name: l.staff_name,
                children: [],
                sponsor_contribution: l.sponsor_contribution,
                share_pct: l.share_pct,
                installment_amount: l.installment_amount,
                remaining_balance: l.remaining_balance,
              }));
              return {
                key: `${projectId}-${section}-${type}`,
                name: typeLeaves[0].cost_category,
                children: items,
                ...rollUp(items, decimals),
              };
            });
            return {
              key: `${projectId}-${section}`,
              name: sectionLeaves[0].funding_section,
              children: categories,
              ...rollUp(categories, decimals),
            };
          });
          const project = projects.find((p) => p.project_id === projectId);
          return {
            project_id: Number(projectId),
            title: [project?.project_number, project?.project_name]
              .filter(Boolean)
              .join(" - "),
            sections,
            ...rollUp(sections, decimals),
          };
        },
      ),
    };
  });
}
