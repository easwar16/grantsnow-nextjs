import { expect, it, vi } from "vitest";
vi.mock("@/server/identity/session/service", () => ({
  authenticate: async () => ({
    session: { token: "t" },
    user: {
      modules: { "opportunities-group": true, "opportunities-analytics": true },
    },
  }),
}));
vi.mock("@/server/platform/configuration/resources", () => ({
  resources: async () => [],
}));
vi.mock("@/server/oracle/api", () => ({
  opportunities: {
    statistics: async ({ chartType }: { chartType: string }) => ({
      items:
        chartType === "FUNDING_TYPE"
          ? [
              { value: 7293, RN: 1 },
              { value: 5167, label: "Others", RN: 2 },
            ]
          : [{ value: 10, label: "Funder A" }],
    }),
  },
}));
import { opportunityStatistics } from "@/server/modules/opportunities/analytics";

it("keeps DEV's unlabelled funding-type row as an unnamed slice, as legacy's pie draws it", async () => {
  await expect(opportunityStatistics("FUNDING_TYPE")).resolves.toEqual([
    { id: "FUNDING_TYPE-0", label: "", series: "", value: 7293 },
    { id: "FUNDING_TYPE-1", label: "Others", series: "Others", value: 5167 },
  ]);
  // Top Funders is one series, as legacy's series-id 'Top - Funders'.
  await expect(opportunityStatistics("TOP_FUNDERS")).resolves.toEqual([
    {
      id: "TOP_FUNDERS-0",
      label: "Funder A",
      series: "Top - Funders",
      value: 10,
    },
  ]);
});
