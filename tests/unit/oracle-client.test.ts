import { beforeEach, expect, it, vi } from "vitest";
const state = vi.hoisted(() => ({ read: vi.fn(), write: vi.fn() }));
vi.mock("@/server/oracle/connection", () => ({
  oracle: state.read,
  oracleWrite: state.write,
}));
vi.mock("@/server/oracle/context", () => ({
  oracleContext: async () => ({
    token: "session-token",
    identity: { legal_id: "202", org_id: "13510", user_id: "5565" },
  }),
}));
import { read, write } from "@/server/oracle/client";
import { asWrite } from "@/server/oracle/scope";
import { forget } from "@/server/oracle/cache";
const thread = read<{ page: string; id: string }>({
  op: "getProposalComments",
  query: (p) => ({ module: p.page, object_id: p.id }),
  ttl: 60_000,
});
beforeEach(() => {
  forget("");
  state.read.mockReset();
  state.write.mockReset();
  state.read.mockResolvedValue({ items: [] });
  state.write.mockResolvedValue({});
});
it("sends the session token and only the identity headers the definition names", async () => {
  const add = write<{ text: string }>({
    op: "postProposalComments",
    identity: ["legal_id", "org_id", "user_id"],
    body: (p) => ({ comments: p.text }),
  });
  await add({ text: "hi" });
  expect(state.write.mock.calls[0][1]).toEqual({
    token: "session-token",
    legal_id: "202",
    org_id: "13510",
    user_id: "5565",
  });
  expect(state.write.mock.calls[0][2]).toEqual({ comments: "hi" });
  await thread({ page: "p", id: "1" });
  expect(state.read.mock.calls[0][1]).toEqual({ token: "session-token" });
});
it("answers the same parameters from the held copy and reads again when one changes", async () => {
  await thread({ page: "p", id: "1" });
  await thread({ page: "p", id: "1" });
  expect(state.read).toHaveBeenCalledTimes(1);
  await thread({ page: "p", id: "2" });
  expect(state.read).toHaveBeenCalledTimes(2);
  expect(String(state.read.mock.calls[1][2])).toBe("module=p&object_id=2");
});
it("forgets what a write changes, for the whole session", async () => {
  const add = write<void>({
    op: "postProposalComments",
    invalidates: ["getProposalComments"],
  });
  await thread({ page: "p", id: "1" });
  await add();
  await thread({ page: "p", id: "1" });
  expect(state.read).toHaveBeenCalledTimes(2);
});
it("forgets what a write changes even when it fails, as a timed-out write may have committed", async () => {
  const add = write<void>({
    op: "postProposalComments",
    invalidates: ["getProposalComments"],
  });
  await thread({ page: "p", id: "1" });
  state.write.mockRejectedValueOnce(new Error("timed out"));
  await expect(add()).rejects.toThrow("timed out");
  await thread({ page: "p", id: "1" });
  expect(state.read).toHaveBeenCalledTimes(2);
});
it("never holds a failure; a caller with a signal shares the held copy", async () => {
  state.read.mockRejectedValueOnce(new Error("down"));
  await expect(thread({ page: "p", id: "9" })).rejects.toThrow("down");
  await thread({ page: "p", id: "9" });
  await thread(
    { page: "p", id: "9" },
    { signal: new AbortController().signal },
  );
  expect(state.read).toHaveBeenCalledTimes(2);
  // The shared fetch never carries one caller's signal.
  expect(state.read.mock.calls[1][3]).toBeUndefined();
});
it("lets an aborted caller stop waiting while the shared read completes for the next one", async () => {
  let finish: (value: unknown) => void = () => {};
  state.read.mockReturnValueOnce(new Promise((r) => (finish = r)));
  const stop = new AbortController();
  const first = thread({ page: "q", id: "1" }, { signal: stop.signal });
  stop.abort(new Error("superseded"));
  await expect(first).rejects.toThrow("superseded");
  finish({ items: [] });
  await expect(thread({ page: "q", id: "1" })).resolves.toEqual({ items: [] });
  expect(state.read).toHaveBeenCalledTimes(1);
});
it("reads one listing page by offset and limit, each page held on its own", async () => {
  const list = read<{ offset?: number; limit?: number }>({
    op: "getPre_awardGetProposalsList",
    pages: "page",
    ttl: 60_000,
  });
  await list({ offset: 0, limit: 10 });
  await list({ offset: 10, limit: 10 });
  await list({ offset: 0, limit: 10 });
  expect(state.read.mock.calls.map((c) => String(c[2]))).toEqual([
    "p_offset=0&p_limit=10",
    "p_offset=10&p_limit=10",
  ]);
});
it("reads a paged reference list whole", async () => {
  state.read.mockImplementation(async (_op, _h, q: URLSearchParams) =>
    Number(q.get("p_offset")) === 0
      ? { items: [1, 2], hasMore: "true" }
      : { items: [3], hasMore: "false" },
  );
  const people = read({ op: "getPre_awardGetPersonListAll", pages: "all" });
  expect(await people()).toEqual({ items: [1, 2, 3], hasMore: "false" });
});
it("does not keep a reply that fails its schema", async () => {
  const strict = read<void, { ok: true }>({
    op: "getSharedGetObjectDates",
    ttl: 60_000,
    parse: (b) => {
      if ((b as { ok?: unknown }).ok !== true) throw new Error("bad shape");
      return b as { ok: true };
    },
  });
  state.read.mockResolvedValueOnce({ ok: false });
  await expect(strict()).rejects.toThrow("bad shape");
  state.read.mockResolvedValueOnce({ ok: true });
  await expect(strict()).resolves.toEqual({ ok: true });
  expect(state.read).toHaveBeenCalledTimes(2);
});
it("refuses a paged reference list beyond its bound instead of returning part of it", async () => {
  state.read.mockImplementation(async (_op, _h, q: URLSearchParams) => ({
    items: Array.from({ length: 500 }, (_, i) => Number(q.get("p_offset")) + i),
    hasMore: "true",
  }));
  const everyone = read({ op: "getPre_awardGetPersonListAll", pages: "all" });
  await expect(everyone()).rejects.toMatchObject({ code: "CONTRACT" });
  expect(state.read).toHaveBeenCalledTimes(20);
});
it("sends no paging to a read that does not ask for it", async () => {
  state.read.mockResolvedValue({ items: [], hasMore: "true" });
  const orgUnits = read({ op: "getPre_awardGetLkpOrgUnitType" });
  await orgUnits();
  expect(state.read.mock.calls[0][2]).toBeUndefined();
});

it("reads fresh inside a write, so a held copy never decides whether the write may go ahead", async () => {
  state.read
    .mockResolvedValueOnce({ status: "DRFT" })
    .mockResolvedValueOnce({ status: "SUBMITTED" });
  await thread({ page: "w", id: "1" });
  // A page load would get the held "DRFT"; the write's own check sees Oracle now.
  await expect(asWrite(() => thread({ page: "w", id: "1" }))).resolves.toEqual({
    status: "SUBMITTED",
  });
  // The fresh answer is held for the next reader.
  await expect(thread({ page: "w", id: "1" })).resolves.toEqual({
    status: "SUBMITTED",
  });
  expect(state.read).toHaveBeenCalledTimes(2);
});
