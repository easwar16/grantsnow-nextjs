import { beforeEach, expect, it, vi } from "vitest";
const state = vi.hoisted(() => ({
  oracle: vi.fn(),
  modules: {} as Record<string, boolean>,
}));
vi.mock("@/server/identity/session/service", () => ({
  authenticate: async () => ({
    session: { token: "isolated-token" },
    user: { modules: state.modules, organizationId: "202" },
  }),
}));
vi.mock("@/server/oracle/connection", () => ({ oracle: state.oracle }));
import { GET } from "@/app/api/home/[widget]/route";
const visible = (ids: string[]) =>
  Object.fromEntries(ids.map((id) => [id, { isVisible: true }]));
beforeEach(() => {
  state.modules = { PROPOSALS: true, AWARDS: true };
  state.oracle.mockReset();
  state.oracle.mockImplementation(
    async (op: string, headers: Record<string, string>) => {
      if (op === "getSharedDashboardPreferences")
        return {
          needAttention: {},
          insights: visible([
            "pByYearChart",
            "awardedProposalsChart",
            "highestGapsChart",
          ]),
        };
      if (op === "getPre_awardGetLkpOrgUnitType")
        return {
          items: [
            { ORG_UNIT_ID: 202, ORG_UNIT_NAME: "University" },
            { ORG_UNIT_ID: 204, ORG_UNIT_NAME: "Faculty of Health" },
          ],
        };
      if (op === "getPre_award_costingGetGlobalVar") return { items: [] };
      if (op === "getSharedGetOppCategoryStat")
        return {
          items: [{ SECTORS: "Health", APPLIED_AMT: 9, AWARDED_AMT: 4 }],
        };
      if (headers.chart_type === "AWARD_FACULTY")
        return { items: [{ label: "Faculty of Health", value: 3 }] };
      return {
        items: [
          { label: "2025", code: "Submitted", status_code: "SUB", value: 2 },
        ],
      };
    },
  );
});
const get = async (id: string) =>
  (
    await GET(new Request(`http://localhost/api/home/${id}?organization=202`), {
      params: Promise.resolve({ widget: id }),
    })
  ).json();
it("sends each point's listing link built from the legacy drill, never its raw code", async () => {
  const year = await get("pByYearChart");
  expect(year.statistics).toEqual([
    {
      id: "2025:Submitted:0",
      label: "2025",
      series: "Submitted",
      value: 2,
      href: "/proposals?status=SUB&department=202&from=2025-01-01&to=2025-12-31",
    },
  ]);
  // The awarded-by-school slice is an org name, resolved against the user's org units.
  const school = await get("awardedProposalsChart");
  expect(school.statistics[0].href).toBe(
    "/proposals?status=AWARD&department=204",
  );
});
it("omits a drill to a module the user cannot open", async () => {
  state.modules = { AWARDS: true };
  const school = await get("awardedProposalsChart");
  expect(school.statistics[0]).not.toHaveProperty("href");
});
it("adds the legacy axis titles and stacking to the presentation", async () => {
  const gaps = await get("highestGapsChart");
  state.modules["opportunities-finder"] = true;
  expect(gaps.error?.code).toBe("FORBIDDEN");
  const allowed = await get("highestGapsChart");
  expect(allowed.presentation).toMatchObject({
    type: "bar",
    stack: true,
    xTitle: "Grant Category",
    yTitle: "Awarded Amount",
  });
  expect(allowed.statistics.map((r: { value: number }) => r.value)).toEqual([
    4, 5,
  ]);
});
