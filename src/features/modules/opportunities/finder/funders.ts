import type { FunderKey } from "./state";
/** One getOppFunders row: a funder within a site (a row whose value equals its site is the site itself). */
export interface FunderRow {
  value: string;
  site: string;
  site_name: string | null;
}
export interface SiteNode {
  site: string;
  label: string;
  funders: string[];
}
/** VBCS formatSiteLabel: the site's name, else its code made readable (UK_RESEARCH → Uk Research). */
export function siteLabel(site: string, name: string | null): string {
  if (name) return name;
  return /[_ ]/.test(site)
    ? site
        .replace(/_/g, " ")
        .toLowerCase()
        .replace(/\b\w/g, (c) => c.toUpperCase())
    : site;
}
/** VBCS prepareFilterLOV: sites with their funders; a search keeps a matching site whole, else only its matching funders. */
export function funderTree(rows: FunderRow[], search = ""): SiteNode[] {
  const names = new Map(rows.map((r) => [r.site, r.site_name]));
  const grouped = new Map<string, string[]>();
  for (const r of rows) {
    if (!grouped.has(r.site)) grouped.set(r.site, []);
    if (r.value !== r.site) grouped.get(r.site)!.push(r.value);
  }
  const q = search.trim().toLowerCase();
  return [...grouped].flatMap(([site, funders]): SiteNode[] => {
    if (!site) return [];
    const node = {
      site,
      label: siteLabel(site, names.get(site) ?? null),
      funders,
    };
    if (
      !q ||
      site.toLowerCase().includes(q) ||
      (names.get(site) ?? "").toLowerCase().includes(q)
    )
      return [node];
    const matching = funders.filter((f) => f.toLowerCase().includes(q));
    return matching.length ? [{ ...node, funders: matching }] : [];
  });
}
export const isSite = (k: FunderKey, site: string) =>
  k.site === site && k.funder === null;
/** Ticking a site selects the whole site (its funder keys fold into it); unticking clears the site and its funders. */
export function toggleSite(
  selected: FunderKey[],
  node: SiteNode,
  on: boolean,
): FunderKey[] {
  const others = selected.filter((k) => k.site !== node.site);
  return on ? [...others, { site: node.site, funder: null }] : others;
}
/** Unticking one funder of a ticked site keeps its siblings, as single funder keys. */
export function toggleFunder(
  selected: FunderKey[],
  node: SiteNode,
  funder: string,
  on: boolean,
): FunderKey[] {
  if (selected.some((k) => isSite(k, node.site))) {
    if (on) return selected;
    const rest = selected.filter((k) => k.site !== node.site);
    return [
      ...rest,
      ...node.funders
        .filter((f) => f !== funder)
        .map((f) => ({ site: node.site, funder: f })),
    ];
  }
  const without = selected.filter(
    (k) => !(k.site === node.site && k.funder === funder),
  );
  return on ? [...without, { site: node.site, funder }] : without;
}
