import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { assertBusiness, oracle } from "@/server/oracle/connection";
import { failure } from "@/server/http/response";
import { publicError } from "@/lib/errors";
const caught = (fn: () => unknown) => {
  try {
    fn();
  } catch (e) {
    return publicError(e);
  }
  throw new Error("expected a failure");
};
describe("business envelopes", () => {
  it.each([
    { response_msg: "ERROR" },
    { response_message: "ERROR" },
    { status: "ERROR" },
    { error_msg: "Something failed" },
    { ERROR_MSG: "Something failed" },
    { items: [], error_code: 0 },
  ])("treats %j as a business failure, never data", (body) =>
    expect(caught(() => assertBusiness(body)).code).toBe("BUSINESS"),
  );
  it("passes only error_code : error_description and preventive_action through", () => {
    const error = caught(() =>
      assertBusiness({
        response_msg: "ERROR",
        error_code: "GN-101",
        error_description: "  Budget is locked.\n",
        preventive_action: "Ask the owner to unlock it.",
        sql: "select secret from dual",
      }),
    );
    expect(error).toEqual({
      code: "BUSINESS",
      message: "GN-101 : Budget is locked.",
      action: "Ask the owner to unlock it.",
      status: 502,
    });
    expect(JSON.stringify(error)).not.toContain("secret");
  });
  it("falls back to the generic message when the backend gives no text", () => {
    const error = caught(() => assertBusiness({ status: "ERROR" }));
    expect(error.message).toMatch(/Contact your administrator/);
    expect(error).not.toHaveProperty("action");
  });
  it("caps backend text", () =>
    expect(
      caught(() => assertBusiness({ error_description: "x".repeat(5000) }))
        .message.length,
    ).toBe(500));
  it.each([
    { ERROR_MSG: "Context Not Set" },
    { error_description: "Context Not Set: 7" },
    "Context Not Set: 3",
  ])("maps the dead-session reply %j to EXPIRED", (body) =>
    expect(caught(() => assertBusiness(body))).toMatchObject({
      code: "EXPIRED",
      status: 401,
    }),
  );
  it("keeps success bodies, including null error fields", () =>
    expect(
      assertBusiness({ items: [], error_code: null, response_msg: "SUCCESS" }),
    ).toEqual({ items: [], error_code: null, response_msg: "SUCCESS" }));
  it("serialises the preventive action into route failures", async () => {
    const response = failure(
      (() => {
        try {
          assertBusiness({
            error_code: "E1",
            preventive_action: "Retry later",
          });
        } catch (e) {
          return e;
        }
      })(),
    );
    expect(response.status).toBe(502);
    expect(await response.json()).toEqual({
      error: { code: "BUSINESS", message: "E1", action: "Retry later" },
    });
  });
});
describe("oracle response parsing", () => {
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
    }))
      vi.stubEnv(key, value);
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockReset();
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });
  const reply = (body: string, status = 200) =>
    fetchMock.mockResolvedValue(new Response(body, { status }));
  const connectTimeout = () =>
    Object.assign(new TypeError("fetch failed"), {
      cause: { code: "UND_ERR_CONNECT_TIMEOUT" },
    });
  it("retries a read once when its connection timed out, and goes through the Oracle pool", async () => {
    fetchMock
      .mockRejectedValueOnce(connectTimeout())
      .mockResolvedValueOnce(new Response(JSON.stringify({ items: [] })));
    await expect(oracle("getSessionValidate", { token: "t" })).resolves.toEqual(
      { items: [] },
    );
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[0][1]).toHaveProperty("dispatcher");
  });
  it("gives up after the one retry, and never retries other network failures", async () => {
    fetchMock.mockRejectedValue(connectTimeout());
    await expect(
      oracle("getSessionValidate", { token: "t" }),
    ).rejects.toMatchObject({ code: "UPSTREAM" });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    fetchMock.mockReset();
    fetchMock.mockRejectedValue(
      Object.assign(new TypeError("fetch failed"), {
        cause: { code: "ECONNRESET" },
      }),
    );
    await expect(
      oracle("getSessionValidate", { token: "t" }),
    ).rejects.toMatchObject({ code: "UPSTREAM" });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
  it("maps a plain-text Context Not Set body to EXPIRED, not CONTRACT", async () => {
    reply("Context Not Set: 4");
    await expect(
      oracle("getSessionValidate", { token: "t" }),
    ).rejects.toMatchObject({ code: "EXPIRED", status: 401 });
  });
  it("reports other unreadable bodies as a contract failure", async () => {
    reply("<html>gateway</html>");
    await expect(
      oracle("getSessionValidate", { token: "t" }),
    ).rejects.toMatchObject({ code: "CONTRACT" });
  });
  it("surfaces the backend envelope of an HTTP failure", async () => {
    reply(
      JSON.stringify({ error_code: "E9", error_description: "Bad input" }),
      400,
    );
    await expect(
      oracle("getSessionValidate", { token: "t" }),
    ).rejects.toMatchObject({ code: "BUSINESS", message: "E9 : Bad input" });
  });
  it("keeps a generic upstream failure when the HTTP error has no envelope", async () => {
    reply("Service Unavailable", 503);
    await expect(
      oracle("getSessionValidate", { token: "t" }),
    ).rejects.toMatchObject({ code: "UPSTREAM" });
  });
  it("returns parsed success bodies", async () => {
    reply(JSON.stringify({ items: [1] }));
    await expect(oracle("getSessionValidate", { token: "t" })).resolves.toEqual(
      { items: [1] },
    );
  });
});
