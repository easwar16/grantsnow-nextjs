import { expect, it, beforeEach, afterEach, vi } from "vitest";
vi.mock("@/server/configuration/environment", () => ({
  fixtureMode: () => false,
  oracleSettings: () => ({
    apps: new URL("https://oracle.example/ords/dev/"),
    authorization: "test-service-auth",
  }),
}));
import {
  chartDimensions,
  safeChartReport,
  saveChartPreference,
} from "@/server/api/chart-preferences";
beforeEach(() => vi.stubGlobal("fetch", vi.fn()));
afterEach(() => vi.unstubAllGlobals());
it("validates dimension bounds and forbids browser identities", () => {
  expect(
    chartDimensions.safeParse({ infolet_id: 201, colspan: 6, rowspan: 3 })
      .success,
  ).toBe(true);
  for (const body of [
    { infolet_id: 201, colspan: 13, rowspan: 3 },
    { infolet_id: 201, colspan: 6, rowspan: 0 },
    { infolet_id: 201, colspan: 6, rowspan: 3, username: "other" },
  ])
    expect(chartDimensions.safeParse(body).success).toBe(false);
});
it("rejects unsafe or token-bearing report URLs", () => {
  const origin = "https://oracle.example";
  expect(
    safeChartReport(
      `${origin}/ords/r/dev/preawards/report-result?p597_report_id=1210`,
      origin,
    ),
  ).toContain("report_id=1210");
  for (const url of [
    "javascript:alert(1)",
    "https://evil.example/ords/r/dev/app/report-result?p1_report_id=1",
    `${origin}/ords/r/dev/app/report-result?p1_report_id=1&token=secret`,
    `${origin}/ords/dev/session/login`,
  ])
    expect(safeChartReport(url, origin)).toBeUndefined();
});
it("uses the allowlisted POST and server token and accepts documented empty success", async () => {
  vi.mocked(fetch).mockResolvedValue(new Response(null, { status: 204 }));
  await saveChartPreference("isolated-token", {
    infolet_id: 201,
    colspan: 6,
    rowspan: 3,
  });
  const [url, request] = vi.mocked(fetch).mock.calls[0];
  expect(String(url)).toBe(
    "https://oracle.example/ords/dev/shared/saveDynamicCharts",
  );
  expect(request).toMatchObject({
    method: "POST",
    redirect: "error",
    cache: "no-store",
    headers: { token: "isolated-token" },
    body: '{"infolet_id":201,"colspan":6,"rowspan":3}',
  });
});
it("does not treat HTTP 200 business errors as saved", async () => {
  vi.mocked(fetch).mockResolvedValue(Response.json({ response_msg: "ERROR" }));
  await expect(
    saveChartPreference("isolated-token", {
      infolet_id: 201,
      colspan: 6,
      rowspan: 3,
    }),
  ).rejects.toMatchObject({ code: "BUSINESS" });
});
it("distinguishes expired and forbidden writes", async () => {
  for (const [status, code] of [
    [401, "EXPIRED"],
    [403, "FORBIDDEN"],
  ] as const) {
    vi.mocked(fetch).mockResolvedValue(new Response(null, { status }));
    await expect(
      saveChartPreference("isolated-token", {
        infolet_id: 201,
        colspan: 6,
        rowspan: 3,
      }),
    ).rejects.toMatchObject({ code });
  }
});
