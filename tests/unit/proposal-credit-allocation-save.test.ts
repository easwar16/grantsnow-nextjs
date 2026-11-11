import { beforeEach, expect, it, vi } from "vitest";

const dependencies = vi.hoisted(() => ({
  proposalPage: vi.fn(),
  creditAllocation: vi.fn(),
  saveCredit: vi.fn(),
}));
vi.mock("@/server/modules/proposals/record", () => ({
  proposalPage: dependencies.proposalPage,
}));
vi.mock("@/server/oracle/api", () => ({
  proposals: { creditAllocation: dependencies.creditAllocation },
  awards: { saveCredit: dependencies.saveCredit },
}));

import { saveProposalCreditAllocation } from "@/server/modules/proposals/credit-allocation";

const body = {
  versionId: 22,
  rows: [
    { id: 31, effort: 0.5, credit: 0.6 },
    { id: 32, effort: 0.2, credit: 0.4 },
  ],
};

beforeEach(() => {
  vi.resetAllMocks();
  dependencies.proposalPage.mockResolvedValue({
    rights: { read: true, edit: true },
    summary: {
      statusCode: "DRFT",
      budgetVersionId: 22,
      lockedPageIds: [],
    },
    pageIds: new Map([["proposals-allocation-for-credit", 7]]),
  });
  dependencies.creditAllocation.mockResolvedValue({
    items: [
      { credit_alloc_id: 31, credit_pct: 0.5, prj_effort: 0.5 },
      { credit_alloc_id: 32, credit_pct: 0.5, prj_effort: 0.2 },
    ],
  });
  dependencies.saveCredit.mockResolvedValue({});
});

it("saves only scoped existing rows with a 100% allocation", async () => {
  await expect(
    saveProposalCreditAllocation("PROPOSAL", "1000", body),
  ).resolves.toEqual({ saved: true });
  expect(dependencies.saveCredit).toHaveBeenCalledWith({
    periodVersionId: 22,
    body: [
      { credit_alloc_id: 31, credit_pct: 0.6, prj_effort: 0.5 },
      { credit_alloc_id: 32, credit_pct: 0.4, prj_effort: 0.2 },
    ],
  });
});

it("denies read-only, finalized and stale Budget versions before a write", async () => {
  dependencies.proposalPage.mockResolvedValueOnce({
    rights: { read: true, edit: false },
    summary: { statusCode: "DRFT", budgetVersionId: 22, lockedPageIds: [] },
    pageIds: new Map([["proposals-allocation-for-credit", 7]]),
  });
  await expect(
    saveProposalCreditAllocation("PROPOSAL", "1000", body),
  ).rejects.toThrow(/cannot be edited/);
  dependencies.proposalPage.mockResolvedValueOnce({
    rights: { read: true, edit: true },
    summary: { statusCode: "APPR", budgetVersionId: 22, lockedPageIds: [] },
    pageIds: new Map([["proposals-allocation-for-credit", 7]]),
  });
  await expect(
    saveProposalCreditAllocation("PROPOSAL", "1000", body),
  ).rejects.toThrow(/cannot be edited/);
  await expect(
    saveProposalCreditAllocation("PROPOSAL", "1000", {
      ...body,
      versionId: 21,
    }),
  ).rejects.toThrow(/version changed/);
  expect(dependencies.saveCredit).not.toHaveBeenCalled();
});

it("rejects row substitution and totals below 100%", async () => {
  await expect(
    saveProposalCreditAllocation("PROPOSAL", "1000", {
      ...body,
      rows: [{ id: 99, effort: 0.5, credit: 1 }],
    }),
  ).rejects.toThrow(/rows changed/);
  await expect(
    saveProposalCreditAllocation("PROPOSAL", "1000", {
      ...body,
      rows: body.rows.map((row) => ({ ...row, credit: 0.4 })),
    }),
  ).rejects.toThrow(/total to 100%/);
  expect(dependencies.saveCredit).not.toHaveBeenCalled();
});
