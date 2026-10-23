import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { oracle, oracleWrite } from "@/server/api/transport";
const fetchMock = vi.fn();
const WRITES = [
  "getApproval_setupGenerate_stages",
  "postApproval_setupPost_approval",
  "postApproval_setupAdd_stage",
  "deleteApproval_setupApproval_stages",
  "postApproval_setupApproval_stages_users",
  "postApproval_setupReassign_stage",
  "deleteApproval_setupApproval_stages_users",
] as const;
beforeEach(() => {
  for (const [key, value] of Object.entries({
    NODE_ENV: "development",
    APP_ENV: "development",
    DEV_BROWSER_SESSION: "true",
    FIXTURE_MODE: "false",
    APP_ORIGIN: "http://127.0.0.1:3000",
    ORDS_BASE_URL: "https://dev.example/ords/dev_base/",
    ORDS_APPS_URL: "https://dev.example/ords/dev/",
    WRITES_ENABLED: "false",
  }))
    vi.stubEnv(key, value);
  vi.stubGlobal("fetch", fetchMock);
  fetchMock.mockReset();
  fetchMock.mockImplementation(async () => new Response("{}"));
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});
it("keeps every approval route change off the read path and sends nothing while writes are off", async () => {
  for (const op of WRITES) {
    await expect(oracle(op, { token: "t" })).rejects.toMatchObject({
      code: "BAD_REQUEST",
    });
    await expect(oracleWrite(op, { token: "t" })).rejects.toMatchObject({
      code: "WRITES_DISABLED",
    });
  }
  expect(fetchMock).not.toHaveBeenCalled();
});
it("sends each approval write with its legacy method, and generate_stages as a GET with its query", async () => {
  vi.stubEnv("WRITES_ENABLED", "true");
  await oracleWrite(
    "getApproval_setupGenerate_stages",
    { token: "t" },
    undefined,
    undefined,
    new URLSearchParams({ doc_num: "EOI_1", doc_type: "OPPORTUNITIES-EOI" }),
  );
  await oracleWrite("postApproval_setupPost_approval", { token: "t" }, {});
  await oracleWrite("deleteApproval_setupApproval_stages_users", {
    token: "t",
    p_appr: "a@example.org",
    p_stage_id: "1",
  });
  const [[url, get], [, post], [, del]] = fetchMock.mock.calls;
  expect(String(url)).toBe(
    "https://dev.example/ords/dev/approval_setup/generate_stages?doc_num=EOI_1&doc_type=OPPORTUNITIES-EOI",
  );
  expect(get.method).toBe("GET");
  expect(post.method).toBe("POST");
  expect(del.method).toBe("DELETE");
});
