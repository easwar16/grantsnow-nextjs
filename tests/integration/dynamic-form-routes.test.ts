import { forget } from "@/server/cache/memo";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AppError } from "@/lib/errors";
const state = vi.hoisted(() => ({
  oracle: vi.fn(),
  oracleWrite: vi.fn(),
  oicUpload: vi.fn(),
  oicDownload: vi.fn(),
  oicDelete: vi.fn(),
  connected: true,
  modules: { "opportunities-group": true } as Record<string, boolean>,
  dashboard: [] as { page_name: string; read_access: string }[],
}));
vi.mock("@/server/session/service", () => ({
  authenticate: async () => ({
    session: { token: "server-token" },
    user: {
      personId: "101",
      organizationId: "202",
      legalId: "77",
      modules: state.modules,
    },
  }),
}));
vi.mock("@/server/api/transport", () => ({
  oracle: state.oracle,
  oracleWrite: state.oracleWrite,
}));
vi.mock("@/server/api/oic", () => ({
  oicConnected: () => state.connected,
  oicUpload: state.oicUpload,
  oicDownload: state.oicDownload,
  oicDelete: state.oicDelete,
}));
vi.mock("@/server/configuration/service", () => ({
  dashboardRoles: async () => state.dashboard,
}));
vi.mock("@/server/configuration/resources", async (importOriginal) => ({
  ...(await importOriginal<
    typeof import("@/server/configuration/resources")
  >()),
  resources: async () => [],
}));
import { GET as getForm, POST as postForm } from "@/app/api/dynamic-form/route";
import { POST as upload } from "@/app/api/files/route";
import { DELETE as remove, GET as download } from "@/app/api/files/[id]/route";
import { checkAnswers, mapForms } from "@/server/dynamic-form/forms";
import { formSettings } from "@/server/dynamic-form/globals";
import { fileNameProblem, storageLocation } from "@/server/files/service";
const origin = "http://127.0.0.1:3000";
const APP =
  "objectType=OPPORTUNITIES&slot=OPPORTUNITIES-EOI-APPLICATION&parentId=7165673";
const RECORD = `${APP}&objectId=3934`;
const RAW_FORMS = [
  {
    formId: 67,
    formName: "Application Test",
    extra: "dropped",
    sections: [
      {
        sectionId: 1846,
        sectionName: "Details",
        sectionType: "FORM",
        isVisible: "Y",
        isMandatory: "Y",
        maxColumns: 2,
        helperText:
          "&lt;p&gt;Help&lt;script&gt;alert(1)&lt;/script&gt;&lt;/p&gt;",
        fields: [
          {
            fieldId: 1574,
            description: "Text Test",
            fieldType: "TEXTBOX",
            isRequired: "Y",
            isVisible: "Y",
          },
          {
            fieldId: 1575,
            description: "Notes",
            fieldType: "RICHTEXTEDITOR",
            isRequired: "N",
            isVisible: "Y",
          },
          {
            fieldId: 1576,
            description: "Radio",
            fieldType: "RADIO",
            isRequired: "N",
            isVisible: "Y",
            options: [
              { optionId: 1, optionValue: "Yes" },
              { optionId: 2, optionValue: "No" },
            ],
          },
          {
            fieldId: 1577,
            description: "Amount",
            fieldType: "NUMERIC",
            isRequired: "N",
            isVisible: "Y",
          },
          {
            fieldId: 1578,
            description: "File Test",
            fieldType: "FILE",
            isRequired: "N",
            isVisible: "Y",
          },
          {
            fieldId: 1579,
            description: "Odd",
            fieldType: "SIGNATURE",
            isRequired: "N",
            isVisible: "Y",
          },
        ],
      },
      {
        sectionId: 1847,
        sectionName: "GRID TST",
        sectionType: "GRID",
        isVisible: "Y",
        isMandatory: "N",
        fields: [
          {
            fieldId: 1595,
            description: "Row",
            fieldType: "TEXTBOX",
            isRequired: "Y",
            isVisible: "Y",
          },
        ],
      },
    ],
  },
];
const ROLES = (edit = "Y", read = "Y") => ({
  items: [
    {
      page_name: "opportunities-eoi-application",
      read_access: read,
      edit_access: edit,
    },
    {
      page_name: "opportunities-eoi-summary",
      read_access: "Y",
      edit_access: "N",
    },
  ],
});
let roles = ROLES();
let status = "DRFT";
let forms: unknown = RAW_FORMS;
let attachments: Record<string, unknown>[] = [];
beforeEach(() => {
  vi.stubEnv("APP_ORIGIN", origin);
  roles = ROLES();
  forget(""); // roles are held per record (60 s); a changed grant is a fresh read here
  status = "DRFT";
  forms = RAW_FORMS;
  attachments = [];
  state.connected = true;
  state.modules = { "opportunities-group": true };
  state.dashboard = [{ page_name: "apply-opportunities", read_access: "Y" }];
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
          return roles;
        case "getDynamicFormsGetRequestDetails":
          return {
            items: [
              {
                request_id: Number(headers.request_id),
                request_number: "AOI_513",
                request_type: "OPPORTUNITIES-EOI",
                status_code: status,
                ref_object_id: 7165673,
              },
            ],
          };
        case "getProposalEthical_dynFormsP_ref_module":
          return forms;
        case "getProposalEthicaldynFormResponse":
          return [
            {
              form_id: 67,
              sections: [
                {
                  section_id: 1846,
                  fields: [
                    { field_id: 1574, value: "Stored" },
                    {
                      field_id: 1575,
                      value:
                        '<p onclick="x()">Rich</p><img src=x onerror=alert(1)>',
                    },
                    { field_id: 9999, value: "unknown field" },
                  ],
                },
              ],
            },
          ];
        case "getPre_award_costingGetGlobalVar":
          return {
            items: [
              { var_key: "INSTANCE", var_value: "dev" },
              { var_key: "DEFAULT_SIZE_FORMAT", var_value: "1" },
              { var_key: "ALLOWED_EXTENSIONS", var_value: "pdf,txt" },
              { var_key: "DECIMAL_PLACES_COUNT", var_value: "3" },
            ],
          };
        case "getSharedGetOpportunities":
          return {
            items: [
              {
                opportunities_id: 7165673,
                opportunity_status: "OPEN",
                create_application_of_interest: "Y",
              },
            ],
          };
        case "getPre_awardAttachmentsProposal_id":
          return { items: attachments };
      }
      throw new Error(`Unexpected ${op}`);
    },
  );
});
afterEach(() => vi.unstubAllEnvs());
const getReq = (q: string) =>
  getForm(new Request(`${origin}/api/dynamic-form?${q}`));
const postReq = (body: unknown, from = origin) =>
  postForm(
    new Request(`${origin}/api/dynamic-form`, {
      method: "POST",
      headers: { "content-type": "application/json", origin: from },
      body: JSON.stringify(body),
    }),
  );
const target = {
  objectType: "OPPORTUNITIES",
  slot: "OPPORTUNITIES-EOI-APPLICATION",
  parentId: "7165673",
  objectId: "3934",
};
const answers = (
  fields: { field_id: string; value: unknown }[],
  section_id = "1846",
) => [{ form_id: "67", sections: [{ section_id, fields }] }];
const calls = (op: string) => state.oracle.mock.calls.filter(([o]) => o === op);
describe("GET /api/dynamic-form", () => {
  it("returns the allowlisted form and answers, sanitised, with the record as p_id and the session token", async () => {
    const res = await getReq(RECORD);
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toContain("no-store");
    const body = await res.json();
    const form = body.forms[0];
    expect(form).not.toHaveProperty("extra");
    expect(form.sections[0].helperText).toBe("<p>Help</p>");
    expect(
      form.sections[0].fields.map((f: { fieldId: number }) => f.fieldId),
    ).toEqual([1574, 1575, 1576, 1577, 1578]);
    const stored = body.answers[0].sections[0].fields;
    expect(stored).toHaveLength(2);
    expect(stored[1].value).toBe("<p>Rich</p><img>");
    expect(body.settings).toEqual({
      decimals: 3,
      maxMb: 1,
      accept: ".pdf,.txt",
      storage: true,
    });
    expect(body.texts.requiredFields).toBe(
      "Please fill all the required fields",
    );
    expect(calls("getProposalEthical_dynFormsP_ref_module")[0][1]).toEqual({
      token: "server-token",
      p_id: "3934",
      p_obj_id: "3934",
      p_obj_type: "OPPORTUNITIES",
      p_ref_module: "OPPORTUNITIES-EOI-APPLICATION",
    });
    expect(calls("getProposalEthicaldynFormResponse")[0][1]).toEqual({
      P_TOKEN: "server-token",
      P_REF_OBJ_ID: "3934",
      P_REF_MODULE: "OPPORTUNITIES-EOI-APPLICATION",
    });
    expect(calls("getSecurityUser_roles")[0][1]).toMatchObject({
      p_obj_type: "OPPORTUNITIES-EOI",
      p_obj_id: "3934",
    });
  });
  it("fails closed: no page read, no module, an unsupported host, a bad query", async () => {
    roles = {
      items: [
        {
          page_name: "opportunities-eoi-summary",
          read_access: "Y",
          edit_access: "Y",
        },
      ],
    };
    forget(""); // roles are held per record (60 s); a changed grant is a fresh read here
    expect((await getReq(RECORD)).status).toBe(403);
    roles = ROLES("Y", "N");
    forget(""); // roles are held per record (60 s); a changed grant is a fresh read here
    expect((await getReq(RECORD)).status).toBe(403);
    roles = ROLES();
    forget(""); // roles are held per record (60 s); a changed grant is a fresh read here
    state.modules = {};
    expect((await getReq(RECORD)).status).toBe(403);
    state.modules = { "opportunities-group": true };
    expect(
      (await getReq("objectType=AWARD&slot=AWARD-SUMMARY&objectId=1")).status,
    ).toBe(403);
    expect(
      (
        await getReq(
          "objectType=OPPORTUNITIES-EOI&slot=OPPORTUNITIES-EOI-APPLICATION&objectId=1",
        )
      ).status,
    ).toBe(403);
    expect(
      (
        await getReq(
          "objectType=OPPORTUNITIES&slot=OPPORTUNITIES-EOI-APPLICATION&objectId=1;drop",
        )
      ).status,
    ).toBe(400);
    expect(calls("getProposalEthical_dynFormsP_ref_module")).toHaveLength(0);
  });
  it("rejects a record that belongs to another opportunity", async () => {
    const res = await getReq(RECORD.replace("parentId=7165673", "parentId=5"));
    expect(res.status).toBe(400);
  });
  it("opens a new application's form only under the Apply rules, without reading answers", async () => {
    const res = await getReq(APP);
    expect(res.status).toBe(200);
    expect(
      calls("getProposalEthical_dynFormsP_ref_module")[0][1],
    ).toMatchObject({ p_id: "", p_obj_id: "" });
    expect(calls("getProposalEthicaldynFormResponse")).toHaveLength(0);
    state.dashboard = [];
    expect((await getReq(APP)).status).toBe(403);
    state.dashboard = [{ page_name: "apply-opportunities", read_access: "Y" }];
    state.oracle.mockImplementationOnce(async () => ({
      items: [
        {
          opportunities_id: 7165673,
          opportunity_status: "CLOSED",
          create_application_of_interest: "Y",
        },
      ],
    }));
    expect((await getReq(APP)).status).toBe(403);
    expect(
      (
        await getReq(
          "objectType=OPPORTUNITIES&slot=OPPORTUNITIES-EOI-APPLICATION",
        )
      ).status,
    ).toBe(400);
  });
  it("reports storage off when OIC is not connected", async () => {
    state.connected = false;
    expect((await (await getReq(RECORD)).json()).settings.storage).toBe(false);
  });
});
describe("POST /api/dynamic-form", () => {
  it("writes the checked answers with server headers: P_FORM_ID the first form, P_TOKEN from the session", async () => {
    const res = await postReq({
      target,
      answers: answers([
        { field_id: "1574", value: "Answer" },
        { field_id: "1575", value: "<p>ok<script>bad()</script></p>" },
        { field_id: "1576", value: "2" },
        { field_id: "1577", value: 12.5 },
        { field_id: "1578", value: "cv.pdf~~41" },
      ]),
    });
    expect(res.status).toBe(200);
    const [op, headers, body] = state.oracleWrite.mock.calls[0];
    expect(op).toBe("postDynamicFormsDynFormResponse");
    expect(headers).toEqual({
      token: "server-token",
      P_TOKEN: "server-token",
      P_FORM_ID: "67",
      P_OBJECT_ID: "3934",
      P_OBJECT_TYPE: "OPPORTUNITIES-EOI-APPLICATION",
    });
    expect(body[0].sections[0].fields[1]).toEqual({
      field_id: "1575",
      value: "<p>ok</p>",
    });
    expect(body[0].sections[0].fields[3]).toEqual({
      field_id: "1577",
      value: 12.5,
    });
  });
  it("accepts a grid's joined columns and an empty table", async () => {
    const res = await postReq({
      target,
      answers: answers([{ field_id: "1595", value: null }], "1847"),
    });
    expect(res.status).toBe(200);
  });
  it("checks a just-created draft against the new-application definition when its own has no sections", async () => {
    state.oracle.mockImplementation(
      async (op: string, headers: Record<string, string>) => {
        if (op === "getProposalEthical_dynFormsP_ref_module")
          return headers.p_id === ""
            ? RAW_FORMS
            : [{ formId: 67, sections: [] }];
        if (op === "getSecurityUser_roles") return roles;
        if (op === "getDynamicFormsGetRequestDetails")
          return {
            items: [
              {
                request_id: 3934,
                request_number: "AOI_514",
                request_type: "OPPORTUNITIES-EOI",
                status_code: "DRFT",
                ref_object_id: 7165673,
              },
            ],
          };
        throw new Error(op);
      },
    );
    const res = await postReq({
      target,
      answers: answers([{ field_id: "1574", value: "First" }]),
    });
    expect(res.status).toBe(200);
    expect(
      calls("getProposalEthical_dynFormsP_ref_module").map(([, h]) => h.p_id),
    ).toEqual(["3934", ""]);
  });
  it.each([
    ["an unknown field", answers([{ field_id: "9999", value: "x" }]), 400],
    [
      "an unknown section",
      answers([{ field_id: "1574", value: "x" }], "1"),
      400,
    ],
    [
      "an option that is not the field's",
      answers([{ field_id: "1576", value: "3" }]),
      400,
    ],
    ["text in a number", answers([{ field_id: "1577", value: "12" }]), 400],
    [
      "a path in a file name",
      answers([{ field_id: "1578", value: "../x~~1" }]),
      400,
    ],
    [
      "a field twice",
      answers([
        { field_id: "1574", value: "a" },
        { field_id: "1574", value: "b" },
      ]),
      400,
    ],
    ["an unknown form", [{ form_id: "1", sections: [] }], 400],
  ])("refuses %s without writing", async (_name, body, code) => {
    expect((await postReq({ target, answers: body })).status).toBe(code);
    expect(state.oracleWrite).not.toHaveBeenCalled();
  });
  it("fails closed without edit, outside a draft, without a record, or cross-origin", async () => {
    const ok = answers([{ field_id: "1574", value: "x" }]);
    roles = ROLES("N");
    forget(""); // roles are held per record (60 s); a changed grant is a fresh read here
    expect((await postReq({ target, answers: ok })).status).toBe(403);
    roles = {
      items: [
        ...ROLES().items,
        {
          page_name: "opportunities-eoi-application",
          read_access: "Y",
          edit_access: "N",
        },
      ],
    };
    forget(""); // roles are held per record (60 s); a changed grant is a fresh read here
    expect((await postReq({ target, answers: ok })).status).toBe(403);
    roles = ROLES();
    forget(""); // roles are held per record (60 s); a changed grant is a fresh read here
    status = "AIA";
    expect((await postReq({ target, answers: ok })).status).toBe(403);
    status = "DRFT";
    expect(
      (
        await postReq({
          target: { ...target, objectId: undefined },
          answers: ok,
        })
      ).status,
    ).toBe(400);
    expect(
      (await postReq({ target, answers: ok }, "https://evil.example")).status,
    ).toBe(403);
    expect(
      (await postReq({ target: { ...target, token: "x" }, answers: ok }))
        .status,
    ).toBe(400);
    expect(state.oracleWrite).not.toHaveBeenCalled();
  });
  it("passes the writes gate's refusal through", async () => {
    state.oracleWrite.mockRejectedValue(
      new AppError(
        "WRITES_DISABLED",
        "Saving isn't enabled in this build yet.",
        409,
      ),
    );
    const res = await postReq({
      target,
      answers: answers([{ field_id: "1574", value: "x" }]),
    });
    expect(res.status).toBe(409);
    expect((await res.json()).error.code).toBe("WRITES_DISABLED");
  });
});
const uploadReq = (file: File, q = RECORD, from = origin) => {
  const body = new FormData();
  body.set("file", file);
  return upload(
    new Request(`${origin}/api/files?${q}`, {
      method: "POST",
      headers: { origin: from },
      body,
    }),
  );
};
const ctx = (id: string) => ({ params: Promise.resolve({ id }) });
describe("POST /api/files", () => {
  it("stores the bytes under a server-built location, then records the attachment", async () => {
    state.oracleWrite.mockResolvedValue({ attachment_id: 41 });
    const res = await uploadReq(
      new File(["hello"], "cv.pdf", { type: "application/pdf" }),
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ attachmentId: 41 });
    const location =
      "DEV/77/OPPORTUNITIES/AOI_513/OPPORTUNITIES-EOI-APPLICATION/cv.pdf";
    expect(state.oicUpload).toHaveBeenCalledWith(
      location,
      new Uint8Array(Buffer.from("hello")),
    );
    expect(calls("getPre_awardAttachmentsProposal_id")[0][2].toString()).toBe(
      "p_obj_id=3934&p_obj_type=OPPORTUNITIES&p_sec_obj_type=OPPORTUNITIES-EOI-APPLICATION",
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
      file_name: "cv.pdf",
      file_location: location,
      document_type: "application/pdf",
      obj_ref_type: "OPPORTUNITIES",
      obj_ref_id: "3934",
      sec_obj_ref_type: "OPPORTUNITIES-EOI-APPLICATION",
      sec_obj_ref_id: null,
    });
  });
  it("says the file was stored but not recorded when no attachment id comes back", async () => {
    const res = await uploadReq(new File(["x"], "cv.pdf"));
    expect(res.status).toBe(502);
    expect((await res.json()).error.message).toBe(
      "cv.pdf was stored but not recorded",
    );
  });
  it("checks size, type, name and uniqueness on the server before storing anything", async () => {
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
    attachments = [
      { document_id: 5, file_name: "cv.pdf", file_location: "DEV/x/cv.pdf" },
    ];
    expect((await uploadReq(new File(["x"], "cv.pdf"))).status).toBe(409);
    expect(state.oicUpload).not.toHaveBeenCalled();
    expect(state.oracleWrite).not.toHaveBeenCalled();
  });
  it("fails closed: read-only page, a submitted record, no record, storage off, cross-origin", async () => {
    const file = new File(["x"], "cv.pdf");
    roles = ROLES("N");
    forget(""); // roles are held per record (60 s); a changed grant is a fresh read here
    expect((await uploadReq(file)).status).toBe(403);
    roles = ROLES();
    forget(""); // roles are held per record (60 s); a changed grant is a fresh read here
    status = "IA";
    expect((await uploadReq(file)).status).toBe(403);
    status = "DRFT";
    expect((await uploadReq(file, APP)).status).toBe(400);
    state.connected = false;
    expect((await uploadReq(file)).status).toBe(503);
    state.connected = true;
    expect((await uploadReq(file, RECORD, "https://evil.example")).status).toBe(
      403,
    );
    expect(state.oicUpload).not.toHaveBeenCalled();
  });
});
describe("GET and DELETE /api/files/[id]", () => {
  const owned = {
    document_id: 41,
    file_name: 'résumé "v2".pdf',
    file_location:
      "DEV/77/OPPORTUNITIES/AOI_513/OPPORTUNITIES-EOI-APPLICATION/r.pdf",
  };
  it("streams one of the record's files as a download, never rendered", async () => {
    attachments = [owned];
    state.oicDownload.mockResolvedValue({
      bytes: new Uint8Array([1, 2, 3]),
      contentType: "text/html",
    });
    const res = await download(
      new Request(`${origin}/api/files/41?${RECORD}`),
      ctx("41"),
    );
    expect(res.status).toBe(200);
    expect(state.oicDownload).toHaveBeenCalledWith(owned.file_location);
    expect(res.headers.get("content-type")).toBe("application/octet-stream");
    expect(res.headers.get("cache-control")).toBe("private, no-store");
    expect(res.headers.get("content-disposition")).toBe(
      `attachment; filename="r_sum_ _v2_.pdf"; filename*=UTF-8''${encodeURIComponent(owned.file_name)}`,
    );
    expect(new Uint8Array(await res.arrayBuffer())).toEqual(
      new Uint8Array([1, 2, 3]),
    );
  });
  it("refuses an id that is not in the record's attachment list", async () => {
    attachments = [owned];
    const res = await download(
      new Request(`${origin}/api/files/42?${RECORD}`),
      ctx("42"),
    );
    expect(res.status).toBe(404);
    expect(state.oicDownload).not.toHaveBeenCalled();
    expect(
      (await download(new Request(`${origin}/api/files/0?${RECORD}`), ctx("0")))
        .status,
    ).toBe(400);
  });
  it("needs page read to download", async () => {
    attachments = [owned];
    roles = ROLES("N", "N");
    forget(""); // roles are held per record (60 s); a changed grant is a fresh read here
    expect(
      (
        await download(
          new Request(`${origin}/api/files/41?${RECORD}`),
          ctx("41"),
        )
      ).status,
    ).toBe(403);
  });
  it("deletes the stored object, then its record, with the server's identity headers", async () => {
    attachments = [owned];
    const order: string[] = [];
    state.oicDelete.mockImplementation(async () => order.push("oic"));
    state.oracleWrite.mockImplementation(async () => order.push("record"));
    const res = await remove(
      new Request(`${origin}/api/files/41?${RECORD}`, {
        method: "DELETE",
        headers: { origin },
      }),
      ctx("41"),
    );
    expect(res.status).toBe(200);
    expect(order).toEqual(["oic", "record"]);
    expect(state.oicDelete).toHaveBeenCalledWith(owned.file_location);
    expect(state.oracleWrite).toHaveBeenCalledWith(
      "deletePre_awardAttachments",
      {
        token: "server-token",
        id: "41",
        org_id: "202",
        legal_id: "77",
      },
    );
  });
  it("deletes nothing that is not the record's, nor without edit", async () => {
    attachments = [owned];
    const del = (id: string) =>
      remove(
        new Request(`${origin}/api/files/${id}?${RECORD}`, {
          method: "DELETE",
          headers: { origin },
        }),
        ctx(id),
      );
    expect((await del("7")).status).toBe(404);
    roles = ROLES("N");
    forget(""); // roles are held per record (60 s); a changed grant is a fresh read here
    expect((await del("41")).status).toBe(403);
    expect(state.oicDelete).not.toHaveBeenCalled();
    expect(state.oracleWrite).not.toHaveBeenCalled();
  });
  it("stops at a storage failure without removing the record", async () => {
    attachments = [owned];
    state.oicDelete.mockRejectedValue(
      new AppError(
        "UPSTREAM",
        "The file couldn't be deleted (file storage answered 500).",
      ),
    );
    const res = await remove(
      new Request(`${origin}/api/files/41?${RECORD}`, {
        method: "DELETE",
        headers: { origin },
      }),
      ctx("41"),
    );
    expect(res.status).toBe(502);
    expect(state.oracleWrite).not.toHaveBeenCalled();
  });
});
describe("server helpers", () => {
  it("maps conditions leniently and keeps only known field types", () => {
    const [form] = mapForms([
      {
        formId: "1",
        sections: [
          {
            sectionId: 2,
            isVisible: "C",
            conditions: [
              { attribute: "bogus" },
              {
                attribute: "isVisible",
                conditionOperator: "IN",
                formId: 1,
                sectionId: 2,
                fieldId: 3,
                optionId: null,
              },
            ],
            fields: [
              {
                fieldId: 3,
                fieldType: "LOV",
                description: null,
                isVisible: "X",
                options: [{ optionId: 4, optionValue: 5 }],
              },
              null,
            ],
          },
        ],
      },
    ]);
    expect(form.formId).toBe(1);
    expect(form.sections[0].conditions).toEqual([
      {
        attribute: "isVisible",
        conditionOperator: "IN",
        formId: 1,
        sectionId: 2,
        fieldId: 3,
        optionId: [],
      },
    ]);
    expect(form.sections[0].fields[0]).toMatchObject({
      description: "",
      isVisible: "N",
      options: [{ optionId: 4, optionValue: "5" }],
    });
    expect(mapForms({ error: "x" })).toEqual([]);
  });
  it("rejects checkbox values outside the options and duplicates", () => {
    const forms = mapForms([
      {
        formId: 1,
        sections: [
          {
            sectionId: 2,
            fields: [
              {
                fieldId: 3,
                fieldType: "CHECKBOX",
                options: [
                  { optionId: 4, optionValue: "a" },
                  { optionId: 5, optionValue: "b" },
                ],
              },
            ],
          },
        ],
      },
    ]);
    const body = (value: unknown) => [
      {
        form_id: "1",
        sections: [{ section_id: "2", fields: [{ field_id: "3", value }] }],
      },
    ];
    expect(
      checkAnswers(forms, body(["4", "5"]))[0].sections[0].fields[0].value,
    ).toEqual(["4", "5"]);
    expect(() => checkAnswers(forms, body(["4", "4"]))).toThrow();
    expect(() => checkAnswers(forms, body(["6"]))).toThrow();
    expect(() => checkAnswers(forms, body("4"))).toThrow();
  });
  it("reads the form globals with their defaults", () => {
    expect(formSettings([])).toEqual({
      decimals: 2,
      maxMb: 4,
      accept: "",
      instance: null,
    });
    expect(
      formSettings([{ var_key: "INSTANCE", var_value: "../x" }]).instance,
    ).toBeNull();
  });
  it("builds a storage location only from safe folders, and refuses unsafe names", () => {
    const scope = {
      objectType: "OPPORTUNITIES-EOI",
      objectId: "1",
      secondaryType: "OPPORTUNITIES-EOI-DYNAMIC-FORM-1",
      objectNumber: "AOI_1",
    };
    expect(storageLocation("DEV", "77", scope, "a.pdf")).toBe(
      "DEV/77/OPPORTUNITIES-EOI/AOI_1/OPPORTUNITIES-EOI-DYNAMIC-FORM-1/a.pdf",
    );
    expect(() => storageLocation(null, "77", scope, "a.pdf")).toThrow();
    expect(() => storageLocation("DEV", undefined, scope, "a.pdf")).toThrow();
    expect(() =>
      storageLocation("DEV", "77", { ...scope, objectNumber: "../x" }, "a.pdf"),
    ).toThrow();
    expect(fileNameProblem("a/b.pdf")).not.toBeNull();
    expect(fileNameProblem("..")).not.toBeNull();
    expect(fileNameProblem("ok file.pdf")).toBeNull();
  });
});
