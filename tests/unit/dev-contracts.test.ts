import { afterEach, expect, it, vi } from "vitest";
import {
  assertWritesEnabled,
  browserSessionMode,
} from "@/server/platform/configuration/environment";
import { mapProposals } from "@/server/modules/proposals/service";
import { parseQuery } from "@/features/modules/proposals/schemas";
import { mapWidget } from "@/server/modules/home/service";
import { widgets } from "@/server/modules/home/widgets";
import { serverFunctions } from "@/server/functions";
afterEach(() => vi.unstubAllEnvs());
const local = {
  DEV_BROWSER_SESSION: "true",
  APP_ENV: "development",
  NODE_ENV: "development",
  APP_ORIGIN: "http://127.0.0.1:3000",
  FIXTURE_MODE: "false",
};
it("requires explicit local DEV browser session mode", () => {
  expect(browserSessionMode(local)).toBe(true);
  expect(browserSessionMode({ ...local, DEV_BROWSER_SESSION: "false" })).toBe(
    false,
  );
});
it.each([
  { NODE_ENV: "production" },
  { APP_ENV: "staging" },
  { FIXTURE_MODE: "true" },
  { APP_ORIGIN: "https://app.example" },
])("rejects unsafe browser mode %j", (override) => {
  expect(() => browserSessionMode({ ...local, ...override })).toThrow();
});
it("inherits current VBCS resource defaults but honors explicit visibility overrides", () => {
  expect(
    serverFunctions.resources
      .proposalColumns(serverFunctions.resources.mergeResourceDefaults([]))
      .some((c) => c.key === "value"),
  ).toBe(true);
  const rows = serverFunctions.resources.mergeResourceDefaults([
    {
      module_name: "PROPOSAL",
      label_type: "labels",
      label_name: "list-total-cost",
      label_value: "Cost",
      is_visible: "N",
    },
  ]);
  expect(
    serverFunctions.resources
      .proposalColumns(rows)
      .some((c) => c.key === "value"),
  ).toBe(false);
  expect(() =>
    serverFunctions.resources.mergeResourceDefaults({ response_msg: "ERROR" }),
  ).toThrow();
});
it("shows each listing filter only on its list-* entry's 'Y', labelled from the bundle", () => {
  const rows = serverFunctions.resources.mergeResourceDefaults([
    {
      module_name: "PROPOSAL",
      label_type: "labels",
      label_name: "list-title",
      label_value: "Project title",
      is_visible: "Y",
    },
    {
      module_name: "PROPOSAL",
      label_type: "labels",
      label_name: "list-tags",
      label_value: "Tags",
      is_visible: "N",
    },
  ]);
  const filters = serverFunctions.resources.proposalFilters(rows);
  expect(filters.search).toBe("Project title");
  expect(filters.tags).toBeNull();
  // A key missing from the bundle and the seed stays hidden (fail closed).
  expect(
    serverFunctions.resources.proposalFilters(
      rows.filter((r) => r.label_name !== "list-category"),
    ).category,
  ).toBeNull();
});
it("ignores the unreliable ORDS hasMore flag: total_count, else a full page, decides", () => {
  const q = parseQuery(new URLSearchParams());
  // DEV says "true" on a short last page and "false" mid-list (GN-Dashboard paging note).
  expect(mapProposals({ items: [], hasMore: "true" }, q, []).hasMore).toBe(
    false,
  );
  expect(
    mapProposals({ items: [], hasMore: "false", total_count: 25 }, q, [])
      .hasMore,
  ).toBe(true);
});
it("preserves a null statistics category without inventing a label or losing other groups", () => {
  const w = widgets.find((w) => w.id === "pByStatusChart")!;
  const data = mapWidget(
    {
      items: [
        { code: "UNSET", label: null, value: 2 },
        { code: "DRAFT", label: "Draft", value: 3 },
      ],
    },
    w,
    { offset: 0 },
  );
  expect(data.statistics.map((r) => [r.label, r.value])).toEqual([
    ["", 2],
    ["Draft", 3],
  ]);
});
it("keeps live Oracle writes off unless explicitly enabled", () => {
  for (const env of [{}, { WRITES_ENABLED: "false" }, { WRITES_ENABLED: "1" }])
    expect(() => assertWritesEnabled(env)).toThrow(
      expect.objectContaining({ code: "WRITES_DISABLED" }),
    );
  expect(() => assertWritesEnabled({ WRITES_ENABLED: "true" })).not.toThrow();
});
