import { expect, it } from "vitest";
import { resolveOperationPath } from "@/server/api/transport";
import { mapSummary } from "@/server/proposals/record";
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
