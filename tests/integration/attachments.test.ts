import { forget } from "@/server/oracle/cache";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AppError } from "@/lib/errors";
const state = vi.hoisted(() => ({
  oracle: vi.fn(),
  oracleWrite: vi.fn(),
  oicUpload: vi.fn(),
  oicDownload: vi.fn(),
  oicDelete: vi.fn(),
  connected: true,
  rows: [] as Record<string, string>[],
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
  oracle: state.oracle,
  oracleWrite: state.oracleWrite,
}));
vi.mock("@/server/oic/connection", () => ({
  oicConnected: () => state.connected,
  oicUpload: state.oicUpload,
  oicDownload: state.oicDownload,
  oicDelete: state.oicDelete,
  exclusiveLocation: (_: string, store: () => Promise<unknown>) => store(),
}));
vi.mock("@/server/platform/configuration/service", () => ({
  dashboardRoles: async () => [],
}));
vi.mock(
  "@/server/platform/configuration/resources",
  async (importOriginal) => ({
    ...(await importOriginal<
      typeof import("@/server/platform/configuration/resources")
    >()),
    resources: async () => state.rows,
  }),
);
import { GET as list, POST as upload } from "@/app/api/files/route";
import { DELETE as remove, GET as download } from "@/app/api/files/[id]/route";
import { POST as postLink } from "@/app/api/files/links/route";
import { DELETE as removeLink } from "@/app/api/files/links/[id]/route";
import { attachmentsView } from "@/server/record/attachments/attachments";
import {
  folderTree,
  safeLinkUrl,
  withExtension,
} from "@/features/record/attachments/model";

const origin = "http://127.0.0.1:3000";
// The client also passes its optional signal / query / path arguments; assertions compare the leading ones.
const lead = (mock: { mock: { calls: unknown[][] } }, n = 3) =>
  mock.mock.calls.map((c) => c.slice(0, n));
const HOST = "host=eoi&record=3934";
const row = (
  label_type: string,
  label_name: string,
  label_value: string,
  is_visible = "Y",
) => ({
  module_name: "OPPORTUNITIES-EOI",
  label_type,
  label_name,
  label_value,
  is_visible,
});
const FOLDERS = row(
  "tree-nodes",
  "attachments-nodes",
  "GEN:General,FIN:Finance",
);
const LINKS_ON = row("header-labels", "attachment-links-header", "Links");
let edit = "Y";
let lock: string | Error = "UNLOCK";
let status = "DRFT";
let attachments: Record<string, unknown>[] = [];
let links: Record<string, unknown>[] = [];
beforeEach(() => {
  vi.stubEnv("APP_ORIGIN", origin);
  forget("");
  edit = "Y";
  lock = "UNLOCK";
  status = "DRFT";
  attachments = [];
  links = [];
  state.connected = true;
  state.rows = [FOLDERS];
  for (const f of [
    state.oracle,
    state.oracleWrite,
    state.oicUpload,
    state.oicDownload,
    state.oicDelete,
  ])
    f.mockReset();
  state.oracleWrite.mockResolvedValue({});
  state.oracle.mockImplementation(
    async (op: string, headers: Record<string, string>) => {
      switch (op) {
        case "getSecurityUser_roles":
          return {
            items: [
              {
                page_id: 3,
                page_name: "opportunities-eoi-attachments",
                read_access: "Y",
                edit_access: edit,
              },
            ],
          };
        case "getProposalGetLockStatus":
          if (lock instanceof Error) throw lock;
          return { status: lock };
        case "getDynamicFormsGetRequestDetails":
          return {
            items: [
              {
                request_id: Number(headers.request_id),
                request_number: "AOI_513",
                request_type: "OPPORTUNITIES-EOI",
                status_code: status,
              },
            ],
          };
        case "getPre_award_costingGetGlobalVar":
          return {
            items: [
              { var_key: "INSTANCE", var_value: "dev" },
              { var_key: "DEFAULT_SIZE_FORMAT", var_value: "1" },
              { var_key: "ALLOWED_EXTENSIONS", var_value: "pdf,txt" },
            ],
          };
        case "getPre_awardAttachmentsProposal_id":
          return { items: attachments };
        case "getPre_awardLinks":
          return { items: links };
      }
      return { items: [] };
    },
  );
});
afterEach(() => vi.unstubAllEnvs());
const calls = (op: string) => state.oracle.mock.calls.filter(([o]) => o === op);
const ctx = (id: string) => ({ params: Promise.resolve({ id }) });
const listReq = (q = HOST) => list(new Request(`${origin}/api/files?${q}`));
const uploadReq = (
  file: File,
  fields: Record<string, string> = { folder: "GEN" },
  q = HOST,
  from = origin,
) => {
  const body = new FormData();
  body.set("file", file);
  for (const [k, v] of Object.entries(fields)) body.set(k, v);
  return upload(
    new Request(`${origin}/api/files?${q}`, {
      method: "POST",
      headers: { origin: from },
      body,
    }),
  );
};
const owned = {
  document_id: 41,
  file_name: "Budget",
  file_location: "DEV/77/OPPORTUNITIES-EOI/3934/GEN/Budget.pdf",
  sec_obj_ref_type: "GEN",
  document_type: "application/pdf",
  token: "secret",
};

describe("GET /api/files?host&record", () => {
  it("lists the record's documents as display rows, without storage paths or tokens", async () => {
    attachments = [owned];
    const res = await listReq();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.items[0]).toMatchObject({
      id: 41,
      name: "Budget",
      folder: "GEN",
      previewType: "application/pdf",
      downloadName: "Budget.pdf",
    });
    expect(body.links).toBeNull();
    expect(JSON.stringify(body)).not.toMatch(/DEV\/77|secret|file_location/);
    expect(calls("getPre_awardAttachmentsProposal_id")[0][2].toString()).toBe(
      "p_obj_id=3934&p_obj_type=OPPORTUNITIES-EOI",
    );
    expect(calls("getPre_awardLinks")).toHaveLength(0);
  });
  it("never offers SVG or HTML for preview", async () => {
    attachments = [
      { ...owned, document_type: "image/svg+xml" },
      { ...owned, document_id: 42, document_type: "text/html" },
    ];
    const body = await (await listReq()).json();
    expect(body.items.map((i: { previewType: null }) => i.previewType)).toEqual(
      [null, null],
    );
  });
  it("fails closed: an unknown host, a bad record, no page read", async () => {
    expect((await listReq("host=awards&record=3934")).status).toBe(400);
    expect((await listReq("host=eoi&record=../1")).status).toBe(400);
    state.oracle.mockImplementation(async (op: string) =>
      op === "getSecurityUser_roles"
        ? {
            items: [
              {
                page_id: 3,
                page_name: "opportunities-eoi-attachments",
                read_access: "N",
              },
            ],
          }
        : { items: [] },
    );
    expect((await listReq()).status).toBe(403);
    expect(calls("getPre_awardAttachmentsProposal_id")).toHaveLength(0);
  });
});

describe("the panel view", () => {
  it("takes folders, links and the EOI labels from the bundle; edit needs the page right and an open lock", async () => {
    state.rows = [FOLDERS, row("labels", "attachment-file-type", "Kind")];
    const q = new URLSearchParams(HOST);
    let view = await attachmentsView(q, "eoi-attachments");
    expect(view.folders).toEqual([
      { key: "GEN", label: "General" },
      { key: "FIN", label: "Finance" },
    ]);
    expect(view).toMatchObject({
      canEdit: true,
      showLinks: false,
      allowConfidential: false,
      maxMb: 1,
      accept: ".pdf,.txt",
    });
    expect(view.labels.fileType).toBe("Kind");
    // EOI passes literals for these (opportunities-eoi-attachments-start-page.html).
    expect(view.labels.fileName).toBe("File Name");
    edit = "N";
    forget("");
    view = await attachmentsView(q, "eoi-attachments");
    expect(view.canEdit).toBe(false);
    edit = "Y";
    forget("");
    lock = new AppError("UPSTREAM", "down");
    view = await attachmentsView(q, "eoi-attachments");
    expect(view.canEdit).toBe(false);
  });
  it("has no folders when the attachments-nodes row is hidden", async () => {
    state.rows = [{ ...FOLDERS, is_visible: "N" }];
    expect(
      (await attachmentsView(new URLSearchParams(HOST), "x")).folders,
    ).toEqual([]);
  });
});

describe("POST /api/files?host&record", () => {
  it("stores the bytes under the server-built folder path, then records the legacy body", async () => {
    const res = await uploadReq(
      new File(["hello"], "Budget v1.2.pdf", { type: "application/pdf" }),
      { folder: "GEN", newFolder: "Drafts", description: "Q1" },
    );
    expect(res.status).toBe(200);
    // Stored in the new sub-folder it is filed in, as an upload into an existing GEN~~Drafts is.
    const location =
      "DEV/77/OPPORTUNITIES-EOI/3934/GEN~~Drafts/Budget v1.2.pdf";
    expect(state.oicUpload).toHaveBeenCalledWith(
      location,
      new Uint8Array(Buffer.from("hello")),
    );
    const [op, headers, body] = state.oracleWrite.mock.calls[0];
    expect(op).toBe("postPre_awardAttachments");
    expect(headers).toEqual({
      token: "server-token",
      org_id: "202",
      legal_id: "77",
    });
    expect(body).toEqual({
      file_size: "0.0",
      file_type: "application/pdf",
      file_location: location,
      document_type: "application/pdf",
      file_name: "Budget v1.2",
      description: "Q1",
      obj_ref_id: 3934,
      obj_ref_type: "OPPORTUNITIES-EOI",
      sec_obj_ref_id: 3934,
      sec_obj_ref_type: "GEN~~Drafts",
      // allowConfidential is off for EOI, so a sent Y is never recorded.
      is_confidential: "N",
    });
  });
  it("enforces size, type, name, folder and uniqueness on the server before storing anything", async () => {
    expect(
      (await uploadReq(new File([new Uint8Array(1024 * 1024 + 1)], "big.pdf")))
        .status,
    ).toBe(400);
    expect(
      (await uploadReq(new File([new Uint8Array(2 * 1024 * 1024)], "huge.pdf")))
        .status,
    ).toBe(413);
    expect((await uploadReq(new File(["x"], "run.exe"))).status).toBe(400);
    expect((await uploadReq(new File(["x"], "a~~1.pdf"))).status).toBe(400);
    expect(
      (await uploadReq(new File(["x"], "a.pdf"), { folder: "ELSEWHERE" }))
        .status,
    ).toBe(400);
    expect(
      (
        await uploadReq(new File(["x"], "a.pdf"), {
          folder: "GEN",
          newFolder: "../up",
        })
      ).status,
    ).toBe(400);
    expect(
      (await uploadReq(new File(["x"], "a.pdf"), { folder: "GEN", extra: "1" }))
        .status,
    ).toBe(400);
    attachments = [owned];
    expect((await uploadReq(new File(["x"], "Budget.pdf"))).status).toBe(409);
    expect(state.oicUpload).not.toHaveBeenCalled();
    expect(state.oracleWrite).not.toHaveBeenCalled();
  });
  it("accepts a folder that only the data names", async () => {
    attachments = [{ ...owned, sec_obj_ref_type: "OLD~~sub" }];
    expect(
      (await uploadReq(new File(["x"], "a.pdf"), { folder: "OLD~~sub" }))
        .status,
    ).toBe(200);
  });
  it("fails closed: no edit, a finalized page, an unreadable lock, storage off, cross-origin", async () => {
    const file = new File(["x"], "a.pdf");
    edit = "N";
    expect((await uploadReq(file)).status).toBe(403);
    edit = "Y";
    forget("");
    lock = "LOCK";
    const locked = await uploadReq(file);
    expect(locked.status).toBe(403);
    expect((await locked.json()).error.message).toMatch(/finalized/);
    lock = new AppError("UPSTREAM", "down");
    expect((await uploadReq(file)).status).toBe(403);
    lock = "UNLOCK";
    state.connected = false;
    expect((await uploadReq(file)).status).toBe(503);
    state.connected = true;
    expect(
      (await uploadReq(file, { folder: "GEN" }, HOST, "https://evil.example"))
        .status,
    ).toBe(403);
    expect(state.oicUpload).not.toHaveBeenCalled();
    expect(state.oracleWrite).not.toHaveBeenCalled();
  });
  it("changes only in draft or rework (owner rule), refusing in approval or once approved", async () => {
    const file = new File(["x"], "a.pdf");
    for (const code of ["AIA", "APPROVED", "REJ"]) {
      status = code;
      forget("");
      const res = await uploadReq(file);
      expect(res.status).toBe(403);
      expect((await res.json()).error.message).toMatch(/draft or in rework/);
    }
    expect(state.oicUpload).not.toHaveBeenCalled();
    status = "REWORK";
    forget("");
    expect((await uploadReq(file)).status).toBe(200);
  });
  it("passes the writes gate's refusal through", async () => {
    state.oracleWrite.mockRejectedValue(
      new AppError("WRITES_DISABLED", "Writes are disabled.", 409),
    );
    const res = await uploadReq(new File(["x"], "a.pdf"));
    expect(res.status).toBe(409);
    expect((await res.json()).error.code).toBe("WRITES_DISABLED");
  });
});

describe("GET and DELETE /api/files/[id]?host&record", () => {
  it("downloads one of the record's files with its extension, never rendered", async () => {
    attachments = [owned];
    state.oicDownload.mockResolvedValue({ bytes: new Uint8Array([1, 2]) });
    const res = await download(
      new Request(`${origin}/api/files/41?${HOST}`),
      ctx("41"),
    );
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("application/octet-stream");
    expect(res.headers.get("content-disposition")).toContain("Budget.pdf");
    expect(state.oicDownload).toHaveBeenCalledWith(owned.file_location);
  });
  it("refuses an id that is not the record's", async () => {
    attachments = [owned];
    const res = await download(
      new Request(`${origin}/api/files/99?${HOST}`),
      ctx("99"),
    );
    expect(res.status).toBe(404);
    expect(state.oicDownload).not.toHaveBeenCalled();
  });
  it("deletes the stored object, then its record, with the server's identity", async () => {
    attachments = [owned];
    const res = await remove(
      new Request(`${origin}/api/files/41?${HOST}`, {
        method: "DELETE",
        headers: { origin },
      }),
      ctx("41"),
    );
    expect(res.status).toBe(200);
    expect(state.oicDelete).toHaveBeenCalledWith(owned.file_location);
    expect(lead(state.oracleWrite, 2)).toContainEqual([
      "deletePre_awardAttachments",
      {
        token: "server-token",
        id: "41",
        org_id: "202",
        legal_id: "77",
      },
    ]);
  });
  it("deletes nothing on a locked page, without edit, or that is not the record's", async () => {
    attachments = [owned];
    const del = (id: string) =>
      remove(
        new Request(`${origin}/api/files/${id}?${HOST}`, {
          method: "DELETE",
          headers: { origin },
        }),
        ctx(id),
      );
    lock = "LOCK";
    expect((await del("41")).status).toBe(403);
    lock = "UNLOCK";
    expect((await del("99")).status).toBe(404);
    edit = "N";
    forget("");
    expect((await del("41")).status).toBe(403);
    expect(state.oicDelete).not.toHaveBeenCalled();
    expect(state.oracleWrite).not.toHaveBeenCalled();
  });
});

describe("links", () => {
  const add = (body: unknown, from = origin) =>
    postLink(
      new Request(`${origin}/api/files/links?${HOST}`, {
        method: "POST",
        headers: { origin: from, "content-type": "application/json" },
        body: JSON.stringify(body),
      }),
    );
  const del = (id: string) =>
    removeLink(
      new Request(`${origin}/api/files/links/${id}?${HOST}`, {
        method: "DELETE",
        headers: { origin },
      }),
      ctx(id),
    );
  it("are hidden and refused unless the links header row is visible", async () => {
    expect((await (await listReq()).json()).links).toBeNull();
    expect((await add({ title: "Site", url: "example.org" })).status).toBe(403);
    expect((await del("5")).status).toBe(403);
    expect(state.oracleWrite).not.toHaveBeenCalled();
  });
  it("list with safe hrefs, add with server identity, delete only the record's own", async () => {
    state.rows = [FOLDERS, LINKS_ON];
    links = [
      { link_id: 5, link_title: "Site", link_url: "example.org" },
      { link_id: 6, link_title: "Bad", link_url: "javascript:alert(1)" },
    ];
    const listed = (await (await listReq()).json()).links;
    expect(listed).toEqual([
      { id: 5, title: "Site", href: "https://example.org" },
      { id: 6, title: "Bad", href: "#" },
    ]);
    state.oracleWrite.mockResolvedValue({ link_id: 7 });
    const res = await add({ title: " Docs ", url: "https://docs.example" });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ linkId: 7 });
    expect(lead(state.oracleWrite).at(-1)).toEqual([
      "postPre_awardLinks",
      { token: "server-token", org_id: "202", legal_id: "77" },
      {
        link_title: "Docs",
        link_url: "https://docs.example",
        obj_ref_id: 3934,
        obj_ref_type: "OPPORTUNITIES-EOI",
        is_confidential: "N",
      },
    ]);
    expect((await add({ title: "x", url: "javascript:alert(1)" })).status).toBe(
      400,
    );
    expect(
      (await add({ title: "x", url: "a.org", obj_ref_id: 1 })).status,
    ).toBe(400);
    expect((await del("99")).status).toBe(404);
    expect((await del("5")).status).toBe(200);
    const [op, headers, body, signal, query] =
      state.oracleWrite.mock.calls.at(-1)!;
    expect([op, headers, body, signal, query.toString()]).toEqual([
      "deletePre_awardLinks",
      { token: "server-token" },
      undefined,
      undefined,
      "link_id=5",
    ]);
  });
  it("need edit and an open page to change", async () => {
    state.rows = [FOLDERS, LINKS_ON];
    links = [{ link_id: 5, link_title: "Site", link_url: "example.org" }];
    lock = "LOCK";
    expect((await add({ title: "Site", url: "a.org" })).status).toBe(403);
    expect((await del("5")).status).toBe(403);
    lock = "UNLOCK";
    edit = "N";
    forget("");
    expect((await add({ title: "Site", url: "a.org" })).status).toBe(403);
    expect(
      (await add({ title: "Site", url: "a.org" }, "https://evil.example"))
        .status,
    ).toBe(403);
    expect(state.oracleWrite).not.toHaveBeenCalled();
  });
});

describe("model helpers", () => {
  it("builds the folder tree with configured, nested and data-only folders", () => {
    const tree = folderTree(
      [{ key: "GEN", label: "General" }],
      [
        { folder: "GEN~~a~~b", id: 1 },
        { folder: "OLD", id: 2 },
      ],
    );
    expect(tree.map((n) => n.path)).toEqual(["GEN", "OLD"]);
    expect(tree[0].folders[0].folders[0]).toMatchObject({
      path: "GEN~~a~~b",
      files: [{ id: 1 }],
    });
  });
  it("adds the stored extension and neutralises unsafe link schemes", () => {
    expect(withExtension("v1.2 report", "X/v1.2 report.pdf")).toBe(
      "v1.2 report.pdf",
    );
    expect(withExtension("cv.pdf", "X/cv.pdf")).toBe("cv.pdf");
    expect(safeLinkUrl("data:text/html,x")).toBe("#");
    expect(safeLinkUrl("//evil.example")).toBe("https://evil.example");
  });
});
