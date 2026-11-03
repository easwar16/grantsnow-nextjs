/**
 * The finder's one filter state (GN-Angular where-clause.ts types + finder-state.ts): the panel, the advanced popup
 * and the search box all read and write it. Pure, so the server schema and the client share it.
 */
export const FINDER_TABS = [
  "featured",
  "others",
  "bookmarked",
  "shared",
] as const;
export type FinderTab = (typeof FINDER_TABS)[number];
export const DATE_OPS = ["BETWEEN", "GT", "LT", "NULL", "NOT_NULL"] as const;
export type DateOp = (typeof DATE_OPS)[number];
/** One advanced-filter date: the operator, a single date for GT / LT, a range for BETWEEN. Dates are `yyyy-MM-dd`. */
export interface DateFilter {
  op: DateOp;
  on: string;
  from: string;
  to: string;
}
/** A funder-tree selection: a whole site (`funder` null), or one funder within it. */
export interface FunderKey {
  site: string;
  funder: string | null;
}
// dateCodesArray: hard-coded in the original page model, `closing_soon` included.
export const DATE_SORTS = [
  { code: "closing_soon", label: "Closing Soon" },
  { code: "publication_date", label: "Publication Date" },
  { code: "opening_date", label: "Opening Date" },
  { code: "closing_date", label: "Closing Date" },
] as const;
export type DateSort = (typeof DATE_SORTS)[number]["code"];
export interface FinderFilters {
  search: string;
  match: "all" | "any";
  funders: FunderKey[];
  status: string[];
  funderType: string | null;
  fundingType: string[];
  orderBy: DateSort;
  dir: "ascending" | "descending";
  publication: DateFilter;
  opening: DateFilter;
  closing: DateFilter;
  totalFundFrom: number | null;
  totalFundTo: number | null;
  call: string;
  aln: string;
  fon: string;
  costSharing: string;
}
/** The original refuses a 20th funder selection ("Cannot add these many filter options"). */
export const MAX_FUNDER_KEYS = 19;
const DATE_DEFAULT: DateFilter = { op: "BETWEEN", on: "", from: "", to: "" };
/** The original's defaults: OPEN + UPCOMING, newest publication first, every date operator BETWEEN. */
export const DEFAULT_FILTERS: FinderFilters = {
  search: "",
  match: "all",
  funders: [],
  status: ["OPEN", "UPCOMING"],
  funderType: null,
  fundingType: [],
  orderBy: "publication_date",
  dir: "descending",
  publication: DATE_DEFAULT,
  opening: DATE_DEFAULT,
  closing: DATE_DEFAULT,
  totalFundFrom: null,
  totalFundTo: null,
  call: "",
  aln: "",
  fon: "",
  costSharing: "",
};
/** The six URL keys of VBCS manageFilterURL; search, match and the advanced fields never reach the address. */
export const URL_KEYS = [
  "funders",
  "status",
  "funderType",
  "fundingType",
  "orderBy",
  "dateDir",
] as const;
export type FinderQuery = Record<(typeof URL_KEYS)[number], string | null>;
// A funder within its site is `SITE~Funder`, a whole site just `SITE`; parts are URI-encoded so commas survive.
const SEP = "~";
// encodeURIComponent leaves `~` alone; a name containing one would split in two (a GN-Angular defect).
const encodePart = (part: string) =>
  encodeURIComponent(part).replace(/~/g, "%7E");
/** VBCS manageFilterURL `sync`: the panel filters as query params; empty ones are left out (null). */
export function toQuery(f: FinderFilters): FinderQuery {
  const list = (values: string[]) => (values.length ? values.join(",") : null);
  return {
    funders: list(
      f.funders.map(
        (k) =>
          encodePart(k.site) +
          (k.funder === null ? "" : SEP + encodePart(k.funder)),
      ),
    ),
    status: list(f.status),
    funderType: f.funderType || null,
    fundingType: list(f.fundingType),
    orderBy: f.orderBy || null,
    dateDir: f.dir,
  };
}
/** The address form of toQuery, empty keys dropped. */
export function queryString(f: FinderFilters) {
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(toQuery(f))) if (v) params.set(k, v);
  return params.toString();
}
const isSort = (v: string): v is DateSort =>
  DATE_SORTS.some((d) => d.code === v);
function decode(part: string) {
  try {
    return decodeURIComponent(part);
  } catch {
    return part; // A hand-edited link with a stray % keeps its literal text.
  }
}
/**
 * VBCS manageFilterURL `init`: the params present replace those filters; the rest stay as they were. Unknown sort
 * codes and directions are ignored, and funders past the limit dropped, so a link can never exceed the panel.
 */
export function fromQuery(
  q: Partial<Record<keyof FinderQuery, string | null | undefined>>,
  base: FinderFilters,
): FinderFilters {
  const list = (raw: string | null | undefined) =>
    (raw ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
  const funders = list(q.funders)
    .map((part): FunderKey => {
      const [site, funder] = part.split(SEP);
      return {
        site: decode(site),
        funder: funder === undefined ? null : decode(funder),
      };
    })
    .slice(0, MAX_FUNDER_KEYS);
  return {
    ...base,
    ...(funders.length ? { funders } : {}),
    ...(list(q.status).length ? { status: list(q.status) } : {}),
    ...(q.funderType ? { funderType: q.funderType } : {}),
    ...(list(q.fundingType).length ? { fundingType: list(q.fundingType) } : {}),
    ...(q.orderBy && isSort(q.orderBy) ? { orderBy: q.orderBy } : {}),
    ...(q.dateDir === "ascending" || q.dateDir === "descending"
      ? { dir: q.dateDir }
      : {}),
  };
}
/** Whether a link carries any finder filter (only then does it replace the remembered ones). */
export const hasUrlFilters = (q: Partial<Record<string, unknown>>) =>
  URL_KEYS.some((k) => typeof q[k] === "string" && q[k] !== "");
/** The advanced popup's Clear (ClearAdvancedFilterButtonActionChain): every filter and the search, not sort or match. */
export function cleared(f: FinderFilters): FinderFilters {
  return { ...DEFAULT_FILTERS, match: f.match, orderBy: f.orderBy, dir: f.dir };
}
/** The panel's Clear Filters: everything back to the defaults except the search text and match mode. */
export function panelCleared(f: FinderFilters): FinderFilters {
  return { ...DEFAULT_FILTERS, search: f.search, match: f.match };
}
/** On entering the finder: search, match and sort were page-scoped in the original, so they start over. */
export function entered(f: FinderFilters): FinderFilters {
  const { search, match, orderBy, dir } = DEFAULT_FILTERS;
  return { ...f, search, match, orderBy, dir };
}
/** Featured needs a non-empty preference (getTabs); without one, or before a choice, the default is Others. */
export function resolveTab(
  chosen: FinderTab | null,
  hasPreferences: boolean,
): FinderTab {
  if (chosen && (chosen !== "featured" || hasPreferences)) return chosen;
  return hasPreferences ? "featured" : "others";
}
/** The count strip: loaded of total while more remain, else the total (VBCS showed the last page's size). */
export function countStrip(loaded: number, total: number | null) {
  return total !== null && loaded < total
    ? { partial: true as const, text: `${loaded} of ${total}` }
    : { partial: false as const, text: String(total ?? loaded) };
}
