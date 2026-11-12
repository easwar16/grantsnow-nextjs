import { beforeEach, expect, it, vi } from "vitest";

const dependencies = vi.hoisted(() => ({
  proposalPage: vi.fn(),
  inKindSponsors: vi.fn(),
  inKindLines: vi.fn(),
  inKindCostItems: vi.fn(),
  codes: vi.fn(),
  saveInKindSponsors: vi.fn(),
  saveInKindLines: vi.fn(),
  deleteInKindLine: vi.fn(),
}));
vi.mock("@/server/modules/proposals/record", () => ({
  proposalPage: dependencies.proposalPage,
}));
vi.mock("@/server/oracle/api", () => ({
  proposals: dependencies,
  lookups: { codes: dependencies.codes },
}));

import {
  addInKindLine,
  removeInKindLine,
  saveInKindLine,
  saveInKindTotals,
} from "@/server/modules/proposals/record/in-kind";

beforeEach(() => {
  vi.resetAllMocks();
  dependencies.proposalPage.mockResolvedValue({
    rights: { read: true, edit: true, delete: true },
    summary: { statusCode: "DRFT", budgetVersionId: 22, lockedPageIds: [] },
    pageIds: new Map([["proposals-inkind-contribution", 8]]),
    bundle: "proposal",
  });
  dependencies.inKindSponsors.mockResolvedValue({
    INKIND_CONTRIBUTION: [
      {
        SPONSOR_PARTY_ID: 301,
        INKIND_CONTRIBUTOR: "Research Council",
        INKIND_AMOUNT: 100,
      },
    ],
  });
  dependencies.inKindLines.mockResolvedValue({
    items: [
      {
        id: 5,
        proposal_period_version_id: 22,
        costing_line_id: 44,
        sponsor_party_id: 301,
        inkind_amt: 30,
      },
      {
        id: 6,
        proposal_period_version_id: 22,
        costing_line_id: 45,
        sponsor_party_id: 301,
        inkind_amt: 20,
      },
    ],
  });
  dependencies.inKindCostItems.mockResolvedValue({
    items: [
      {
        cost_item_lkp_code: "STAFF",
        cost_item_desc: "Staff",
        costing_line_id: 44,
      },
    ],
  });
  dependencies.codes.mockResolvedValue({
    items: [
      {
        lookup_type_code: "TYPE_OF_INKIND",
        lookup_code_value: "TIME",
        lookup_code_descr: "Staff time",
      },
    ],
  });
  dependencies.saveInKindSponsors.mockResolvedValue({});
  dependencies.saveInKindLines.mockResolvedValue({});
  dependencies.deleteInKindLine.mockResolvedValue({});
});

it("adds a contribution from fresh cost and type lookups within the sponsor total", async () => {
  await expect(
    addInKindLine("PROPOSAL", "1000", {
      sponsorId: 301,
      costItemCode: "STAFF",
      type: "TIME",
      description: "Contributed time",
      amount: 40,
    }),
  ).resolves.toEqual({ saved: true });
  expect(dependencies.saveInKindLines).toHaveBeenCalledWith({
    proposalId: "1000",
    rows: [
      {
        ID: null,
        COSTING_LINE_ID: 44,
        SPONSOR_PARTY_ID: 301,
        INKIND_AMT: 40,
        PROPOSAL_PERIOD_VERSION_ID: 22,
        TYPE_OF_INKIND: "TIME",
        DESCRIPTION: "Contributed time",
      },
    ],
  });
  await expect(
    addInKindLine("PROPOSAL", "1000", {
      sponsorId: 301,
      costItemCode: "STAFF",
      type: "TIME",
      description: "",
      amount: 60,
    }),
  ).rejects.toThrow(/should not exceed/);
  await expect(
    addInKindLine("PROPOSAL", "1000", {
      sponsorId: 301,
      costItemCode: "FORGED",
      type: "TIME",
      description: "",
      amount: 1,
    }),
  ).rejects.toThrow(/cost item changed/);
});

it("preserves a nullable cost line ID returned after an Add", async () => {
  dependencies.inKindLines.mockResolvedValue({
    items: [
      {
        id: 7,
        proposal_period_version_id: 22,
        costing_line_id: null,
        sponsor_party_id: 301,
        inkind_amt: 10,
      },
    ],
  });
  await expect(
    saveInKindLine("PROPOSAL", "1000", { id: 7, amount: 20 }),
  ).resolves.toEqual({ saved: true });
  expect(dependencies.saveInKindLines).toHaveBeenCalledWith({
    proposalId: "1000",
    rows: [expect.objectContaining({ ID: 7, COSTING_LINE_ID: null })],
  });
});

it("sends the exact sponsor total envelope after checking existing lines", async () => {
  await expect(
    saveInKindTotals("PROPOSAL", "1000", {
      sponsors: [{ id: 301, amount: 90 }],
    }),
  ).resolves.toEqual({ saved: true });
  expect(dependencies.saveInKindSponsors).toHaveBeenCalledWith({
    proposalId: "1000",
    rows: [{ SPONSOR_PARTY_ID: 301, INKIND_AMT: 90 }],
  });
  await expect(
    saveInKindTotals("PROPOSAL", "1000", {
      sponsors: [{ id: 301, amount: 40 }],
    }),
  ).rejects.toThrow(/should not exceed/);
});

it("saves only an active scoped line below the sponsor total", async () => {
  await expect(
    saveInKindLine("PROPOSAL", "1000", { id: 5, amount: 70 }),
  ).resolves.toEqual({ saved: true });
  expect(dependencies.saveInKindLines).toHaveBeenCalledWith({
    proposalId: "1000",
    rows: [
      {
        ID: 5,
        COSTING_LINE_ID: 44,
        SPONSOR_PARTY_ID: 301,
        INKIND_AMT: 70,
        PROPOSAL_PERIOD_VERSION_ID: 22,
        TYPE_OF_INKIND: "",
        DESCRIPTION: "",
      },
    ],
  });
  await expect(
    saveInKindLine("PROPOSAL", "1000", { id: 5, amount: 81 }),
  ).rejects.toThrow(/should not exceed/);
  await expect(
    saveInKindLine("PROPOSAL", "1000", { id: 99, amount: 1 }),
  ).rejects.toThrow(/outside/);
});

it("denies deletion outside the active version and any write on a locked page", async () => {
  await expect(removeInKindLine("PROPOSAL", "1000", 99)).rejects.toThrow(
    /outside/,
  );
  expect(dependencies.deleteInKindLine).not.toHaveBeenCalled();
  dependencies.proposalPage.mockResolvedValueOnce({
    rights: { read: true, edit: true, delete: true },
    summary: { statusCode: "DRFT", budgetVersionId: 22, lockedPageIds: [8] },
    pageIds: new Map([["proposals-inkind-contribution", 8]]),
  });
  await expect(removeInKindLine("PROPOSAL", "1000", 5)).rejects.toThrow(
    /cannot be edited/,
  );
  expect(dependencies.deleteInKindLine).not.toHaveBeenCalled();
});

it("allows line editing but denies deletion when the object role lacks delete", async () => {
  dependencies.proposalPage.mockResolvedValue({
    rights: { read: true, edit: true, delete: false },
    summary: { statusCode: "DRFT", budgetVersionId: 22, lockedPageIds: [] },
    pageIds: new Map([["proposals-inkind-contribution", 8]]),
  });
  await expect(
    saveInKindLine("PROPOSAL", "1000", { id: 5, amount: 40 }),
  ).resolves.toEqual({ saved: true });
  await expect(removeInKindLine("PROPOSAL", "1000", 5)).rejects.toThrow(
    /cannot be deleted/,
  );
  expect(dependencies.deleteInKindLine).not.toHaveBeenCalled();
});
