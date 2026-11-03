import { expect, it } from "vitest";
import { resolveOperationPath } from "@/server/oracle/connection";
import {
  mapSummary,
  objectAccess,
  proposalBundle,
} from "@/server/modules/proposals/record";
import { functions } from "@/lib/functions";
import { pageOf } from "@/server/record/dynamic-form/access";
import { mapProposalContracts } from "@/server/modules/proposals/contracts";
const identity = { type: "PROPOSAL" as const, id: "123" };
const record = {
  proposal_id: 123,
  proposal_type: "PROPOSAL",
  proposal_number: "P_123",
  proposal_title: "Example",
  proposal_status_value: "Draft",
  currency_code: "GBP",
  internal_private: "DO-NOT-EXPOSE",
};
it("resolves only an allowlisted numeric record path", () => {
  expect(
    resolveOperationPath("getProposalProposal_id", { proposal_id: "123" }),
  ).toBe("/Proposal/proposal/123");
});
it("keeps linked Contracts inside the Proposal reference and permitted organizations", () => {
  const contract = {
    contract_id: 41,
    contract_number: "C_41",
    contract_title: "Agreement",
    object_ref_id: "P_123",
    org_id: 7,
  };
  expect(
    mapProposalContracts(
      { items: [contract], offset: 0, total_count: 1 },
      "P_123",
      ["7"],
      1,
    ).rows,
  ).toHaveLength(1);
  expect(() =>
    mapProposalContracts({ items: [contract] }, "P_124", ["7"], 1),
  ).toThrow();
  expect(() =>
    mapProposalContracts({ items: [contract] }, "P_123", ["8"], 1),
  ).toThrow();
  expect(() =>
    mapProposalContracts({ items: [contract], offset: 10 }, "P_123", ["7"], 1),
  ).toThrow();
});
it.each(["../session/login", "123?token=secret", "0", "-1", "1/2", "1e2"])(
  "rejects malicious/invalid record id %s",
  (id) => {
    expect(() =>
      resolveOperationPath("getProposalProposal_id", { proposal_id: id }),
    ).toThrow();
  },
);
it("rejects missing or unapproved path parameters", () => {
  expect(() => resolveOperationPath("getProposalProposal_id")).toThrow();
  expect(() =>
    resolveOperationPath("getProposalProposal_id", {
      proposal_id: "123",
      unexpected: "1",
    }),
  ).toThrow();
});
it("never exposes hidden summary fields or arbitrary backend payloads", () => {
  const summary = mapSummary(record, identity, []);
  expect(summary.fields).toEqual([]);
  expect(JSON.stringify(summary)).not.toContain("DO-NOT-EXPOSE");
  expect(JSON.stringify(summary)).not.toContain("GBP");
});
it("specific type visibility overrides generic resources", () => {
  const rb = [
    {
      module_name: "PROPOSAL",
      label_type: "labels",
      label_name: "currency",
      label_value: "Currency",
      is_visible: "Y" as const,
    },
    {
      module_name: "OUTLINE_PROPOSAL",
      label_type: "labels",
      label_name: "currency",
      label_value: "Currency",
      is_visible: "N" as const,
    },
  ];
  expect(mapSummary(record, identity, rb).fields[0].value).toBe("GBP");
  expect(
    mapSummary(
      { ...record, proposal_type: "OUTLINE_PROPOSAL" },
      { ...identity, type: "OUTLINE_PROPOSAL" },
      rb,
    ).fields,
  ).toEqual([]);
});
const row = (
  module_name: string,
  label_name: string,
  is_visible: "Y" | "N" | null,
  label_value: string | null = null,
) => ({
  module_name,
  label_type: "labels",
  label_name,
  label_value,
  is_visible,
});
const outline = {
  record: { ...record, proposal_type: "OUTLINE_PROPOSAL" },
  identity: { ...identity, type: "OUTLINE_PROPOSAL" as const },
};
it("an unprovisioned per-type bundle falls back to proposal, labels included", () => {
  const rb = [row("PROPOSAL", "currency", "Y", "Proposal currency")];
  expect(proposalBundle(rb, "OUTLINE_PROPOSAL")).toBe("proposal");
  expect(mapSummary(outline.record, outline.identity, rb).fields).toEqual([
    { key: "currency", label: "Proposal currency", value: "GBP", kind: "text" },
  ]);
});
it("a key missing inside a provisioned per-type bundle stays hidden (no per-key fallback)", () => {
  const rb = [
    row("PROPOSAL", "currency", "Y", "Proposal currency"),
    row("OUTLINE_PROPOSAL", "tags", "Y"),
  ];
  expect(proposalBundle(rb, "OUTLINE_PROPOSAL")).toBe("outline_proposal");
  expect(mapSummary(outline.record, outline.identity, rb).fields).toEqual([
    { key: "tags", label: "Tags", value: "", kind: "text" },
  ]);
});
it("a per-type label never borrows the proposal label", () => {
  const rb = [
    row("PROPOSAL", "currency", "Y", "Proposal currency"),
    row("OUTLINE_PROPOSAL", "currency", "Y", null),
  ];
  expect(mapSummary(outline.record, outline.identity, rb).fields[0].label).toBe(
    "Currency",
  );
});
it.each([null, "N"] as const)(
  "summary fields fail closed on is_visible %s",
  (flag) =>
    expect(
      mapSummary(record, identity, [row("PROPOSAL", "currency", flag)]).fields,
    ).toEqual([]),
);
it("object roles grant a page only when every row for it grants the right", () => {
  const roles = objectAccess([
    { page_name: "proposals-summary", read_access: "Y", edit_access: "Y" },
    { page_name: "proposals-summary", read_access: "N", edit_access: "Y" },
    { page_name: "proposals-pricing", read_access: "N" },
    { page_name: "proposals-pricing", read_access: "Y" },
    { page_name: "proposals-budget", read_access: null },
    { page_name: "proposals-team", read_access: "Y", delete_access: "Y" },
  ]);
  expect(roles.get("proposals-summary")).toEqual({
    read: false,
    edit: true,
    delete: false,
  });
  expect(roles.get("proposals-pricing")?.read).toBe(false);
  expect(roles.get("proposals-budget")?.read).toBe(false);
  expect(roles.get("proposals-team")).toEqual({
    read: true,
    edit: false,
    delete: true,
  });
  expect(objectAccess([]).get("proposals-summary")).toBeUndefined();
  expect(
    objectAccess([{ page_name: "__proto__", read_access: "Y" }]).get(
      "proposals-summary",
    ),
  ).toBeUndefined();
});
it("rejects a response for a different authorized object or type", () => {
  expect(() =>
    mapSummary({ ...record, proposal_id: 124 }, identity, []),
  ).toThrow();
  expect(() =>
    mapSummary({ ...record, proposal_type: "OUTLINE_PROPOSAL" }, identity, []),
  ).toThrow();
});
it("maps only Proposal summary and five form slots to object-role pages", () => {
  expect(pageOf({ objectType: "PROPOSAL", slot: "PROPOSALS-SUMMARY" })).toBe(
    "proposals-summary",
  );
  expect(
    pageOf({
      objectType: "OUTLINE_PROPOSAL",
      slot: "PROPOSALS-DYNAMIC-FORM-5",
    }),
  ).toBe("proposals-dynamic-form-5");
  expect(
    pageOf({ objectType: "PROPOSAL", slot: "PROPOSALS-DYNAMIC-FORM-6" }),
  ).toBeNull();
  expect(
    pageOf({ objectType: "INVALID", slot: "PROPOSALS-SUMMARY" }),
  ).toBeNull();
});
it("maps the status code needed by the shared Proposal actions", () => {
  expect(
    mapSummary({ ...record, proposal_status: "AIA" }, identity, []).statusCode,
  ).toBe("AIA");
});
it("maps nested Summary rows without leaking arbitrary Oracle fields", () => {
  const summary = mapSummary(
    {
      ...record,
      sponsors: [
        {
          prop_sponsors_rltn_id: 7,
          party_name: "Research Council",
          sponsor_type: "Primary",
          internal_private: "secret",
        },
      ],
      departments: [
        {
          prop_deptmt_rltn_id: 8,
          full_name: "Alex Morgan",
          investigator_type: "Main PI",
          org_unit_name: "Faculty",
        },
      ],
      proposal_deadlines: [
        {
          deadline_id: 9,
          deadline_type: "Sponsor",
          deadline_date: "2026-10-01",
          deadline_description: "Submit",
        },
      ],
    },
    identity,
    [],
  );
  expect(summary.sponsors[0]).toEqual({
    id: "7",
    name: "Research Council",
    funderType: "",
    type: "Primary",
    roleCode: "",
    priority: "",
  });
  expect(summary.investigators[0].name).toBe("Alex Morgan");
  expect(summary.deadlines[0].date).toBe("2026-10-01");
  expect(JSON.stringify(summary)).not.toContain("secret");
});
it("maps the VBCS Summary sections from permitted Proposal fields", () => {
  const keys = [
    "full-name",
    "employee-number",
    "org-unit",
    "proposal-stage",
    "proposal-category",
    "duration-months",
    "opportunity-url",
  ];
  const rb = keys.map((key) => row("PROPOSAL", key, "Y"));
  const summary = mapSummary(
    {
      ...record,
      proposal_stage: "Single",
      category: "valleys",
      opportunity_url: "https://example.org/call",
      departments: [
        {
          investigator_type_lkp_code: "PI",
          full_name: "Alex",
          employee_number: 4533,
        },
      ],
      collaborators: [],
      attribute_1: "P3",
      hidden_secret: "DO-NOT-EXPOSE",
    },
    identity,
    rb,
  );
  expect(
    summary.piFields.find((field) => field.key === "employee-number")?.value,
  ).toBe("4533");
  expect(
    summary.proposalFields.find((field) => field.key === "proposal-category")
      ?.value,
  ).toBe("valleys");
  expect(summary.opportunityFields[0].value).toBe("https://example.org/call");
  expect(summary.collaboratorAnswer).toBe("No");
  expect(summary.attributes).toEqual({ attribute_1: "P3" });
  expect(JSON.stringify(summary)).not.toContain("DO-NOT-EXPOSE");
});
it("preserves safe detail returns but rejects unsupported record routes", () => {
  expect(functions.security.safeReturn("/proposals/PROPOSAL/123")).toBe(
    "/proposals/PROPOSAL/123",
  );
  expect(functions.security.safeReturn("/proposals/INVALID/123")).toBe("/home");
  expect(functions.security.safeReturn("/proposals/PROPOSAL/123/delete")).toBe(
    "/home",
  );
});
