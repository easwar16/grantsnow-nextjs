import { beforeEach, expect, it, vi } from "vitest";

const calls = vi.hoisted(() => ({ page: vi.fn(), url: vi.fn() }));
vi.mock("@/server/modules/proposals/record", () => ({
  proposalPage: calls.page,
}));
vi.mock("@/server/modules/chatbot/service", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/server/modules/chatbot/service")>();
  return { ...actual, chatbotUrl: calls.url };
});

import { proposalCostingAnalysis } from "@/server/modules/proposals/ai";

beforeEach(() => {
  vi.resetAllMocks();
  calls.url.mockReturnValue(new URL("https://analysis.example/"));
  calls.page.mockResolvedValue({
    session: { token: "server-token" },
    summary: { reference: "P_6741" },
  });
});

it("uses the VBCS POST contract and maps NDJSON chunks to a bounded report", async () => {
  const request = vi.spyOn(globalThis, "fetch").mockResolvedValue(
    new Response(
      [
        JSON.stringify({
          type: "data",
          payload: [{ YEAR: "2026", TOTAL_COST: 10 }],
        }),
        JSON.stringify({
          type: "chart",
          payload: {
            name: "Cost",
            chart: "bar,line",
            private: "do-not-send",
          },
        }),
      ].join("\n"),
      { status: 200 },
    ),
  );
  const report = await proposalCostingAnalysis("PROPOSAL", "6741", {
    query: "Annual cost",
  });
  expect(request).toHaveBeenCalledWith(
    new URL("https://analysis.example/costinganalysis"),
    expect.objectContaining({
      method: "POST",
      headers: {
        token: "server-token",
        "user-query": "Annual cost",
        "proposal-number": "P_6741",
      },
      cache: "no-store",
    }),
  );
  expect(calls.page).toHaveBeenCalledWith(
    "PROPOSAL",
    "6741",
    "proposals-fec-summary",
  );
  expect(report).toEqual({
    rows: [{ YEAR: "2026", TOTAL_COST: 10 }],
    chart: { name: "Cost", types: ["bar", "line"] },
  });
  expect(JSON.stringify(report)).not.toContain("do-not-send");
  request.mockRestore();
});

it("rejects malformed streamed data and avoids the upstream call without record access", async () => {
  const request = vi
    .spyOn(globalThis, "fetch")
    .mockResolvedValue(new Response("{not-json}", { status: 200 }));
  await expect(
    proposalCostingAnalysis("PROPOSAL", "6741", { query: "Costs" }),
  ).rejects.toThrow("invalid report");
  calls.page.mockRejectedValueOnce(new Error("Access denied"));
  await expect(
    proposalCostingAnalysis("PROPOSAL", "6741", { query: "Costs" }),
  ).rejects.toThrow("Access denied");
  expect(request).toHaveBeenCalledTimes(1);
  request.mockRestore();
});
