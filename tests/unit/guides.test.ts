import { expect, it } from "vitest";
import { JSDOM } from "jsdom";
import {
  doneKey,
  guideMenu,
  guides,
  guidesFor,
  loadSteps,
} from "@/features/guides/registry";
import { modules } from "@/features/guides/modules";
it("returns guides for the route only", () => {
  expect(guidesFor("/home", []).map((g) => g.id)).toEqual(
    modules.find((m) => m.id === "home")!.guides.map((g) => g.id),
  );
  expect(guidesFor("/proposals", [])).toEqual([]);
});
it("opens only dashboard tabs that exist (home-tab-<key> from dashboard-tabs)", async () => {
  const tabs =
    /^home-tab-(need-attention|insights|opportunities|notifications|dynamic-charts)$/;
  for (const g of guides.filter((g) => g.module.id === "home"))
    for (const s of await loadSteps(g))
      if (s.open !== undefined) expect(s.open).toMatch(tabs);
});
it("applies the module's access to its guides", () => {
  expect(guidesFor("/opportunities", [])).toEqual([]);
  expect(guidesFor("/opportunities", ["opportunities-group"])).toEqual([]);
  expect(
    guidesFor("/opportunities", ["opportunities-finder"]).map((g) => g.id),
  ).toEqual([
    "opportunities-tour",
    "opportunities-search",
    "opportunities-filter",
    "opportunities-card",
  ]);
});
it("groups the menu by module and drops ungranted modules", () => {
  expect(guideMenu([]).map((m) => m.module.id)).toEqual(["home"]);
  expect(
    guideMenu(["opportunities-finder"]).map((m) => [
      m.module.id,
      m.tour?.id,
      m.items.map((g) => g.id),
    ]),
  ).toEqual([
    [
      "home",
      "home-tour",
      [
        "home-organization",
        "home-announcements",
        "home-kpis",
        "home-attention",
        "home-insights",
        "home-featured",
        "home-notifications",
        "home-dynamic-charts",
      ],
    ],
    [
      "opportunities",
      "opportunities-tour",
      ["opportunities-search", "opportunities-filter", "opportunities-card"],
    ],
  ]);
  expect(guideMenu(["awards"]).map((m) => m.module.id)).toEqual([
    "home",
    "awards",
  ]);
});
it("has unique guide and module ids and at most one full tour per module", () => {
  expect(new Set(guides.map((g) => g.id)).size).toBe(guides.length);
  expect(new Set(modules.map((m) => m.id)).size).toBe(modules.length);
  for (const m of modules)
    expect(m.guides.filter((g) => g.auto).length).toBeLessThanOrEqual(1);
});
it.each(modules.map((m) => [m.id, m] as const))(
  "%s: every guide has steps and every steps entry has a guide",
  async (_, module) => {
    const content = (await module.steps()).default;
    expect(Object.keys(content).sort()).toEqual(
      module.guides.map((g) => g.id).sort(),
    );
    for (const g of guides.filter((g) => g.module === module)) {
      const steps = await loadSteps(g);
      expect(steps.length).toBeGreaterThan(0);
      for (const s of steps) expect(s.target && s.selector).toBeFalsy();
    }
  },
);
it("points each award row step at its own control", async () => {
  const guide = guides.find((g) => g.id === "awards-row")!;
  const { document } = new JSDOM(`<ul id="awards-rows"><li id="award-42">
    ${["body", "number", "status", "title", "meta", "link", "clone", "view"]
      .map((k) => `<span id="award-42-${k}"></span>`)
      .join("")}
    </li></ul>`).window;
  expect(
    (await loadSteps(guide)).map(
      (s) => document.querySelector(s.selector!)?.id,
    ),
  ).toEqual([
    "award-42",
    "award-42-number",
    "award-42-title",
    "award-42-link",
    "award-42-clone",
    "award-42-view",
  ]);
});
it("points each card step at its own control, not a sibling or dialog", async () => {
  const card = guides.find((g) => g.id === "opportunities-card")!;
  const { document } = new JSDOM(`<ul id="finder-list"><li>
    <article id="opp-7" class="opportunity-card">
      ${[
        "link",
        "more-info",
        "status",
        "bookmark",
        "share",
        "notes",
        "notes-dialog",
        "apply",
        "convert",
        "convert-to-proposal",
        "convert-dialog",
      ]
        .map((k) => `<span id="opp-7-${k}"></span>`)
        .join("")}
    </article></li></ul>`).window;
  const found = (await loadSteps(card)).map(
    (s) => document.querySelector(s.selector!)?.id,
  );
  expect(found).toEqual([
    "opp-7",
    "opp-7-link",
    "opp-7-more-info",
    "opp-7-status",
    "opp-7-bookmark",
    "opp-7-share",
    "opp-7-notes",
    "opp-7-apply",
    "opp-7-convert",
    "opp-7-convert-to-proposal",
  ]);
});
it("keys completion by version", () => {
  const g = guides[0];
  expect(doneKey({ ...g, version: g.version + 1 })).not.toBe(doneKey(g));
});
