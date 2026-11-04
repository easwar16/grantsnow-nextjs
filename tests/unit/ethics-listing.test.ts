import { expect, it, vi, beforeEach, afterEach } from "vitest";
import { mockOracle } from "@/test-support/transport";
import { defaultEthicsFilters } from "@/features/modules/ethics/listing/schema";
import {
  ethicsWhereClause,
  type EthicsListView,
} from "@/server/modules/ethics/listing";

const gates = Object.fromEntries(
  [
    "number",
    "createdBy",
    "type",
    "responseStatus",
    "formType",
    "org",
    "title",
    "risk",
    "sort",
    "created",
    "deadline",
    "expiry",
  ].map((key) => [key, true]),
) as EthicsListView["gates"];
beforeEach(() => {
  vi.stubEnv("FIXTURE_MODE", "true");
  vi.stubEnv("APP_ENV", "development");
  vi.stubEnv("NODE_ENV", "development");
});
afterEach(() => vi.unstubAllEnvs());

it("uses VBCS Ethics criteria and escapes typed text", () => {
  const clause = ethicsWhereClause(
    {
      ...defaultEthicsFilters,
      number: "ETH_808",
      title: "O'Brien",
      status: "DRFT",
    },
    gates,
  );
  expect(clause).toContain("\"status_lkp_code\"='DRFT'");
  expect(clause).toContain("O''Brien");
  expect(clause).toContain('"application_number"');
});

it("does not send hidden Ethics filters to Oracle", () => {
  const clause = ethicsWhereClause(
    { ...defaultEthicsFilters, title: "secret" },
    { ...gates, title: false },
  );
  expect(clause).toBe("");
});

it("the Ethics fixture applies server filters and pages", async () => {
  const clause = ethicsWhereClause(
    { ...defaultEthicsFilters, status: "DRFT" },
    gates,
  );
  const rows = (await mockOracle(
    "getDynamicFormsApplicationList",
    { access_type: "EA_ACCESS" },
    new URLSearchParams({
      p_where_clause: clause,
      p_offset: "0",
      p_limit: "10",
    }),
  )) as { items: { application_number: string }[]; hasMore: boolean };
  expect(rows.items.map((row) => row.application_number)).toEqual(["ETH_808"]);
  expect(rows.hasMore).toBe(false);
});
