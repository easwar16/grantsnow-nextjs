import { it, expect, vi, beforeEach, afterEach } from "vitest";
import { mockOracle } from "@/test-support/transport";
import { oracleQuery } from "@/server/proposals/where-clause";
import { parseQuery } from "@/features/proposals/schemas";
beforeEach(() => {
  vi.stubEnv("FIXTURE_MODE", "true");
  vi.stubEnv("APP_ENV", "development");
  vi.stubEnv("NODE_ENV", "development");
});
afterEach(() => vi.unstubAllEnvs());
it("fixture honours the server-built where clause", async () => {
  const run = async (qs: string) =>
    (await mockOracle(
      "getPre_awardGetProposalsList",
      {},
      oracleQuery(parseQuery(new URLSearchParams(qs))),
    )) as { items: { proposal_title: string }[]; total_count: number };
  const all = await run("");
  const climate = await run("search=climate");
  expect(all.total_count).toBe(37);
  expect(climate.total_count).toBeGreaterThan(0);
  expect(climate.total_count).toBeLessThan(37);
  expect(climate.items.every((r) => /climate/i.test(r.proposal_title))).toBe(
    true,
  );
  const outline = await run("search=climate&type=OUTLINE_PROPOSAL");
  expect(outline.total_count).toBe(4);
  const o = await run("search=o'brien");
  expect(o.total_count).toBe(0);
});
