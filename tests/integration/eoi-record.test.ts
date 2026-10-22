import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
const state = vi.hoisted(() => ({
  calls: vi.fn(),
  writes: vi.fn(),
  dashboard: [] as { page_name: string; read_access: string }[],
}));
vi.mock("@/server/session/service", () => ({
  authenticate: async () => ({
    session: { token: "isolated-token" },
    user: {
      personId: "101",
      organizationId: "202",
      legalId: "77",
      modules: { "opportunities-group": true, "opportunities-finder": true },
    },
  }),
}));
vi.mock("@/server/api/transport", () => ({
  oracle: state.calls,
  oracleWrite: state.writes,
}));
vi.mock("@/server/configuration/service", () => ({
  dashboardRoles: async () => state.dashboard,
}));
import {
  createEoiApplication,
  eoiPageLock,
  eoiRecordContext,
  eoiRecordIdentity,
  eoiRecordRead,
  eoiRecordTable,
  eoiSetFinalized,
  newApplicationContext,
} from "@/server/opportunities/record";
import { AppError } from "@/lib/errors";
const role = (tab: string, page_id: number, read = "Y") => ({
  page_id,
  page_name: `opportunities-eoi-${tab}`,
  read_access: read,
  edit_access: "Y",
});
const opportunity = (over: Record<string, unknown> = {}) => ({
  items: [
    {
      opportunities_id: 7,
      opp_heading: "Linked opportunity",
      opportunity_status: "OPEN",
      create_application_of_interest: "Y",
      ...over,
    },
  ],
});
/** One record's reads, overridable per operation. */
function reads(over: Record<string, unknown> = {}) {
  return async (op: string, headers: Record<string, string> = {}) => {
    if (op in over) {
      const v = over[op];
      if (v instanceof Error) throw v;
      return typeof v === "function" ? v(headers) : v;
    }
    if (op === "getSecurityUser_roles")
      return {
        items: [
          role("summary", 1),
          role("application", 2),
          role("attachments", 3),
          role("approvals", 4),
          role("dynamic-form-1", 5),
        ],
      };
    if (op === "getDynamicFormsGetRequestDetails")
      return {
        items: [
          {
            request_id: Number(headers.request_id ?? 12),
            request_number: "EOI_12",
            request_type: "OPPORTUNITIES-EOI",
            status_code: "DRFT",
            created_by: 101,
            ref_object_type: "OPPORTUNITIES",
            ref_object_id: 7,
          },
        ],
      };
    if (op === "getSharedGetOpportunities") return opportunity();
    if (op === "getPre_awardGetPersonListAll")
      return { items: [{ person_id: 101, full_name: "Alex Morgan" }] };
    if (op === "getProposalGetLockStatus")
      return { status: "UNLOCK", lock_module_id: 31 };
    return { items: [] };
  };
}
// The context is cached per request; each test gets its own record id.
let seq = 100;
const next = () => String(++seq);
beforeEach(() => {
  state.calls.mockReset();
  state.writes.mockReset();
  state.writes.mockResolvedValue({});
  state.calls.mockImplementation(reads());
  state.dashboard = [];
});
afterEach(() => vi.restoreAllMocks());
it.each(["0", "-1", "12/../../secret", "admin"])(
  "rejects unsafe EOI identity %s",
  (id) =>
    expect(eoiRecordIdentity.safeParse({ id, tab: "summary" }).success).toBe(
      false,
    ),
);
describe("record access", () => {
  it("denies a record with no role rows before reading it", async () => {
    state.calls.mockImplementation(
      reads({ getSecurityUser_roles: { items: [] } }),
    );
    await expect(eoiRecordRead(next(), "summary")).rejects.toMatchObject({
      code: "FORBIDDEN",
      message: "You don't have access to this AOI",
    });
    expect(state.calls).not.toHaveBeenCalledWith(
      "getDynamicFormsGetRequestDetails",
      expect.anything(),
    );
  });
  it("never treats read_access N as permission, and a tab without read is denied", async () => {
    state.calls.mockImplementation(
      reads({
        getSecurityUser_roles: {
          items: [role("summary", 1), role("attachments", 3, "N")],
        },
      }),
    );
    const id = next();
    expect((await eoiRecordContext(id)).tabs).toEqual(["summary"]);
    await expect(eoiRecordRead(id, "attachments")).rejects.toMatchObject({
      code: "FORBIDDEN",
      message: "You do not have access to this page.",
    });
  });
  it("denies the page when any duplicate role row refuses it", async () => {
    state.calls.mockImplementation(
      reads({
        getSecurityUser_roles: {
          items: [
            role("summary", 1),
            role("attachments", 3),
            role("attachments", 3, "N"),
          ],
        },
      }),
    );
    expect((await eoiRecordContext(next())).tabs).toEqual(["summary"]);
  });
  it("cross-checks returned object identity/type", async () => {
    state.calls.mockImplementation(
      reads({
        getDynamicFormsGetRequestDetails: {
          items: [
            {
              request_id: 13,
              request_number: "EOI_13",
              request_type: "OPPORTUNITIES-EOI",
            },
          ],
        },
      }),
    );
    await expect(eoiRecordRead(next(), "summary")).rejects.toMatchObject({
      code: "CONTRACT",
    });
  });
  it("finds the opportunity of a request link from ref_object_id, and the creator's name", async () => {
    const context = await eoiRecordContext(next());
    expect(context.opportunity?.opp_heading).toBe("Linked opportunity");
    expect(context.createdBy).toBe("Alex Morgan");
    expect(state.calls).toHaveBeenCalledWith(
      "getSharedGetOpportunities",
      expect.anything(),
      expect.objectContaining({}),
    );
    const query = state.calls.mock.calls.find(
      (c) => c[0] === "getSharedGetOpportunities",
    )![2] as URLSearchParams;
    expect(query.get("p_where_clause")).toBe(`("opportunities_id"='7')`);
  });
});
describe("Workflow gate", () => {
  it("shows Workflow with nothing to finalize on a saved request", async () => {
    expect((await eoiRecordContext(next())).tabs).toContain("approvals");
  });
  it("hides Workflow until every finalizable page is finalized", async () => {
    state.calls.mockImplementation(
      reads({
        getSharedFinalizablePages: {
          items: [{ page_name: "OPPORTUNITIES-EOI-APPLICATION" }],
        },
      }),
    );
    const open = await eoiRecordContext(next());
    expect(open.tabs).not.toContain("approvals");
    state.calls.mockImplementation(
      reads({
        getSharedFinalizablePages: {
          items: [{ page_name: "OPPORTUNITIES-EOI-APPLICATION" }],
        },
        getProposalGetLockedModules: { items: [{ id: 31, page_id: 2 }] },
      }),
    );
    const done = await eoiRecordContext(next());
    expect(done.tabs).toContain("approvals");
    expect(done.finalized.get("opportunities-eoi-application")).toBe(31);
  });
  it("hides Workflow when the finalizable pages could not be read", async () => {
    state.calls.mockImplementation(
      reads({
        getSharedFinalizablePages: new AppError("UPSTREAM", "down"),
      }),
    );
    const context = await eoiRecordContext(next());
    expect(context.finalizable).toBeNull();
    expect(context.tabs).not.toContain("approvals");
  });
  it("still signs out on a dead session in a secondary read", async () => {
    state.calls.mockImplementation(
      reads({
        getSharedFinalizablePages: new AppError("EXPIRED", "expired", 401),
      }),
    );
    await expect(eoiRecordContext(next())).rejects.toMatchObject({
      code: "EXPIRED",
    });
  });
});
describe("locks and finalize", () => {
  it("treats an unreadable lock as read-only, and a page with no id as unlocked", async () => {
    state.calls.mockImplementation(
      reads({ getProposalGetLockStatus: new AppError("UPSTREAM", "down") }),
    );
    const context = await eoiRecordContext(next());
    expect(await eoiPageLock(context, "application")).toEqual({
      known: false,
      locked: true,
    });
    expect(await eoiPageLock(context, "history")).toEqual({
      known: false,
      locked: false,
    });
  });
  it("finalizes only a draft's finalizable page, with server page and lock ids", async () => {
    state.calls.mockImplementation(
      reads({
        getSharedFinalizablePages: {
          items: [{ page_name: "opportunities-eoi-application" }],
        },
      }),
    );
    const id = next();
    await expect(
      eoiSetFinalized(id, { tab: "summary", finalize: true }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(state.writes).not.toHaveBeenCalled();
    await eoiSetFinalized(id, { tab: "application", finalize: true });
    expect(state.writes).toHaveBeenCalledWith(
      "postProposalInsertModuleLock",
      { token: "isolated-token", legal_id: "77", org_id: "202" },
      {
        proposal_id: Number(id),
        created_by: "isolated-token",
        status: "FINALIZE",
        page_id: 2,
        id: 31,
        module_name: "OPPORTUNITIES-EOI",
      },
    );
  });
  it("refuses to finalize an application that is no longer a draft", async () => {
    state.calls.mockImplementation(
      reads({
        getSharedFinalizablePages: {
          items: [{ page_name: "opportunities-eoi-application" }],
        },
        getDynamicFormsGetRequestDetails: (h: Record<string, string>) => ({
          items: [
            {
              request_id: Number(h.request_id),
              request_number: "EOI_1",
              request_type: "OPPORTUNITIES-EOI",
              status_code: "IA",
            },
          ],
        }),
      }),
    );
    await expect(
      eoiSetFinalized(next(), { tab: "application", finalize: true }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(state.writes).not.toHaveBeenCalled();
  });
  it("rejects a finalize body with extra fields", async () => {
    await expect(
      eoiSetFinalized(next(), {
        tab: "application",
        finalize: true,
        page_id: 9,
      }),
    ).rejects.toThrow();
  });
});
describe("new application", () => {
  it("fails closed without apply access, on a closed opportunity, or without the flag", async () => {
    await expect(newApplicationContext("7")).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    state.dashboard = [{ page_name: "apply-opportunities", read_access: "Y" }];
    state.calls.mockImplementation(
      reads({
        getSharedGetOpportunities: opportunity({
          opportunities_id: 8,
          opportunity_status: "CLOSED",
        }),
      }),
    );
    await expect(newApplicationContext("8")).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    state.calls.mockImplementation(
      reads({
        getSharedGetOpportunities: opportunity({
          opportunities_id: 9,
          create_application_of_interest: null,
        }),
      }),
    );
    await expect(newApplicationContext("9")).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });
  it("creates the request only on Create, then reads its number", async () => {
    state.dashboard = [{ page_name: "apply-opportunities", read_access: "Y" }];
    state.calls.mockImplementation(
      reads({
        getSharedGetOpportunities: opportunity({ opportunities_id: 11 }),
        getDynamicFormsGetRequestDetails: {
          items: [
            {
              request_id: 88,
              request_number: "AOI_88",
              request_type: "OPPORTUNITIES-EOI",
            },
          ],
        },
      }),
    );
    await newApplicationContext("11");
    expect(state.writes).not.toHaveBeenCalled();
    state.writes.mockResolvedValue({ request_id: 88 });
    expect(await createEoiApplication({ opportunityId: 11 })).toEqual({
      requestId: "88",
      number: "AOI_88",
    });
    expect(state.writes).toHaveBeenCalledTimes(1);
    expect(state.writes).toHaveBeenCalledWith("getDynamicFormsInsertRequest", {
      token: "isolated-token",
      P_REF_OBJECT_ID: "11",
      P_REF_OBJECT_TYPE: "OPPORTUNITIES",
      P_REQUEST_TYPE: "OPPORTUNITIES-EOI",
    });
  });
  it("returns no number when it cannot be read, so no files go under an unknown folder", async () => {
    state.dashboard = [{ page_name: "apply-opportunities", read_access: "Y" }];
    state.calls.mockImplementation(
      reads({
        getSharedGetOpportunities: opportunity({ opportunities_id: 12 }),
        getDynamicFormsGetRequestDetails: new AppError("UPSTREAM", "down"),
      }),
    );
    state.writes.mockResolvedValue({ request_id: 89 });
    expect(await createEoiApplication({ opportunityId: 12 })).toEqual({
      requestId: "89",
      number: null,
    });
  });
});
it("strips private attachment locations and tokens from read tables", async () => {
  state.calls.mockImplementation(
    reads({
      getPre_awardAttachmentsProposal_id: {
        items: [
          {
            document_id: 1,
            file_name: "Application.pdf",
            file_location: "private/object/path",
            token: "secret",
          },
        ],
      },
    }),
  );
  const b = await eoiRecordTable(next(), "attachments");
  expect(JSON.stringify(b)).toContain("Application.pdf");
  expect(JSON.stringify(b)).not.toMatch(/private\/object|secret|file_location/);
});
