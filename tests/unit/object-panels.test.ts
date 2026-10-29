import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { oracle, oracleWrite } from "@/server/oracle/connection";
import { functions } from "@/lib/functions";
import { serverFunctions } from "@/server/functions";

describe("mentions", () => {
  const people = [
    { id: "1", name: "Alex Morgan", detail: "", email: "a@x.org" },
    { id: "2", name: "Sam Taylor", detail: "", email: "" },
  ];
  it("finds the @query before the caret only after a boundary", () => {
    expect(functions.mentions.mentionQuery("Hi @al")).toEqual({
      query: "al",
      length: 3,
    });
    expect(functions.mentions.mentionQuery("@")).toEqual({
      query: "",
      length: 1,
    });
    expect(functions.mentions.mentionQuery("(@Sam T")).toEqual({
      query: "Sam T",
      length: 6,
    });
    expect(functions.mentions.mentionQuery("mail me@x")).toBeNull();
    expect(functions.mentions.mentionQuery("@a\nb")).toBeNull();
  });
  it("matches names case-insensitively without changing them", () => {
    expect(
      functions.mentions.matchMentions(people, "MOR").map((p) => p.name),
    ).toEqual(["Alex Morgan"]);
    expect(functions.mentions.matchMentions(people, "")).toHaveLength(2);
  });
  it("writes legacy's anchor attributes, with mailto only for a known email", () => {
    expect(
      Object.fromEntries(functions.mentions.mentionAttributes(people[0])),
    ).toEqual({
      class: "mention oj-link-standalone oj-link-subtle-primary",
      "data-mention": "@Alex Morgan",
      "data-person-id": "1",
      "data-first-name": "Alex Morgan",
      "data-email-address": "a@x.org",
      href: "mailto:a@x.org",
      "data-mention-type": "person",
    });
    expect(
      Object.fromEntries(functions.mentions.mentionAttributes(people[1])).href,
    ).toBeUndefined();
  });
});

describe("display helpers", () => {
  it("shows a wall-clock timestamp in the configured format with hh:mm a, and anything else verbatim", () => {
    expect(
      functions.format.dateTimeDisplay("2026-10-02T14:05:00", {
        dateFormat: "dd/mm/yyyy",
      }),
    ).toBe("02/10/2026 02:05 pm");
    expect(functions.format.dateTimeDisplay("2026-10-02 00:30")).toBe(
      "02-Oct-2026 12:30 am",
    );
    expect(functions.format.dateTimeDisplay("2025-0526T13:23")).toBe(
      "2025-0526T13:23",
    );
    expect(functions.format.dateTimeDisplay("")).toBe("—");
  });
  it("reads rich text as plain text", () => {
    expect(serverFunctions.sanitize.plainText("<p>A &amp; <b>B</b></p>")).toBe(
      "A & B",
    );
    expect(serverFunctions.sanitize.plainText("<p> </p>").trim()).toBe("");
  });
});

describe("comment operations", () => {
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
      WRITES_ENABLED: "false",
    }))
      vi.stubEnv(key, value);
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockReset();
    fetchMock.mockImplementation(async () => new Response('{"items":[]}'));
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });
  const identity = { token: "t", legal_id: "7", org_id: "2", user_id: "1" };
  it("sends no comment write while live writes are off", async () => {
    for (const op of ["postProposalComments", "deleteSharedComments"] as const)
      await expect(
        oracleWrite(op, identity, { comment_id: 1 }),
      ).rejects.toMatchObject({ code: "WRITES_DISABLED" });
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it("keeps the comment and audit reads off the write path, and the writes off the read path", async () => {
    await expect(
      oracle("postProposalComments", identity),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await oracle(
      "getProposalComments",
      { token: "t" },
      new URLSearchParams({ module: "p", object_id: "1" }),
    );
    await oracle("getSharedGetObjectAudits2", {
      token: "t",
      p_obj_id: "1",
      p_obj_type: "OPPORTUNITIES-EOI",
      p_page_name: "p",
      p_event: "",
    });
    const [[comments], [audits, init]] = fetchMock.mock.calls;
    expect(String(comments)).toBe(
      "https://dev.example/ords/dev/shared/comments/?module=p&object_id=1",
    );
    expect(String(audits)).toBe(
      "https://dev.example/ords/dev/shared/getObjectAudits",
    );
    expect(init.headers).toMatchObject({ p_event: "", p_page_name: "p" });
  });
  it("sends a delete as DELETE with its JSON body when writes are on", async () => {
    vi.stubEnv("WRITES_ENABLED", "true");
    await oracleWrite("deleteSharedComments", identity, {
      comment_id: 2,
      comments: "<p>x</p>",
      module: "p",
      object_id: 1,
    });
    const [[url, init]] = fetchMock.mock.calls;
    expect(String(url)).toBe("https://dev.example/ords/dev/shared/comments/");
    expect(init.method).toBe("DELETE");
    expect(JSON.parse(init.body)).toEqual({
      comment_id: 2,
      comments: "<p>x</p>",
      module: "p",
      object_id: 1,
    });
  });
});
