import { beforeEach, expect, it, vi } from "vitest";

const dependencies = vi.hoisted(() => ({
  proposalPage: vi.fn(),
  researchPartnerHeaders: vi.fn(),
  researchPartnerLines: vi.fn(),
  summary: vi.fn(),
  saveResearchPartnerLines: vi.fn(),
  saveResearchPartnerHeaders: vi.fn(),
  deleteResearchPartnerLine: vi.fn(),
  codes: vi.fn(),
  costItemsForCategory: vi.fn(),
}));
vi.mock("@/server/modules/proposals/record", () => ({
  proposalPage: dependencies.proposalPage,
}));
vi.mock("@/server/oracle/api", () => ({
  proposals: dependencies,
  lookups: { codes: dependencies.codes },
}));
import {
  addResearchPartnerCost,
  removeResearchPartnerCost,
  saveResearchPartnerCost,
} from "@/server/modules/proposals/research-partner-costs";

beforeEach(() => {
  vi.resetAllMocks();
  dependencies.proposalPage.mockResolvedValue({
    rights: { read: true, edit: true, delete: true },
    pageIds: new Map([["proposals-budget-research-partner", 7]]),
    summary: { lockedPageIds: [] },
    bundle: "proposal",
  });
  dependencies.researchPartnerHeaders.mockResolvedValue({
    items: [
      {
        id: 4,
        prop_collab_rltn_id: 15,
        collaborator_name: "Partner",
        total_cost: 25,
      },
    ],
  });
  dependencies.researchPartnerLines.mockResolvedValue({
    items: [
      {
        id: 8,
        prop_collab_rltn_id: 15,
        cost_category_item_lkp_code: "EQUIP",
        item_description: "Scanner",
        cost: 25,
        start_date: "2027-01-01",
        end_date: "2027-02-01",
      },
    ],
  });
  dependencies.summary.mockResolvedValue({
    proposal_id: 1000,
    proposal_status: "DRFT",
    proposal_start_date: "2027-01-01",
    proposal_end_date: "2028-12-31",
  });
  dependencies.saveResearchPartnerLines.mockResolvedValue({});
  dependencies.saveResearchPartnerHeaders.mockResolvedValue({});
  dependencies.deleteResearchPartnerLine.mockResolvedValue({});
  dependencies.codes.mockResolvedValue({
    items: [
      {
        lookup_type_code: "COST_CATEGORY_TYPES",
        lookup_code: "EQUIP",
        lookup_code_descr: "Equipment",
      },
    ],
  });
  dependencies.costItemsForCategory.mockResolvedValue({
    items: [
      {
        cost_item_lkp_code: "SCANNER",
        cost_item_desc: "Scanner",
        cost_category_type_lkp_code: "EQUIP",
      },
    ],
  });
});

it("adds a cost only from current category and item choices", async () => {
  await expect(
    addResearchPartnerCost("PROPOSAL", "1000", {
      relationId: 15,
      category: "EQUIP",
      itemCode: "SCANNER",
      description: "Scanner access",
      cost: 25,
      startDate: "2027-03-01",
      endDate: "2027-03-31",
    }),
  ).resolves.toEqual({ saved: true });
  expect(dependencies.saveResearchPartnerLines).toHaveBeenCalledWith({
    rows: [
      {
        id: null,
        prop_collab_rltn_id: 15,
        cost_category_item_lkp_code: "SCANNER",
        item_description: "Scanner access",
        cost: 25,
        start_date: "2027-03-01",
        end_date: "2027-03-31",
      },
    ],
  });
  expect(dependencies.saveResearchPartnerHeaders).toHaveBeenCalledWith({
    rows: [{ id: 4, prop_collab_rltn_id: 15, total_cost: 50 }],
  });
  await expect(
    addResearchPartnerCost("PROPOSAL", "1000", {
      relationId: 15,
      category: "EQUIP",
      itemCode: "FORGED",
      description: "",
      cost: 1,
      startDate: "2027-03-01",
      endDate: "2027-03-31",
    }),
  ).rejects.toThrow(/valid cost item/);
});

it("accepts live headers without an id and sends a null id on save", async () => {
  dependencies.researchPartnerHeaders.mockResolvedValue({
    items: [
      {
        prop_collab_rltn_id: 15,
        collaborator_name: "Partner",
        total_cost: 25,
      },
    ],
  });
  await addResearchPartnerCost("PROPOSAL", "1000", {
    relationId: 15,
    category: "EQUIP",
    itemCode: "SCANNER",
    description: "Scanner access",
    cost: 25,
    startDate: "2027-03-01",
    endDate: "2027-03-31",
  });
  expect(dependencies.saveResearchPartnerHeaders).toHaveBeenCalledWith({
    rows: [{ id: null, prop_collab_rltn_id: 15, total_cost: 50 }],
  });
});

it("writes an explicit scoped Research Partner line", async () => {
  await expect(
    saveResearchPartnerCost("PROPOSAL", "1000", {
      id: 8,
      startDate: "2027-02-01",
      endDate: "2027-03-01",
      description: "Shared scanner",
      cost: 30,
    }),
  ).resolves.toEqual({ saved: true });
  expect(dependencies.saveResearchPartnerLines).toHaveBeenCalledWith({
    rows: [
      {
        id: 8,
        prop_collab_rltn_id: 15,
        cost_category_item_lkp_code: "EQUIP",
        item_description: "Shared scanner",
        cost: 30,
        start_date: "2027-02-01",
        end_date: "2027-03-01",
      },
    ],
  });
  expect(dependencies.saveResearchPartnerHeaders).toHaveBeenCalledWith({
    rows: [{ id: 4, prop_collab_rltn_id: 15, total_cost: 30 }],
  });
});

it("rejects forged lines and dates outside the Proposal period", async () => {
  await expect(
    saveResearchPartnerCost("PROPOSAL", "1000", {
      id: 99,
      startDate: "2027-01-01",
      endDate: "2027-02-01",
      description: "",
      cost: 1,
    }),
  ).rejects.toThrow(/outside this Proposal/);
  await expect(
    saveResearchPartnerCost("PROPOSAL", "1000", {
      id: 8,
      startDate: "2026-01-01",
      endDate: "2027-02-01",
      description: "",
      cost: 1,
    }),
  ).rejects.toThrow(/within the Proposal period/);
  expect(dependencies.saveResearchPartnerLines).not.toHaveBeenCalled();
});

it("uses separate delete rights and checks the line before ORDS delete", async () => {
  dependencies.proposalPage.mockResolvedValueOnce({
    rights: { read: true, edit: true, delete: false },
    pageIds: new Map([["proposals-budget-research-partner", 7]]),
    summary: { lockedPageIds: [] },
  });
  await expect(
    removeResearchPartnerCost("PROPOSAL", "1000", 8),
  ).rejects.toThrow(/cannot be deleted/);
  await expect(
    removeResearchPartnerCost("PROPOSAL", "1000", 99),
  ).rejects.toThrow(/outside this Proposal/);
  expect(dependencies.deleteResearchPartnerLine).not.toHaveBeenCalled();
  await expect(
    removeResearchPartnerCost("PROPOSAL", "1000", 8),
  ).resolves.toEqual({ deleted: true });
  expect(dependencies.deleteResearchPartnerLine).toHaveBeenCalledWith({
    lineId: 8,
  });
});
