import { beforeEach, describe, expect, it, vi } from "vitest";
import { AppError } from "@/lib/errors";
type Rights = { read: boolean; edit: boolean; delete: boolean };
const state = vi.hoisted(() => ({
  oracle: vi.fn(),
  oracleWrite: vi.fn(),
  context: vi.fn(),
  roles: new Map<string, Rights>(),
  labels: [] as Record<string, unknown>[],
}));
vi.mock("@/server/modules/opportunities/record", () => ({
  eoiRecordContext: state.context,
}));
vi.mock("@/server/oracle/connection", () => ({
  oracle: state.oracle,
  oracleWrite: state.oracleWrite,
}));
// The client reads identity from the same session the record context gives the panels.
vi.mock("@/server/oracle/context", () => ({
  oracleContext: async () => {
    const { session, user } = await state.context();
    return {
      session,
      user,
      token: session.token,
      identity: {
        legal_id: user.legalId ?? "",
        org_id: user.organizationId,
        user_id: user.personId,
      },
    };
  },
}));
vi.mock("@/server/platform/configuration/formatting", () => ({
  displayFormat: async () => ({ dateFormat: "DD-MMM-YYYY" }),
}));
vi.mock(
  "@/server/platform/configuration/resources",
  async (importOriginal) => ({
    ...(await importOriginal<
      typeof import("@/server/platform/configuration/resources")
    >()),
    resources: async () => state.labels,
  }),
);
import { GET, POST } from "@/app/api/objects/comments/route";
import { PUT, DELETE } from "@/app/api/objects/comments/[commentId]/route";
import { GET as PEOPLE } from "@/app/api/objects/comments/people/route";
import { GET as AUDIT } from "@/app/api/objects/audit/route";

const origin = "http://127.0.0.1:3000";
// The client also passes its optional signal / query / path arguments; assertions compare the leading ones.
const lead = (mock: { mock: { calls: unknown[][] } }, n = 3) =>
  mock.mock.calls.map((c) => c.slice(0, n));
const PAGE = "opportunities-eoi-application";
const record = `type=OPPORTUNITIES-EOI&id=12&page=${PAGE}`;
const url = (path: string, query = record) =>
  `${origin}/api/objects/${path}?${query}`;
const json = (method: string, body: unknown, from = origin) => ({
  method,
  headers: { "content-type": "application/json", origin: from },
  body: JSON.stringify(body),
});
const params = (commentId: string) => ({
  params: Promise.resolve({ commentId }),
});
const grant = (rights: Partial<Rights>) =>
  state.roles.set(PAGE, { read: false, edit: false, delete: false, ...rights });
const thread = {
  items: [
    {
      comment_id: 1,
      comments: "<p>Hi<script>bad()</script></p>",
      created_by: 102,
      creation_date: "2026-10-01T09:30:00",
      full_name: "Sam Taylor",
      module: PAGE,
    },
    {
      comment_id: 2,
      comments: "<p>Mine</p>",
      created_by: "101",
      creation_date: "2026-10-02T14:05:00",
      full_name: "Alex Morgan",
      module: PAGE,
    },
  ],
};
const headers = {
  legal_id: "77",
  org_id: "202",
  token: "server-token",
  user_id: "101",
};
beforeEach(() => {
  vi.stubEnv("APP_ORIGIN", origin);
  state.oracle.mockReset().mockResolvedValue(thread);
  state.oracleWrite.mockReset().mockResolvedValue({});
  state.roles = new Map();
  state.labels = [];
  state.context.mockReset().mockImplementation(async () => ({
    session: { token: "server-token" },
    user: { personId: "101", organizationId: "202", legalId: "77" },
    access: { roles: state.roles, pages: [] },
  }));
});

describe("comment access", () => {
  it("fails closed: no read on the page, an unknown page or type, and no Oracle call", async () => {
    expect((await GET(new Request(url("comments")))).status).toBe(403);
    grant({ read: true });
    for (const query of [
      "type=OPPORTUNITIES-EOI&id=12&page=proposals-summary",
      `type=PROPOSAL&id=12&page=${PAGE}`,
      `type=OPPORTUNITIES-EOI&id=0&page=${PAGE}`,
      "type=OPPORTUNITIES-EOI&id=12",
    ])
      expect((await GET(new Request(url("comments", query)))).status).toBe(400);
    expect(state.oracle).not.toHaveBeenCalled();
  });
  it("reads the page's thread and marks only the user's own as changeable when they may edit", async () => {
    grant({ read: true });
    const read = await (await GET(new Request(url("comments")))).json();
    expect(lead(state.oracle)).toContainEqual([
      "getProposalComments",
      { token: "server-token" },
      new URLSearchParams({ module: PAGE, object_id: "12" }),
    ]);
    expect(read.canComment).toBe(false);
    expect(read.items.map((c: { canChange: boolean }) => c.canChange)).toEqual([
      false,
      false,
    ]);
    grant({ read: true, edit: true });
    const view = await (await GET(new Request(url("comments")))).json();
    expect(view.items).toMatchObject([
      { id: 1, own: false, canChange: false, author: "Sam Taylor" },
      {
        id: 2,
        own: true,
        canChange: true,
        at: "02-Oct-2026 02:05 pm",
        html: "<p>Mine</p>",
      },
    ]);
    expect(view.items[0].html).not.toMatch(/script/);
    expect(view.maxLength).toBe(2500);
    expect(view.labels.noData).toBe("No comments yet");
  });
  it("takes the host bundle's labels, limit and warning", async () => {
    grant({ read: true, edit: true });
    state.labels = [
      {
        module_name: "OPPORTUNITIES-EOI",
        label_type: "button-labels",
        label_name: "eoi-comment-save",
        label_value: "Post",
      },
      {
        module_name: "OPPORTUNITIES-EOI",
        label_type: "labels",
        label_name: "comments-input",
        preferences: '{"maxLength": 40}',
      },
      {
        module_name: "OPPORTUNITIES-EOI",
        label_type: "warning-messages",
        label_name: "dynamic-less-than",
        label_value: "Under {num}!",
      },
    ];
    const view = await (await GET(new Request(url("comments")))).json();
    expect(view).toMatchObject({
      maxLength: 40,
      warning: "Under 40!",
      labels: { send: "Post" },
    });
  });
});

describe("comment writes", () => {
  it("adds with the session's identity headers and the exact legacy body", async () => {
    grant({ read: true, edit: true });
    const res = await POST(
      new Request(url("comments"), json("POST", { comments: "<p>New</p>" })),
    );
    expect(res.status).toBe(200);
    expect(lead(state.oracleWrite)).toContainEqual([
      "postProposalComments",
      headers,
      { module: PAGE, comments: "<p>New</p>", object_id: 12 },
    ]);
  });
  it("refuses without edit, from a foreign origin, with smuggled fields, empty or over the limit", async () => {
    grant({ read: true });
    const body = { comments: "<p>New</p>" };
    expect(
      (await POST(new Request(url("comments"), json("POST", body)))).status,
    ).toBe(403);
    grant({ read: true, edit: true });
    expect(
      (
        await POST(
          new Request(
            url("comments"),
            json("POST", body, "https://evil.example"),
          ),
        )
      ).status,
    ).toBe(403);
    for (const bad of [
      { ...body, object_id: 99 },
      { comments: "<p> </p>" },
      { comments: `<p>${"x".repeat(2500)}</p>` },
    ])
      expect(
        (await POST(new Request(url("comments"), json("POST", bad)))).status,
      ).toBe(400);
    expect(state.oracleWrite).not.toHaveBeenCalled();
  });
  it("passes the write gate's refusal through", async () => {
    grant({ read: true, edit: true });
    state.oracleWrite.mockRejectedValueOnce(
      new AppError("WRITES_DISABLED", "Saving isn't enabled.", 409),
    );
    const res = await POST(
      new Request(url("comments"), json("POST", { comments: "<p>x</p>" })),
    );
    expect(res.status).toBe(409);
    expect((await res.json()).error.code).toBe("WRITES_DISABLED");
  });
  it("edits and deletes only the user's own comment, with the row's thread key", async () => {
    grant({ read: true, edit: true });
    const edit = (id: string) =>
      PUT(
        new Request(
          url(`comments/${id}`),
          json("PUT", { comments: "<p>B</p>" }),
        ),
        params(id),
      );
    expect((await edit("1")).status).toBe(403);
    expect((await edit("9")).status).toBe(404);
    expect((await edit("abc")).status).toBe(400);
    expect(state.oracleWrite).not.toHaveBeenCalled();
    expect((await edit("2")).status).toBe(200);
    expect(lead(state.oracleWrite).at(-1)).toEqual([
      "postProposalComments",
      headers,
      { comment_id: 2, comments: "<p>B</p>", module: PAGE, object_id: 12 },
    ]);
    const remove = (id: string) =>
      DELETE(
        new Request(url(`comments/${id}`), {
          method: "DELETE",
          headers: { origin },
        }),
        params(id),
      );
    expect((await remove("1")).status).toBe(403);
    expect((await remove("2")).status).toBe(200);
    expect(lead(state.oracleWrite).at(-1)).toEqual([
      "deleteSharedComments",
      headers,
      { comment_id: 2, comments: "<p>Mine</p>", module: PAGE, object_id: 12 },
    ]);
    grant({ read: true });
    expect((await remove("2")).status).toBe(403);
    expect(state.oracleWrite).toHaveBeenCalledTimes(2);
  });
  it("serves the mention feed only to a user who may comment", async () => {
    grant({ read: true });
    expect((await PEOPLE(new Request(url("comments/people")))).status).toBe(
      403,
    );
    grant({ read: true, edit: true });
    state.oracle.mockResolvedValue({
      items: [
        {
          person_id: 913,
          full_name: "Marg Grasmick",
          org_unit_name: "Physics",
          email_address: "m@example.ac.uk",
          employee_number: "21",
        },
      ],
    });
    expect(
      await (await PEOPLE(new Request(url("comments/people")))).json(),
    ).toEqual([
      {
        id: "913",
        name: "Marg Grasmick",
        detail: "Physics",
        email: "m@example.ac.uk",
      },
    ]);
    // Read whole: the person list pages itself (25 rows by default).
    expect(lead(state.oracle, 2)).toContainEqual([
      "getPre_awardGetPersonListAll",
      { token: "server-token" },
    ]);
  });
});

describe("audit trail", () => {
  const trail = {
    items: [
      {
        event: "UPDATED",
        name: "Alex Morgan",
        date_time: "2026-10-02T14:10",
        field_values: [
          { field_name: "Title", field_value: "New", old_value: "Old" },
        ],
      },
      { event: "UPDATED", name: "Alex Morgan", date_time: "2026-10-02T14:10" },
    ],
  };
  it("needs read on the page and a known event", async () => {
    expect((await AUDIT(new Request(url("audit")))).status).toBe(403);
    grant({ read: true });
    expect(
      (await AUDIT(new Request(url("audit", `${record}&event=MOVED`)))).status,
    ).toBe(400);
    expect(state.oracle).not.toHaveBeenCalled();
  });
  it("sends the page's headers, ALL as an empty p_event, and keys repeats apart", async () => {
    grant({ read: true });
    state.oracle.mockResolvedValue(trail);
    const all = await (await AUDIT(new Request(url("audit")))).json();
    expect(lead(state.oracle, 2).at(-1)).toEqual([
      "getSharedGetObjectAudits2",
      {
        token: "server-token",
        p_obj_id: "12",
        p_obj_type: "OPPORTUNITIES-EOI",
        p_page_name: PAGE,
        p_event: "",
      },
    ]);
    expect(all.items.map((a: { key: string }) => a.key)).toEqual([
      "2026-10-02-t14-10-updated",
      "2026-10-02-t14-10-updated-2",
    ]);
    expect(all.items[0]).toMatchObject({
      at: "02-Oct-2026 02:10 pm",
      fields: [{ name: "Title", value: "New", old: "Old" }],
    });
    expect(all.items[1].fields).toEqual([]);
    await AUDIT(new Request(url("audit", `${record}&event=DELETED`)));
    expect(state.oracle.mock.lastCall?.[1].p_event).toBe("DELETED");
  });
});
