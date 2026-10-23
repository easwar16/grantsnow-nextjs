import { beforeEach, expect, it, vi } from "vitest";
const state = vi.hoisted(() => ({ read: vi.fn(), write: vi.fn() }));
vi.mock("@/server/oracle/connection", () => ({
  oracle: state.read,
  oracleWrite: state.write,
}));
vi.mock("@/server/oracle/context", () => ({
  oracleContext: async () => ({ token: "session-token", identity: {} }),
}));
import { home, notifications } from "@/server/oracle/api";
beforeEach(() => {
  state.read.mockReset().mockResolvedValue({ items: [] });
  state.write.mockReset().mockResolvedValue({});
});
const query = (call: unknown[]) =>
  Object.fromEntries(call[2] as URLSearchParams);
it("pages a queue with p_offset / p_limit under the widget's own org header, and no filters", async () => {
  await home.widget.getPost_awardsAwardPendingApproval({
    orgHeader: "org_id",
    orgId: "202",
    offset: 25,
    limit: 25,
  });
  const [call] = state.read.mock.calls;
  expect(call.slice(0, 2)).toEqual([
    "getPost_awardsAwardPendingApproval",
    { org_id: "202", token: "session-token" },
  ]);
  expect(query(call)).toEqual({ p_offset: "25", p_limit: "25" });
});
it("sends a chart's type and filters as headers, and leaves out the unset ones", async () => {
  await home.widget.getProposalGetProposalStatistics({
    orgHeader: "p_org_id",
    orgId: "202",
    chartType: "YEAR_STATUS",
    year: "2026",
    offset: 100,
    limit: 100,
  });
  const [call] = state.read.mock.calls;
  expect(call[1]).toEqual({
    p_org_id: "202",
    chart_type: "YEAR_STATUS",
    year: "2026",
    token: "session-token",
  });
  expect(query(call)).toEqual({ p_offset: "100", p_limit: "100" });
});
it("reads the bell's list once, and again after marking read", async () => {
  await notifications.latest();
  await notifications.latest();
  expect(state.read).toHaveBeenCalledTimes(1);
  expect(state.read.mock.calls[0][2]).toBeUndefined();
  await notifications.markRead({ ids: [7, 9] });
  expect(state.write.mock.calls[0].slice(0, 3)).toEqual([
    "postNotificationsNotifications",
    { token: "session-token" },
    {
      items: [
        { id: 7, is_read: "Y" },
        { id: 9, is_read: "Y" },
      ],
    },
  ]);
  await notifications.latest();
  expect(state.read).toHaveBeenCalledTimes(2);
});
it("pages the Notifications tab and never answers it from the bell's held list", async () => {
  await notifications.latest();
  await notifications.page({ offset: 50, limit: 25 });
  expect(state.read).toHaveBeenCalledTimes(2);
  expect(query(state.read.mock.calls[1])).toEqual({
    p_offset: "50",
    p_limit: "25",
  });
});
