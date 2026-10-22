import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { oracle, oracleWrite } from "@/server/api/transport";
const fetchMock = vi.fn();
beforeEach(() => {
  for (const [key, value] of Object.entries({
    NODE_ENV: "development",
    APP_ENV: "development",
    DEV_BROWSER_SESSION: "true",
    FIXTURE_MODE: "false",
    APP_ORIGIN: "http://127.0.0.1:3000",
    ORDS_BASE_URL: "https://dev.example/ords/dev_base/",
    ORDS_APPS_URL: "https://dev.example/ords/dev/",
    WRITES_ENABLED: "true",
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
it("keeps reads and writes on separate paths", async () => {
  await expect(
    oracle("postSharedBookmarkOpp", { token: "t", p_opp_id: "1" }),
  ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  // insertRequest is a GET that inserts, so it counts as a write.
  await expect(
    oracle("getDynamicFormsInsertRequest", { token: "t" }),
  ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  await expect(
    oracleWrite("getSharedAnnouncements", { token: "t" }),
  ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  expect(fetchMock).not.toHaveBeenCalled();
});
it("sends nothing while live writes are off (D27)", async () => {
  vi.stubEnv("WRITES_ENABLED", "false");
  await expect(
    oracleWrite(
      "postNotificationsNotifications",
      { token: "t" },
      {
        items: [],
      },
    ),
  ).rejects.toMatchObject({ code: "WRITES_DISABLED" });
  expect(fetchMock).not.toHaveBeenCalled();
});
it("sends the allowlisted method, JSON body and headers, and accepts an empty success body", async () => {
  fetchMock.mockImplementation(async () => new Response("", { status: 200 }));
  await expect(
    oracleWrite("deleteSharedBookmarkOpp", { token: "t", p_opp_id: "42" }),
  ).resolves.toEqual({});
  await oracleWrite(
    "postNotificationsNotifications",
    { token: "t" },
    { items: [{ id: 1, is_read: "Y" }] },
  );
  const [[, del], [url, post]] = fetchMock.mock.calls;
  expect(del).toMatchObject({ method: "DELETE", redirect: "error" });
  expect(String(url)).toBe(
    "https://dev.example/ords/dev/notifications/notifications/",
  );
  expect(post).toMatchObject({
    method: "POST",
    body: '{"items":[{"id":1,"is_read":"Y"}]}',
    headers: { token: "t", "Content-Type": "application/json" },
  });
});
it("refuses headers the write is not allowlisted for", async () => {
  await expect(
    oracleWrite("postSharedOppAddlDetails", { token: "t", person_id: "9" }),
  ).rejects.toMatchObject({ code: "BAD_REQUEST" });
});
it("surfaces a business error reply to a write", async () => {
  fetchMock.mockResolvedValue(
    Response.json({
      response_msg: "ERROR",
      error_code: "GN-7",
      error_description: "Not allowed",
    }),
  );
  await expect(
    oracleWrite("postSharedOppAddlDetails", { token: "t" }, { notes: "x" }),
  ).rejects.toMatchObject({ code: "BUSINESS", message: "GN-7 : Not allowed" });
});
