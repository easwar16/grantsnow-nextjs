import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AppError } from "@/lib/errors";
const state = vi.hoisted(() => ({
  authenticate: vi.fn(),
  oracle: vi.fn(),
  fetch: vi.fn(),
}));
vi.mock("@/server/session/service", () => ({
  authenticate: state.authenticate,
}));
vi.mock("@/server/api/transport", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  oracle: state.oracle,
}));
import { POST } from "@/app/api/chatbot/route";
import { chatbotEnabled, toAnswer } from "@/server/chatbot/service";
const origin = "http://127.0.0.1:3000";
const flag = (value: string) => ({
  items: [{ var_key: "CHATBOT_ENABLED", var_value: value }],
});
function post(body: unknown, headers: Record<string, string> = { origin }) {
  return POST(
    new Request(`${origin}/api/chatbot`, {
      method: "POST",
      headers: { "content-type": "application/json", ...headers },
      body: typeof body === "string" ? body : JSON.stringify(body),
    }),
  );
}
beforeEach(() => {
  vi.stubEnv("APP_ORIGIN", origin);
  vi.stubEnv("CHATBOT_URL", "http://chatbot.test:8000");
  vi.stubGlobal("fetch", state.fetch);
  state.authenticate.mockReset().mockResolvedValue({
    session: { token: "server-token" },
    user: {},
  });
  state.oracle.mockReset().mockResolvedValue(flag("Y"));
  state.fetch
    .mockReset()
    .mockResolvedValue(Response.json({ response: "<p>Hi</p>" }));
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});
describe("POST /api/chatbot", () => {
  it("asks /query/ with the server session token and the question header, no Origin", async () => {
    const response = await post({ question: "  How many\nproposals?  " });
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(await response.json()).toEqual({ html: "<p>Hi</p>", options: [] });
    const [url, init] = state.fetch.mock.calls[0];
    expect(String(url)).toBe("http://chatbot.test:8000/query/");
    expect(init).toMatchObject({
      method: "POST",
      headers: { token: "server-token", "user-query": "How many proposals?" },
      cache: "no-store",
      redirect: "error",
    });
    expect(init.signal).toBeInstanceOf(AbortSignal);
    expect(Object.keys(init.headers)).not.toContain("origin");
  });
  it("refuses a missing or foreign Origin before anything else", async () => {
    for (const headers of [{}, { origin: "https://evil.example" }] as Record<
      string,
      string
    >[]) {
      const response = await post({ question: "hi" }, headers);
      expect(response.status).toBe(403);
    }
    expect(state.authenticate).not.toHaveBeenCalled();
    expect(state.fetch).not.toHaveBeenCalled();
  });
  it("requires an authenticated session", async () => {
    state.authenticate.mockRejectedValue(
      new AppError("UNAUTHENTICATED", "Sign in to GrantsNow.", 401),
    );
    const response = await post({ question: "hi" });
    expect(response.status).toBe(401);
    expect(state.fetch).not.toHaveBeenCalled();
  });
  it("is disabled when CHATBOT_URL is unset or CHATBOT_ENABLED is not Y", async () => {
    vi.stubEnv("CHATBOT_URL", "");
    expect((await post({ question: "hi" })).status).toBe(403);
    expect(await chatbotEnabled()).toBe(false);
    vi.stubEnv("CHATBOT_URL", "http://chatbot.test:8000");
    state.oracle.mockResolvedValue(flag("N"));
    expect((await post({ question: "hi" })).status).toBe(403);
    state.oracle.mockResolvedValue({ items: [] });
    expect(await chatbotEnabled()).toBe(false);
    expect(state.fetch).not.toHaveBeenCalled();
  });
  it("sanitizes the answer and lifts legacy quick-reply buttons out of it", async () => {
    state.fetch.mockResolvedValue(
      Response.json({
        response:
          '<table><tr><td onclick="x()">1</td></tr></table><img src=x onerror="alert(1)"><script>alert(2)</script><button>Show more</button>',
      }),
    );
    const body = await (await post({ question: "table" })).json();
    expect(body.options).toEqual(["Show more"]);
    expect(body.html).toContain("<table>");
    expect(body.html).not.toMatch(/onclick|onerror|script|button|Show more/);
    expect(Object.keys(body)).toEqual(["html", "options"]);
  });
  it("rejects invalid questions without calling the chatbot", async () => {
    for (const bad of [
      { question: "   " },
      { question: "x".repeat(2001) },
      { question: "emoji \u{1F600}" },
      { question: "hi", extra: 1 },
      "not json",
    ])
      expect((await post(bad)).status).toBe(400);
    expect(state.fetch).not.toHaveBeenCalled();
  });
  it("maps upstream failures to a safe error without the raw body", async () => {
    state.fetch.mockResolvedValueOnce(
      new Response("Traceback secret-stack", { status: 500 }),
    );
    let response = await post({ question: "hi" });
    expect(response.status).toBe(502);
    expect(JSON.stringify(await response.json())).not.toContain("secret");
    state.fetch.mockRejectedValueOnce(new TypeError("redirect"));
    response = await post({ question: "hi" });
    expect((await response.json()).error.code).toBe("UPSTREAM");
    state.fetch.mockResolvedValueOnce(Response.json({ answer: "wrong" }));
    response = await post({ question: "hi" });
    expect((await response.json()).error.code).toBe("CONTRACT");
  });
});
describe("toAnswer", () => {
  it("returns no options when there are no buttons", () => {
    expect(toAnswer("<p>a</p>")).toEqual({ html: "<p>a</p>", options: [] });
  });
});
