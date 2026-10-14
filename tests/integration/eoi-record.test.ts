import { beforeEach, afterEach, expect, it, vi } from "vitest";
const state = vi.hoisted(() => ({ calls: vi.fn() }));
vi.mock("@/server/session/service", () => ({
  authenticate: async () => ({
    session: { token: "isolated-token" },
    user: { modules: { "opportunities-eoi": true } },
  }),
}));
vi.mock("@/server/api/transport", () => ({ oracle: state.calls }));
import {
  eoiRecordRead,
  eoiRecordIdentity,
  eoiRecordTable,
  eoiRecordForms,
} from "@/server/opportunities/record";
beforeEach(() => {
  state.calls.mockReset();
  state.calls.mockImplementation(async (op: string) => {
    if (op === "getSecurityUser_roles")
      return {
        items: [
          { page_name: "opportunities-eoi-summary", read_access: "Y" },
          { page_name: "opportunities-eoi-attachments", read_access: "Y" },
          { page_name: "opportunities-eoi-application", read_access: "Y" },
        ],
      };
    if (op === "getDynamicFormsGetRequestDetails")
      return {
        items: [
          {
            request_id: 12,
            request_number: "EOI_12",
            request_type: "OPPORTUNITIES-EOI",
          },
        ],
      };
    return { items: [] };
  });
});
afterEach(() => vi.restoreAllMocks());
it.each(["0", "-1", "12/../../secret", "admin"])(
  "rejects unsafe EOI identity %s",
  (id) =>
    expect(eoiRecordIdentity.safeParse({ id, tab: "summary" }).success).toBe(
      false,
    ),
);
it("denies an object page before reading its record", async () => {
  state.calls.mockResolvedValue({ items: [] });
  await expect(eoiRecordRead("12", "summary")).rejects.toMatchObject({
    code: "FORBIDDEN",
  });
  expect(state.calls).not.toHaveBeenCalledWith(
    "getDynamicFormsGetRequestDetails",
    expect.anything(),
  );
});
it("never treats read_access N or missing roles as permission", async () => {
  state.calls.mockResolvedValue({
    items: [{ page_name: "opportunities-eoi-summary", read_access: "N" }],
  });
  await expect(eoiRecordRead("12", "summary")).rejects.toMatchObject({
    code: "FORBIDDEN",
  });
});
it("cross-checks returned object identity/type", async () => {
  state.calls.mockImplementation(async (op: string) =>
    op === "getSecurityUser_roles"
      ? {
          items: [{ page_name: "opportunities-eoi-summary", read_access: "Y" }],
        }
      : {
          items: [
            {
              request_id: 13,
              request_number: "EOI_13",
              request_type: "OPPORTUNITIES-EOI",
            },
          ],
        },
  );
  await expect(eoiRecordRead("12", "summary")).rejects.toMatchObject({
    code: "CONTRACT",
  });
});
it("strips private attachment locations and tokens from read tables", async () => {
  const original = state.calls.getMockImplementation()!;
  state.calls.mockImplementation(async (op: string) =>
    op === "getPre_awardAttachmentsProposal_id"
      ? {
          items: [
            {
              document_id: 1,
              file_name: "Application.pdf",
              file_location: "private/object/path",
              token: "secret",
            },
          ],
        }
      : original(op),
  );
  const b = await eoiRecordTable("12", "attachments");
  expect(JSON.stringify(b)).toContain("Application.pdf");
  expect(JSON.stringify(b)).not.toMatch(/private\/object|secret|file_location/);
});
it("maps only visible dynamic fields and option labels", async () => {
  const original = state.calls.getMockImplementation()!;
  state.calls.mockImplementation(async (op: string) =>
    op === "getProposalEthical_dynFormsP_ref_module"
      ? [
          {
            formId: 1,
            formName: "Form",
            sections: [
              {
                sectionId: 1,
                sectionName: "Section",
                sectionType: "FORM",
                isVisible: "Y",
                fields: [
                  {
                    fieldId: 1,
                    description: "Visible",
                    isVisible: "Y",
                    fieldType: "LOV",
                    options: [
                      { optionId: "A", optionValue: "Approved option" },
                    ],
                  },
                  {
                    fieldId: 2,
                    description: "Hidden",
                    isVisible: "N",
                    fieldType: "TEXT",
                  },
                ],
              },
            ],
          },
        ]
      : op === "getProposalEthicaldynFormResponse"
        ? [
            {
              form_id: 1,
              sections: [
                {
                  section_id: 1,
                  fields: [
                    { field_id: 1, value: "A" },
                    { field_id: 2, value: "hidden-secret" },
                  ],
                },
              ],
            },
          ]
        : original(op),
  );
  const b = await eoiRecordForms("12", "application");
  expect(JSON.stringify(b)).toContain("Approved option");
  expect(JSON.stringify(b)).not.toMatch(/hidden-secret|Hidden/);
});
