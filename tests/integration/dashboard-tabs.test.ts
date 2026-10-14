import { beforeEach, expect, it, vi } from "vitest";
const state = vi.hoisted(() => ({
  oracle: vi.fn(),
  config: {
    notifications: true,
    opportunity: true,
    dynamicCharts: {
      "Proposal status": {
        infolet_id: 201,
        isVisible: true,
        ModuleName: "PROPOSAL",
      },
    },
  },
  modules: { PROPOSALS: true, "opportunities-finder": true },
}));
vi.mock("@/server/home/service", () => ({
  homeAccess: async () => ({
    session: { token: "isolated-token" },
    user: { modules: state.modules },
  }),
}));
vi.mock("@/server/configuration/service", () => ({
  dashboardConfiguration: async () => state.config,
  organizations: async () => [{ id: "202", name: "Fixture organization" }],
}));
vi.mock("@/server/configuration/resources", () => ({
  resources: async () =>
    ["notifications", "opportunities", "dynamic-charts"].map((label_name) => ({
      module_name: "DASHBOARD",
      label_type: "button-labels",
      label_name,
      is_visible: "Y",
    })),
}));
vi.mock("@/server/api/transport", () => ({ oracle: state.oracle }));
vi.mock("@/server/opportunities/service", () => ({
  listOpportunities: vi.fn(),
}));
import {
  dashboardTabs,
  dynamicChart,
  notifications,
  notificationPage,
} from "@/server/home/extra-tabs";
beforeEach(() => {
  state.oracle.mockReset();
  state.config.notifications = true;
  state.config.dynamicCharts["Proposal status"].isVisible = true;
  state.modules.PROPOSALS = true;
});
it("hides charts without their module permission", async () => {
  state.modules.PROPOSALS = false;
  expect((await dashboardTabs()).charts).toEqual([]);
});
it("denies arbitrary and disabled report IDs before Oracle calls", async () => {
  await expect(dynamicChart("999", "202")).rejects.toMatchObject({
    code: "FORBIDDEN",
  });
  state.config.dynamicCharts["Proposal status"].isVisible = false;
  await expect(dynamicChart("201", "202")).rejects.toMatchObject({
    code: "FORBIDDEN",
  });
  expect(state.oracle).not.toHaveBeenCalled();
});
it("rejects organization scope widening", async () => {
  await expect(dynamicChart("201", "999")).rejects.toMatchObject({
    code: "FORBIDDEN",
  });
  expect(state.oracle).not.toHaveBeenCalled();
});
it("passes only enabled chart ID and scoped organization", async () => {
  state.oracle.mockResolvedValue([
    {
      infolet_id: 201,
      chart: "BAR",
      name: "Proposal status",
      ModuleName: "PROPOSAL",
      grid_dimension: "6x3",
      dataProvider: [{ series: "Draft", group: "2026", value: 12 }],
    },
  ]);
  const result = await dynamicChart("201", "202");
  expect(state.oracle).toHaveBeenCalledWith(
    "getSharedGetDynamicCharts",
    { token: "isolated-token", report_name: "201", p_org_id: "202" },
    undefined,
    undefined,
  );
  expect(result[0]).toMatchObject({
    columns: 6,
    rows: 3,
    points: [{ series: "Draft", group: "2026", value: 12 }],
  });
});
it("rejects a chart returned for another report", async () => {
  state.oracle.mockResolvedValue([
    {
      infolet_id: 999,
      chart: "BAR",
      name: "Wrong chart",
      ModuleName: "PROPOSAL",
      dataProvider: [],
    },
  ]);
  await expect(dynamicChart("201", "202")).rejects.toMatchObject({
    code: "CONTRACT",
  });
});
it("denies disabled notifications and invalid offsets", async () => {
  state.config.notifications = false;
  await expect(notifications(0)).rejects.toMatchObject({ code: "FORBIDDEN" });
  state.config.notifications = true;
  await expect(notifications(-25)).rejects.toMatchObject({
    code: "BAD_REQUEST",
  });
  expect(state.oracle).not.toHaveBeenCalled();
});
it("sanitizes notification HTML and strips identity data", () => {
  const page = notificationPage(
    {
      items: [
        {
          id: 1,
          person_id: 987,
          notific_content:
            "<p>Hello<script>alert(1)</script><img src=x onerror=alert(1)></p>",
          is_read: "N",
          datetime: "2026-10-14T10:00:00",
        },
      ],
      offset: 0,
      limit: 25,
      hasMore: false,
    },
    0,
  );
  expect(page.rows[0]).toEqual({
    id: "1",
    html: "<p>Hello</p>",
    read: false,
    date: "2026-10-14T10:00:00Z",
  });
});
it("rejects incorrect notification paging", () => {
  expect(() =>
    notificationPage({ items: [], offset: 25, limit: 25, hasMore: false }, 0),
  ).toThrow();
});
