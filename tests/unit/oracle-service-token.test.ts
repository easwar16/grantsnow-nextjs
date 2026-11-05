import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { dropServiceToken, serviceToken } from "@/server/oracle/service-token";

const root = new URL("https://ords.example.test/ords/dev/");
const client = { id: "client-id", secret: "client-secret" };
const fetchMock = vi.fn();
const tokenReply = (token: string, expires = 3600) =>
  new Response(JSON.stringify({ access_token: token, expires_in: expires }), {
    status: 200,
    headers: { "content-type": "application/json" },
  });

beforeEach(() => {
  dropServiceToken(root, client);
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => vi.unstubAllGlobals());

it("fetches once for concurrent callers, with the client's Basic credentials", async () => {
  fetchMock.mockResolvedValue(tokenReply("t1"));
  const [a, b] = await Promise.all([
    serviceToken(root, client),
    serviceToken(root, client),
  ]);
  expect([a, b]).toEqual(["t1", "t1"]);
  expect(fetchMock).toHaveBeenCalledTimes(1);
  const [url, init] = fetchMock.mock.calls[0];
  expect(String(url)).toBe("https://ords.example.test/ords/dev/oauth/token");
  expect(init.body).toBe("grant_type=client_credentials");
  expect(init.headers.Authorization).toBe(
    `Basic ${Buffer.from("client-id:client-secret").toString("base64")}`,
  );
});

it("reuses the token until a minute before expiry, then fetches a new one", async () => {
  fetchMock
    .mockResolvedValueOnce(tokenReply("short", 30))
    .mockResolvedValueOnce(tokenReply("fresh"));
  expect(await serviceToken(root, client)).toBe("short");
  // 30 s is inside the one-minute margin, so it is already due.
  expect(await serviceToken(root, client)).toBe("fresh");
  expect(await serviceToken(root, client)).toBe("fresh");
  expect(fetchMock).toHaveBeenCalledTimes(2);
});

it("fetches again after a 401 drop, and does not keep a failed request", async () => {
  fetchMock
    .mockResolvedValueOnce(tokenReply("t1"))
    .mockResolvedValueOnce(new Response("no", { status: 401 }))
    .mockResolvedValueOnce(tokenReply("t2"));
  expect(await serviceToken(root, client)).toBe("t1");
  dropServiceToken(root, client);
  await expect(serviceToken(root, client)).rejects.toThrow("HTTP 401");
  expect(await serviceToken(root, client)).toBe("t2");
});
