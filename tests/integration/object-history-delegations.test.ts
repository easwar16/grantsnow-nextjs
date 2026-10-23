import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AppError } from "@/lib/errors";
const state = vi.hoisted(() => ({
  calls: vi.fn(),
  writes: vi.fn(),
  labels: [] as Record<string, unknown>[],
  roles: [] as Record<string, unknown>[],
  status: "DRFT",
}));
vi.mock("@/server/identity/session/service", () => ({
  authenticate: async () => ({
    session: { token: "server-token" },
    user: {
      personId: "101",
      organizationId: "202",
      legalId: "77",
      modules: { "opportunities-group": true },
    },
  }),
}));
vi.mock("@/server/oracle/connection", () => ({
  oracle: state.calls,
  oracleWrite: state.writes,
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
vi.mock(
  "@/server/platform/configuration/formatting",
  async (importOriginal) => ({
    ...(await importOriginal<
      typeof import("@/server/platform/configuration/formatting")
    >()),
    displayFormat: async () => undefined,
  }),
);
import {
  historyView,
  insertStatus,
  nextStatuses,
} from "@/server/record/objects/history";
import {
  delegationPeople,
  delegationView,
  removeDelegation,
  setDelegationAccess,
  submitDelegation,
} from "@/server/record/objects/delegations";
import {
  eoiDelegationHost,
  eoiHistoryHost,
} from "@/server/modules/opportunities/eoi-record/objects";
import { POST as historyPost } from "@/app/api/objects/history/route";
import { POST as delegationPost } from "@/app/api/objects/delegations/route";
const origin = "http://127.0.0.1:3000";
// The client also passes its optional signal / query / path arguments; assertions compare the leading ones.
const lead = (mock: { mock: { calls: unknown[][] } }, n = 3) =>
  mock.mock.calls.map((c) => c.slice(0, n));
const page = (name: string, id: number, more: Record<string, string> = {}) => ({
  page_id: id,
  page_name: `opportunities-eoi-${name}`,
  component_type: "PAGE",
  read_access: "Y",
  ...more,
});
const editable = { edit_access: "Y", delete_access: "Y" };
/** Every gate open: the tabs, the history button keys and delegation edit/delete. */
const allRoles = () => [
  page("summary", 1),
  page("history", 2),
  page("delegation", 3, editable),
  page("history-add-status", 20, {
    component_type: "BUTTON",
    edit_access: "Y",
  }),
  page("history-abandon-button", 21, {
    component_type: "BUTTON",
    edit_access: "Y",
  }),
];
const visible = (label_type: string, label_name: string) => ({
  module_name: "OPPORTUNITIES-EOI",
  label_type,
  label_name,
  label_value: label_name,
  is_visible: "Y",
});
const allLabels = () => [
  visible("button-labels", "history-add-status"),
  visible("button-labels", "history-abandon"),
  visible("labels", "actual-submision-date"),
  visible("button-labels", "delegation-edit-access"),
  visible("button-labels", "delegation-delete"),
];
const delegations = (object_id: string) => ({
  items: [
    {
      id: 501,
      pid: 102,
      object_id: Number(object_id),
      page_id: 1,
      page_name: "opportunities-eoi-summary",
      page_desc: "Summary",
      component_type: "PAGE",
      read_access: "Y",
      edit_access: "N",
      delete_access: "N",
      start_date: "2026-10-01T00:00:00Z",
      end_date: null,
    },
    {
      id: 502,
      pid: 102,
      object_id: Number(object_id),
      page_id: 2,
      page_name: "opportunities-eoi-history",
      page_desc: "<b>History</b>",
      component_type: "PAGE",
      read_access: "Y",
      edit_access: "Y",
      delete_access: "N",
      start_date: "2026-10-01T00:00:00Z",
      end_date: null,
    },
  ],
});
function reads(over: Record<string, unknown> = {}) {
  return async (op: string, headers: Record<string, string> = {}) => {
    if (op in over) {
      const v = over[op];
      if (v instanceof Error) throw v;
      return typeof v === "function" ? v(headers) : v;
    }
    if (op === "getSecurityUser_roles") return { items: state.roles };
    if (op === "getDynamicFormsGetRequestDetails")
      return {
        items: [
          {
            request_id: Number(headers.request_id),
            request_number: "EOI_12",
            request_type: "OPPORTUNITIES-EOI",
            status_code: state.status,
            ref_object_type: "OPPORTUNITIES",
            ref_object_id: 7,
          },
        ],
      };
    if (op === "getSharedObjectStatus")
      return {
        items: [
          {
            object_status_lkp_code: "DRFT",
            object_status: "Draft",
            status_process_mode_lkp_code: "AUTO",
            status_process_mode: "Auto",
            comments: "Created",
            created_by: 101,
            created_by_name: "Alex Morgan",
            creation_date: "2026-10-01T09:30:00",
          },
        ],
      };
    if (op === "getSharedGetNextObjectStatus")
      return { items: [{ STATUS: "Awaiting", STATUS_CODE: "AIA" }] };
    if (op === "getProposalDelegationsProposal_id")
      return delegations(headers.object_id);
    if (op === "getPre_awardGetPersonList")
      return {
        items: [
          { person_id: 102, full_name: "Sam Taylor", org_unit_name: "Science" },
          { person_id: 103, full_name: "Jo Lee" },
        ],
      };
    if (op === "getPre_awardGetPersonListAll")
      return { items: [{ person_id: 102, full_name: "Sam Taylor" }] };
    return { items: [] };
  };
}
// The record context is cached per request; each test takes its own record id.
let seq = 700;
const next = () => String(++seq);
beforeEach(() => {
  vi.stubEnv("APP_ORIGIN", origin);
  state.calls.mockReset();
  state.writes.mockReset();
  state.writes.mockResolvedValue({});
  state.calls.mockImplementation(reads());
  state.labels = allLabels();
  state.roles = allRoles();
  state.status = "DRFT";
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});
const post = (
  handler: (r: Request) => Promise<Response>,
  path: string,
  query: string,
  body: unknown,
  from = origin,
) =>
  handler(
    new Request(`${origin}/api/objects/${path}?${query}`, {
      method: "POST",
      headers: { "content-type": "application/json", origin: from },
      body: JSON.stringify(body),
    }),
  );
describe("object history", () => {
  it("shows the history with both actions only when the bundle and the button key allow them", async () => {
    const view = await historyView(await eoiHistoryHost(next()));
    expect(view.rows).toEqual([
      expect.objectContaining({
        status: "Draft",
        mode: "Auto",
        comments: "Created",
        user: "Alex Morgan",
      }),
    ]);
    expect(view.gates).toEqual({
      addStatus: true,
      abandon: true,
      abandoned: false,
      responseDate: true,
    });
    expect(view.texts.addStatus).toBe("history-add-status");
  });
  it("fails closed without the RB row or without edit on the button key", async () => {
    state.labels = [];
    const unlabelled = await historyView(await eoiHistoryHost(next()));
    expect(unlabelled.gates).toMatchObject({
      addStatus: false,
      abandon: false,
    });
    // Fallback labels still render.
    expect(unlabelled.texts.title).toBe("Status History");
    state.labels = allLabels();
    state.roles = allRoles().slice(0, 3);
    const host = await eoiHistoryHost(next());
    expect((await historyView(host)).gates).toMatchObject({
      addStatus: false,
      abandon: false,
    });
    await expect(nextStatuses(host)).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    await expect(
      insertStatus(host, { status: "ABANDON", comments: "Stop" }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(state.writes).not.toHaveBeenCalled();
  });
  it("inserts an offered status with the actor and scope from the session", async () => {
    const id = next();
    await insertStatus(await eoiHistoryHost(id), {
      status: "AIA",
      comments: "Ready",
      // Not AWARD/DEC: a response date is never sent.
      responseDate: "2026-10-20",
    });
    expect(lead(state.calls, 2)).toContainEqual([
      "getSharedGetNextObjectStatus",
      {
        token: "server-token",
        p_object_id: id,
        p_object_type: "OPPORTUNITIES-EOI",
      },
    ]);
    expect(lead(state.writes)).toContainEqual([
      "postSharedObjectStatus",
      { token: "server-token", legal_id: "77", org_id: "202", user_id: "101" },
      {
        p_process_mode: "MANUAL",
        p_comments: "Ready",
        p_obj_id: Number(id),
        p_obj_type: "OPPORTUNITIES-EOI",
        p_status: "AIA",
      },
    ]);
  });
  it("sends the response date only for AWARD / DEC where its field shows", async () => {
    state.calls.mockImplementation(
      reads({
        getSharedGetNextObjectStatus: {
          items: [{ STATUS: "Awarded", STATUS_CODE: "AWARD" }],
        },
      }),
    );
    await insertStatus(await eoiHistoryHost(next()), {
      status: "AWARD",
      comments: "Won",
      responseDate: "2026-10-20",
    });
    expect(state.writes.mock.calls[0][2]).toMatchObject({
      p_status: "AWARD",
      actual_response_date: "2026-10-20",
    });
  });
  it("refuses a status the server does not offer, identity in the body and any change once abandoned", async () => {
    const host = await eoiHistoryHost(next());
    await expect(
      insertStatus(host, { status: "IA", comments: "Skip ahead" }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await expect(
      insertStatus(host, { status: "AIA", comments: "x", user_id: "1" }),
    ).rejects.toThrow();
    await expect(
      insertStatus(host, { status: "AIA", comments: "  " }),
    ).rejects.toThrow();
    state.status = "ABANDON";
    const abandoned = await eoiHistoryHost(next());
    await expect(
      insertStatus(abandoned, { status: "ABANDON", comments: "Again" }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(state.writes).not.toHaveBeenCalled();
  });
  it("abandons through the same insert without asking for next statuses", async () => {
    await insertStatus(await eoiHistoryHost(next()), {
      status: "ABANDON",
      comments: "Withdrawn",
    });
    expect(state.calls).not.toHaveBeenCalledWith(
      "getSharedGetNextObjectStatus",
      expect.anything(),
    );
    expect(state.writes.mock.calls[0][2]).toMatchObject({
      p_status: "ABANDON",
    });
  });
  it("route: refuses a foreign origin or unknown host, and reports writes switched off", async () => {
    const id = next();
    const body = { status: "ABANDON", comments: "Stop" };
    expect(
      (
        await post(
          historyPost,
          "history",
          `host=eoi&record=${id}`,
          body,
          "https://evil.example",
        )
      ).status,
    ).toBe(403);
    expect(
      (await post(historyPost, "history", `host=proposal&record=${id}`, body))
        .status,
    ).toBe(400);
    expect(state.writes).not.toHaveBeenCalled();
    state.writes.mockRejectedValueOnce(
      new AppError("WRITES_DISABLED", "Saving isn't enabled.", 409),
    );
    const off = await post(
      historyPost,
      "history",
      `host=eoi&record=${id}`,
      body,
    );
    expect(off.status).toBe(409);
    expect((await off.json()).error.code).toBe("WRITES_DISABLED");
  });
});
describe("object delegations", () => {
  it("groups each delegate's pages, locks the default page and offers only readable pages once", async () => {
    state.roles = [...allRoles(), page("history", 2)];
    const view = await delegationView(await eoiDelegationHost(next()));
    expect(view.delegates).toHaveLength(1);
    const [d] = view.delegates;
    expect(d).toMatchObject({
      personId: "102",
      name: "Sam Taylor",
      start: "2026-10-01",
      end: "",
    });
    expect(d.groups[0].pages.map((p) => [p.label, p.locked])).toEqual([
      ["Summary", true],
      ["History", false],
    ]);
    const pages = view.catalogue.flatMap((g) => g.pages.map((p) => p.name));
    expect(pages.filter((p) => p === "opportunities-eoi-history")).toHaveLength(
      1,
    );
    expect(view.gates).toMatchObject({
      edit: true,
      delete: true,
      editAccess: true,
      deleteDelegate: true,
      from: false,
      to: false,
    });
  });
  it("submits the exact payload: ladder applied, default page with read, actor scope from the session", async () => {
    const id = next();
    await submitDelegation(await eoiDelegationHost(id), {
      users: ["103"],
      start: "2026-11-01",
      end: "",
      pages: ["opportunities-eoi-history"],
      read: false,
      edit: false,
      delete: true,
    });
    expect(lead(state.writes)).toContainEqual([
      "postProposalDelegations",
      { token: "server-token", legal_id: "77", org_id: "202" },
      {
        object_id: Number(id),
        object_type: "OPPORTUNITIES-EOI",
        start_date: "2026-11-01",
        end_date: null,
        users: [103],
        access: [
          {
            page: "opportunities-eoi-history",
            read: "true",
            edit: "true",
            delete: "true",
          },
          {
            page: "opportunities-eoi-summary",
            read: "true",
            edit: "true",
            delete: "true",
          },
        ],
      },
    ]);
  });
  it("refuses people, pages and dates the record does not offer", async () => {
    const host = await eoiDelegationHost(next());
    const base = {
      users: ["103"],
      start: "",
      end: "",
      pages: [],
      read: true,
      edit: false,
      delete: false,
    };
    await expect(
      submitDelegation(host, { ...base, users: ["999"] }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await expect(
      submitDelegation(host, { ...base, pages: ["proposals-summary"] }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await expect(
      submitDelegation(host, {
        ...base,
        start: "2026-11-02",
        end: "2026-11-01",
      }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await expect(
      submitDelegation(host, { ...base, person_id: "101" }),
    ).rejects.toThrow();
    expect(state.writes).not.toHaveBeenCalled();
  });
  it("switches one page with the ladder, by the row's own id in the path", async () => {
    const host = await eoiDelegationHost(next());
    expect(
      await setDelegationAccess(host, "502", { type: "read", value: false }),
    ).toEqual({ read: false, edit: false, delete: false });
    expect(state.writes).toHaveBeenCalledWith(
      "postProposalDelegationsDelegation_id",
      { token: "server-token", legal_id: "77", org_id: "202" },
      { delete: false, edit: false, read: false },
      undefined,
      undefined,
      { delegation_id: "502" },
    );
    await expect(
      setDelegationAccess(host, "501", { type: "read", value: false }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await expect(
      setDelegationAccess(host, "999", { type: "edit", value: true }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(state.writes).toHaveBeenCalledTimes(1);
  });
  it("removes a page or a whole delegate on this record only", async () => {
    const id = next();
    const host = await eoiDelegationHost(id);
    await removeDelegation(host, { id: "502" });
    expect(lead(state.writes, 2).at(-1)).toEqual([
      "deleteProposalDelegations",
      {
        token: "server-token",
        object_id: id,
        object_type: "OPPORTUNITIES-EOI",
        person_id: "102",
        delegation_id: "502",
      },
    ]);
    await removeDelegation(host, { person: "102" });
    expect(lead(state.writes, 2).at(-1)).toEqual([
      "deleteProposalDelegations",
      {
        token: "server-token",
        object_id: id,
        object_type: "OPPORTUNITIES-EOI",
        person_id: "102",
      },
    ]);
    await expect(removeDelegation(host, { id: "501" })).rejects.toMatchObject({
      code: "BAD_REQUEST",
    });
    await expect(
      removeDelegation(host, { person: "103" }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(state.writes).toHaveBeenCalledTimes(2);
  });
  it("fails closed without edit or delete on the delegation page", async () => {
    state.roles = [page("summary", 1), page("delegation", 3)];
    const host = await eoiDelegationHost(next());
    expect((await delegationView(host)).gates).toMatchObject({
      edit: false,
      delete: false,
    });
    await expect(delegationPeople(host)).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    await expect(
      setDelegationAccess(host, "502", { type: "edit", value: true }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(removeDelegation(host, { id: "502" })).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    // Removing a whole delegate also needs its RB button row.
    state.roles = allRoles();
    state.labels = [];
    await expect(
      removeDelegation(await eoiDelegationHost(next()), { person: "102" }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(state.writes).not.toHaveBeenCalled();
  });
  it("route: reports writes switched off", async () => {
    state.writes.mockRejectedValueOnce(
      new AppError("WRITES_DISABLED", "Saving isn't enabled.", 409),
    );
    const off = await post(
      delegationPost,
      "delegations",
      `host=eoi&record=${next()}`,
      {
        users: ["103"],
        start: "",
        end: "",
        pages: [],
        read: true,
        edit: false,
        delete: false,
      },
    );
    expect(off.status).toBe(409);
    expect((await off.json()).error.code).toBe("WRITES_DISABLED");
  });
});
