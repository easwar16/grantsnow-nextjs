import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { mockOracle } from "@/test-support/transport";
import { defaultDueDiligenceFilters } from "@/features/modules/due-diligence/schema";
import {
  dueDiligenceWhereClause,
  type DueDiligenceListView,
} from "@/server/modules/due-diligence/listing";

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
) as DueDiligenceListView["gates"];
beforeEach(() => {
  vi.stubEnv("FIXTURE_MODE", "true");
  vi.stubEnv("APP_ENV", "development");
  vi.stubEnv("NODE_ENV", "development");
});
afterEach(() => vi.unstubAllEnvs());

it("uses the Due Diligence criteria and escapes text", () => {
  const clause = dueDiligenceWhereClause(
    {
      ...defaultDueDiligenceFilters,
      number: "DD_808",
      title: "O'Brien",
      status: "DRFT",
    },
    gates,
  );
  expect(clause).toContain("\"status_lkp_code\"='DRFT'");
  expect(clause).toContain("O''Brien");
  expect(clause).toContain('"application_number"');
});

it("does not send hidden Due Diligence filters", () => {
  const clause = dueDiligenceWhereClause(
    { ...defaultDueDiligenceFilters, title: "secret" },
    { ...gates, title: false },
  );
  expect(clause).toBe("");
});

it("isolates fixture applications by object type", async () => {
  const query = new URLSearchParams({ p_offset: "0", p_limit: "10" });
  const dueDiligence = (await mockOracle(
    "getDynamicFormsApplicationList",
    { access_type: "DDA_ACCESS", object_type: "DUE_DILIGENCE" },
    query,
  )) as { items: { application_number: string }[] };
  const ethics = (await mockOracle(
    "getDynamicFormsApplicationList",
    { access_type: "EA_ACCESS", object_type: "ETHICS" },
    query,
  )) as { items: { application_number: string }[] };
  expect(dueDiligence.items.map((row) => row.application_number)).toEqual([
    "DD_808",
  ]);
  expect(ethics.items.map((row) => row.application_number)).toEqual([
    "ETH_808",
  ]);
});
