/** A cost line as AwardDetails `Award Project Cost Line` returns it (the fields the tab uses). */
export interface CostLine {
  id: number;
  project_id: number;
  funding_section_lkp_code: string;
  funding_section: string;
  cost_category_type_lkp_code: string;
  cost_category: string;
  costing_group_id: number | null;
  staff_name: string;
  cost_category_description: string;
  cost_start_date: string;
  cost_end_date: string;
  gl_nominal: string;
  gl_nominal_code: string;
  unit_type: string;
  units: number | null;
  project_hours: number | null;
  project_months: number | null;
  sponsor_contribution: number;
  instituition_contribution: number;
  total_cost: number;
  is_editable: boolean;
  person_id: number | null;
  project_role_id: number | null;
  cost_category_item_id: number | null;
  award_project_link_id: number | null;
}
export interface Amounts {
  sponsor: number;
  institution: number;
  total: number;
  sponsorPct: number;
  institutionPct: number;
}
/** A cost line merged by its costing group (legacy prepareCostingData depth 2). */
export interface CostLeaf extends Amounts {
  key: string;
  line: CostLine;
}
export interface CostCategory extends Amounts {
  key: string;
  code: string;
  name: string;
  leaves: CostLeaf[];
  /** The group's first line: what Edit opens (legacy editRowData of a group node). */
  first: CostLine;
}
export interface CostSection extends Amounts {
  key: string;
  code: string;
  name: string;
  categories: CostCategory[];
  first: CostLine;
}
export interface ProjectCosts extends Amounts {
  projectId: number;
  sections: CostSection[];
}

/** Legacy calcPct: a share rounded to four places; 0 without a total. */
export const calcPct = (part: number, total: number) =>
  total !== 0 ? Math.round((part / total) * 10000) / 10000 : 0;
const amounts = (nodes: Amounts[]): Amounts => {
  const sponsor = nodes.reduce((a, n) => a + n.sponsor, 0),
    institution = nodes.reduce((a, n) => a + n.institution, 0),
    total = nodes.reduce((a, n) => a + n.total, 0);
  return {
    sponsor,
    institution,
    total,
    sponsorPct: calcPct(sponsor, total),
    institutionPct: calcPct(institution, total),
  };
};
/** Groups in first-seen order. */
function groupBy<T>(items: T[], key: (item: T) => string) {
  const groups = new Map<string, T[]>();
  for (const item of items) {
    const k = key(item);
    groups.set(k, [...(groups.get(k) ?? []), item]);
  }
  return [...groups];
}

/**
 * Legacy prepareCostingData: per project, funding section → cost category type → leaves merged by costing group, STAFF
 * lines first; every level sums its children and carries its funder and institution shares.
 */
export function costTree(lines: CostLine[]): ProjectCosts[] {
  const ordered = [
    ...lines.filter((l) => l.cost_category_type_lkp_code === "STAFF"),
    ...lines.filter((l) => l.cost_category_type_lkp_code !== "STAFF"),
  ];
  return groupBy(ordered, (l) => String(l.project_id)).map(
    ([projectId, projectLines]) => {
      const sections = groupBy(
        projectLines,
        (l) => l.funding_section_lkp_code,
      ).map(([code, sectionLines]) => {
        const categories = groupBy(
          sectionLines,
          (l) => l.cost_category_type_lkp_code,
        ).map(([type, typeLines]) => {
          const leaves = groupBy(typeLines, (l) =>
            l.costing_group_id === null
              ? `line-${l.id}`
              : String(l.costing_group_id),
          ).map(([group, groupLines]) => ({
            key: `${projectId}-${code}-${type}-${group}`,
            line: groupLines[0],
            ...amounts(
              groupLines.map((l) => ({
                sponsor: l.sponsor_contribution,
                institution: l.instituition_contribution,
                total: l.total_cost,
                sponsorPct: 0,
                institutionPct: 0,
              })),
            ),
          }));
          return {
            key: `${projectId}-${code}-${type}`,
            code: type,
            name: typeLines[0].cost_category || type,
            leaves,
            first: typeLines[0],
            ...amounts(leaves),
          };
        });
        return {
          key: `${projectId}-${code}`,
          code,
          name: sectionLines[0].funding_section || code,
          categories,
          first: sectionLines[0],
          ...amounts(categories),
        };
      });
      return { projectId: Number(projectId), sections, ...amounts(sections) };
    },
  );
}

/** The award's split across every project (legacy getGlobalCosts). */
export interface GlobalCosts {
  funderCost: number;
  funderPct: number;
  instiCost: number;
  instiPct: number;
  total: number;
}
export function globalCosts(projects: ProjectCosts[]): GlobalCosts {
  const all = amounts(projects);
  return {
    funderCost: all.sponsor,
    instiCost: all.institution,
    total: all.total,
    funderPct: all.total ? all.sponsor / all.total : 0,
    instiPct: all.total ? all.institution / all.total : 0,
  };
}
export type GlobalEdit =
  "INSTI-COST" | "INSTI-PCT" | "FUND-COST" | "FUND-PCT" | "TOTAL";
const safe = (n: number, d: number) => (d ? n / d : 0);
/** Legacy globalValueChange. */
export function globalChange(
  g: GlobalCosts,
  edit: GlobalEdit,
  v: number,
): GlobalCosts {
  const T = g.total;
  switch (edit) {
    case "INSTI-COST":
      return {
        ...g,
        instiCost: v,
        instiPct: safe(v, T),
        funderCost: T - v,
        funderPct: 1 - safe(v, T),
      };
    case "INSTI-PCT":
      return {
        ...g,
        instiPct: v,
        instiCost: T * v,
        funderPct: 1 - v,
        funderCost: T * (1 - v),
      };
    case "FUND-COST":
      return {
        ...g,
        funderCost: v,
        funderPct: safe(v, T),
        instiCost: T - v,
        instiPct: 1 - safe(v, T),
      };
    case "FUND-PCT":
      return {
        ...g,
        funderPct: v,
        funderCost: T * v,
        instiPct: 1 - v,
        instiCost: T * (1 - v),
      };
    case "TOTAL":
      return {
        ...g,
        total: v,
        instiCost: v * g.instiPct,
        funderCost: v * g.funderPct,
      };
  }
}

/** A cost line's split in the dialog (legacy calculateHeaderCost; shares are fractions). */
export interface Split {
  sponsor: number;
  institution: number;
  total: number;
  sponsorPct: number;
  institutionPct: number;
}
/**
 * Legacy calculateHeaderCost. Refused (unchanged): a negative total or funder amount or share, an institution amount
 * above the total, or a share above 100% (legacy compared fractions with 100, so its cap never held).
 */
export function splitChange(s: Split, edit: GlobalEdit, v: number): Split {
  const T = s.total;
  if (!Number.isFinite(v)) return s;
  if (
    v < 0 &&
    (edit === "TOTAL" || edit === "FUND-COST" || edit === "FUND-PCT")
  )
    return s;
  if (edit === "INSTI-COST" && v > T) return s;
  if ((edit === "INSTI-PCT" || edit === "FUND-PCT") && v > 1) return s;
  switch (edit) {
    case "FUND-COST":
      return {
        ...s,
        sponsor: v,
        institution: T - v,
        sponsorPct: safe(v, T),
        institutionPct: safe(T - v, T),
      };
    case "INSTI-COST":
      return {
        ...s,
        institution: v,
        sponsor: T - v,
        institutionPct: safe(v, T),
        sponsorPct: safe(T - v, T),
      };
    case "FUND-PCT":
      return {
        ...s,
        sponsorPct: v,
        institutionPct: 1 - v,
        sponsor: v * T,
        institution: T - v * T,
      };
    case "INSTI-PCT":
      return {
        ...s,
        institutionPct: v,
        sponsorPct: 1 - v,
        institution: v * T,
        sponsor: T - v * T,
      };
    case "TOTAL": {
      const sponsor = s.sponsorPct * v;
      return {
        ...s,
        total: v,
        sponsor,
        institution: v - sponsor,
        institutionPct: safe(v - sponsor, v),
      };
    }
  }
}
