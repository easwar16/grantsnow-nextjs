import { it, expect, vi, beforeEach, afterEach } from "vitest";
import { mockOracle } from "@/test-support/transport";
import { oracleQuery } from "@/server/modules/proposals/where-clause";
import { parseQuery } from "@/features/modules/proposals/schemas";
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
it("simulated writes answer {} unless the fixture names a reply, and reports answer a stub file", async () => {
  const { mockOracleWrite, mockOracleFile } =
    await import("@/test-support/transport");
  expect(
    await mockOracleWrite("postUnitInquiry", {}, undefined, undefined, {}),
  ).toEqual({});
  expect(
    await mockOracleWrite("postProposalProposal", {}, undefined, undefined, {
      proposals: { main_proposal_id: 1001 },
    }),
  ).toEqual({ proposal: 1001 });
  expect((await mockOracleFile()).mime).toBe("application/pdf");
});
it("fixture uses the advanced proposal operation and applies conditions", async () => {
  const query = parseQuery(
    new URLSearchParams({
      conditions: JSON.stringify([
        { attribute: "proposal_title", op: "$co", value: "climate" },
      ]),
    }),
  );
  const result = (await mockOracle(
    "getProposalsListAdvanced",
    {},
    oracleQuery(query, true),
  )) as { items: { proposal_title: string }[]; total_count: number };
  expect(result.total_count).toBeGreaterThan(0);
  expect(result.total_count).toBeLessThan(37);
  expect(result.items.every((row) => /climate/i.test(row.proposal_title))).toBe(
    true,
  );
});
