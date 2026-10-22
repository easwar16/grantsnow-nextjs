import { describe, expect, it } from "vitest";
import {
  funderTree,
  siteLabel,
  toggleFunder,
  toggleSite,
  type FunderRow,
} from "@/features/opportunities/finder/funders";
import {
  MAX_FUNDER_KEYS,
  type FunderKey,
} from "@/features/opportunities/finder/state";
// Port of GN-Angular funder-tree.spec.ts.
const rows: FunderRow[] = [
  {
    value: "UKRI",
    site: "UKRI",
    site_name: "UK Research and Innovation (UKRI)",
  },
  {
    value: "EPSRC",
    site: "UKRI",
    site_name: "UK Research and Innovation (UKRI)",
  },
  {
    value: "MRC",
    site: "UKRI",
    site_name: "UK Research and Innovation (UKRI)",
  },
  { value: "NIH Clinical", site: "NIH_US", site_name: null },
];
describe("funder tree", () => {
  it("groups funders under their site and leaves the site row out of its own children", () => {
    expect(funderTree(rows)).toEqual([
      {
        site: "UKRI",
        label: "UK Research and Innovation (UKRI)",
        funders: ["EPSRC", "MRC"],
      },
      { site: "NIH_US", label: "Nih Us", funders: ["NIH Clinical"] },
    ]);
    expect(siteLabel("BHF", null)).toBe("BHF");
  });
  it("keeps a matching site whole, else only its matching funders", () => {
    expect(funderTree(rows, "research")[0].funders).toEqual(["EPSRC", "MRC"]);
    expect(funderTree(rows, "mrc")).toEqual([
      {
        site: "UKRI",
        label: "UK Research and Innovation (UKRI)",
        funders: ["MRC"],
      },
    ]);
    expect(funderTree(rows, "nothing")).toEqual([]);
  });
  it("folds funder keys into a ticked site, and unticking one funder keeps its siblings", () => {
    const [ukri] = funderTree(rows);
    const site = toggleSite(
      [
        { site: "UKRI", funder: "MRC" },
        { site: "NIH_US", funder: null },
      ],
      ukri,
      true,
    );
    expect(site).toEqual([
      { site: "NIH_US", funder: null },
      { site: "UKRI", funder: null },
    ]);
    expect(toggleFunder(site, ukri, "MRC", false)).toEqual([
      { site: "NIH_US", funder: null },
      { site: "UKRI", funder: "EPSRC" },
    ]);
    expect(toggleSite(site, ukri, false)).toEqual([
      { site: "NIH_US", funder: null },
    ]);
  });
  it("lets the 19th key in and the 20th over the limit", () => {
    // The tree component refuses any selection longer than MAX_FUNDER_KEYS ("Cannot add these many filter options").
    const many = Array.from({ length: 30 }, (_, i) => `F${i}`);
    const [node] = funderTree(
      many.map((value) => ({ value, site: "BIG", site_name: null })),
    );
    let selected: FunderKey[] = [];
    for (const f of many.slice(0, MAX_FUNDER_KEYS))
      selected = toggleFunder(selected, node, f, true);
    expect(selected).toHaveLength(19);
    expect(toggleFunder(selected, node, "F19", true).length).toBeGreaterThan(
      MAX_FUNDER_KEYS,
    );
    // Unticking one funder of a whole 30-funder site would add 29 keys: also over the limit.
    expect(
      toggleFunder([{ site: "BIG", funder: null }], node, "F0", false),
    ).toHaveLength(29);
  });
});
