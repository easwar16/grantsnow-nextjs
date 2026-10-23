import { beforeEach, expect, it, vi } from "vitest";
const state = vi.hoisted(() => ({ oracle: vi.fn() }));
vi.mock("@/server/identity/session/service", () => ({
  authenticate: async () => ({
    session: { token: "isolated-token" },
    user: { modules: { PROPOSALS: true }, organizationId: "202" },
  }),
}));
vi.mock("@/server/oracle/connection", () => ({ oracle: state.oracle }));
import { loadWidget } from "@/server/modules/home/service";
const queueRow = (i: number) => ({
  proposal_id: i + 1,
  proposal_number: `P_${i + 1}`,
  proposal_type: "PROPOSAL",
  deadline_id: i + 1,
});
beforeEach(() => {
  state.oracle.mockReset();
  state.oracle.mockImplementation(
    async (op: string, _headers: unknown, query?: URLSearchParams) => {
      if (op === "getSharedDashboardPreferences")
        return {
          needAttention: { pApproachingDeadlines: { isVisible: true } },
          insights: { pByYearChart: { isVisible: true } },
        };
      if (op === "getPre_awardGetLkpOrgUnitType")
        return { items: [{ org_unit_id: 202, org_unit_name: "Fixture" }] };
      if (op === "getPre_award_costingGetGlobalVar") return { items: [] };
      const offset = Number(query?.get("p_offset") || 0);
      if (op === "getProposalProp_appr_deadline")
        // Live envelopes misreport hasMore; the page size is what counts.
        return {
          items: Array.from({ length: 25 }, (_, i) => queueRow(offset + i)),
          hasMore: false,
        };
      return {
        items: Array.from({ length: offset === 0 ? 100 : 50 }, (_, i) => ({
          label: String(offset + i),
          code: "Draft",
          value: 1,
        })),
        offset: 0,
        hasMore: false,
      };
    },
  );
});
const calls = (op: string) =>
  state.oracle.mock.calls
    .filter((c) => c[0] === op)
    .map((c) => Object.fromEntries(c[2] as URLSearchParams));
it("loads every chart page with p_offset/p_limit until a short page, ignoring the envelope", async () => {
  const data = await loadWidget("pByYearChart", {
    organization: "202",
    offset: 0,
  });
  expect(data.statistics).toHaveLength(150);
  expect(data.hasMore).toBe(false);
  expect(calls("getProposalGetProposalStatistics")).toEqual([
    { p_offset: "0", p_limit: "100" },
    { p_offset: "100", p_limit: "100" },
  ]);
});
it("rejects a repeated chart page rather than drawing a partial chart", async () => {
  const original = state.oracle.getMockImplementation()!;
  state.oracle.mockImplementation(
    async (op: string, headers: unknown, query?: URLSearchParams) =>
      original(
        op,
        headers,
        op === "getProposalGetProposalStatistics"
          ? new URLSearchParams({ p_offset: "0" })
          : query,
      ),
  );
  await expect(
    loadWidget("pByYearChart", { organization: "202", offset: 0 }),
  ).rejects.toMatchObject({ code: "CONTRACT" });
});
it("pages queues 25 at a time with p_offset/p_limit and stops at the 100-row cap", async () => {
  const first = await loadWidget("pApproachingDeadlines", {
    organization: "202",
    offset: 0,
  });
  expect(first.attention).toHaveLength(25);
  expect(first.hasMore).toBe(true);
  const last = await loadWidget("pApproachingDeadlines", {
    organization: "202",
    offset: 75,
  });
  expect(last.hasMore).toBe(false);
  expect(calls("getProposalProp_appr_deadline")).toEqual([
    { p_offset: "0", p_limit: "25" },
    { p_offset: "75", p_limit: "25" },
  ]);
  expect(last.attention[0].href).toBe("/proposals/PROPOSAL/76");
});
it("refuses queue offsets beyond the cap or off the page grid before Oracle calls", async () => {
  for (const offset of [100, 10])
    await expect(
      loadWidget("pApproachingDeadlines", { organization: "202", offset }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  expect(calls("getProposalProp_appr_deadline")).toEqual([]);
});
