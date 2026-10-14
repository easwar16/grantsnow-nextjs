import { afterEach, expect, it, vi } from "vitest";
import { browserSessionMode } from "@/server/configuration/environment";
import {
  mergeResourceDefaults,
  proposalColumns,
} from "@/server/configuration/resources";
import { mapProposals } from "@/server/proposals/service";
import { parseQuery } from "@/features/proposals/schemas";
import { mapWidget } from "@/server/home/service";
import { widgets } from "@/server/home/widgets";
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
    proposalColumns(mergeResourceDefaults([])).some((c) => c.key === "value"),
  ).toBe(true);
  const rows = mergeResourceDefaults([
    {
      module_name: "PROPOSAL",
      label_type: "labels",
      label_name: "list-total-cost",
      label_value: "Cost",
      is_visible: "N",
    },
  ]);
  expect(proposalColumns(rows).some((c) => c.key === "value")).toBe(false);
  expect(() => mergeResourceDefaults({ response_msg: "ERROR" })).toThrow();
});
it("maps the actual ORDS string paging flags without coercing false to true", () => {
  const q = parseQuery(new URLSearchParams());
  expect(mapProposals({ items: [], hasMore: "false" }, q, []).hasMore).toBe(
    false,
  );
  expect(mapProposals({ items: [], hasMore: "true" }, q, []).hasMore).toBe(
    true,
  );
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
