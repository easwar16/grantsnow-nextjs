import { expect, it } from "vitest";
import { resolveOperationPath } from "@/server/api/transport";
import {
  mapSummary,
  objectAccess,
  proposalBundle,
} from "@/server/proposals/record";
import { safeReturn } from "@/lib/security";
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
it("preserves safe detail returns but rejects unsupported record routes", () => {
  expect(safeReturn("/proposals/PROPOSAL/123")).toBe("/proposals/PROPOSAL/123");
  expect(safeReturn("/proposals/INVALID/123")).toBe("/home");
  expect(safeReturn("/proposals/PROPOSAL/123/delete")).toBe("/home");
});
