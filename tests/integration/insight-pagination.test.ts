import { beforeEach, expect, it, vi } from "vitest";
const state = vi.hoisted(() => ({ oracle: vi.fn() }));
vi.mock("@/server/session/service", () => ({
  authenticate: async () => ({
    session: { token: "isolated-token" },
    user: { modules: { PROPOSALS: true }, organizationId: "202" },
  }),
}));
vi.mock("@/server/api/transport", () => ({ oracle: state.oracle }));
import { loadWidget } from "@/server/home/service";
beforeEach(() => {
  state.oracle.mockReset();
  state.oracle.mockImplementation(
    async (op: string, _headers: unknown, query?: URLSearchParams) => {
      if (op === "getSharedDashboardPreferences")
        return {
          needAttention: {},
          insights: { pByYearChart: { isVisible: true } },
        };
      if (op === "getPre_awardGetLkpOrgUnitType")
        return { items: [{ org_unit_id: 202, org_unit_name: "Fixture" }] };
      if (op === "getPre_award_costingGetGlobalVar") return { items: [] };
      const offset = Number(query?.get("offset") || 0);
      return {
        items: Array.from({ length: offset === 0 ? 100 : 50 }, (_, i) => ({
          label: String(offset + i),
          code: "Draft",
          value: 1,
        })),
        offset,
        hasMore: offset === 0,
      };
    },
  );
});
it("loads every chart page before rendering statistics", async () => {
  const data = await loadWidget("pByYearChart", {
    organization: "202",
    offset: 0,
  });
  expect(data.statistics).toHaveLength(150);
  expect(data.hasMore).toBe(false);
  const queries = state.oracle.mock.calls
    .filter((c) => c[0] === "getProposalGetProposalStatistics")
    .map((c) => (c[2] as URLSearchParams).get("offset"));
  expect(queries).toEqual(["0", "100"]);
});
it("rejects repeated or inconsistent pages rather than drawing a partial chart", async () => {
  const original = state.oracle.getMockImplementation()!;
  state.oracle.mockImplementation(
    async (op: string, headers: unknown, query?: URLSearchParams) => {
      const body = await original(op, headers, query);
      if (
        op === "getProposalGetProposalStatistics" &&
        query?.get("offset") === "100"
      )
        return { ...body, offset: 0 };
      return body;
    },
  );
  await expect(
    loadWidget("pByYearChart", { organization: "202", offset: 0 }),
  ).rejects.toMatchObject({ code: "CONTRACT" });
});
