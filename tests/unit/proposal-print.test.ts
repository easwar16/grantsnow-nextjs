import { beforeEach, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  access: true,
  generate: vi.fn(),
}));

vi.mock("@/server/modules/proposals/record", () => ({
  proposalPage: async () => ({
    access: new Map([["proposals-print-button", { read: state.access }]]),
    summary: { budgetVersionId: 11 },
    user: { organizationId: "202" },
    identity: { type: "PROPOSAL" },
  }),
}));
vi.mock("@/server/platform/configuration/formatting", () => ({
  formattingConfiguration: async () => ({ currency: "GBP" }),
}));
vi.mock("@/server/oracle/api", () => ({
  reports: {
    forObject: async () => ({
      items: [
        {
          page_name: "PROPOSAL_REPORT",
          page_desc: "Print Proposal Report",
          output_file_name: "proposal.pdf",
          show_item: "Y",
        },
        {
          page_name: "HIDDEN_REPORT",
          page_desc: "Hidden",
          show_item: "N",
        },
      ],
    }),
    currencyRates: async () => ({
      rates: { GBP: 1 },
      currencies: [
        {
          currrency_code: "GBP",
          currency_value: "Pounds Sterling",
          currency_symbol: "£",
        },
      ],
    }),
    generate: state.generate,
  },
}));

import {
  printProposal,
  proposalPrintOptions,
} from "@/server/modules/proposals/print";

beforeEach(() => {
  state.access = true;
  state.generate.mockReset().mockResolvedValue({ bytes: new Uint8Array([1]) });
});

it("only exposes visible report choices", async () => {
  const options = await proposalPrintOptions("PROPOSAL", "123");
  expect(options.reports).toEqual([
    { code: "PROPOSAL_REPORT", label: "Print Proposal Report", enabled: true },
    { code: "HIDDEN_REPORT", label: "Hidden", enabled: false },
  ]);
});

it("rejects unapproved reports, currencies, and missing page access before generation", async () => {
  await expect(
    printProposal("PROPOSAL", "123", {
      code: "HIDDEN_REPORT",
      currency: "GBP",
    }),
  ).rejects.toThrow("Choose an available report and currency.");
  await expect(
    printProposal("PROPOSAL", "123", {
      code: "PROPOSAL_REPORT",
      currency: "USD",
    }),
  ).rejects.toThrow("Choose an available report and currency.");
  state.access = false;
  await expect(
    printProposal("PROPOSAL", "123", {
      code: "PROPOSAL_REPORT",
      currency: "GBP",
    }),
  ).rejects.toThrow("Print access has not been granted.");
  expect(state.generate).not.toHaveBeenCalled();
});

it("builds report binds from the authorized record and server session", async () => {
  await printProposal("PROPOSAL", "123", {
    code: "PROPOSAL_REPORT",
    currency: "GBP",
  });
  expect(state.generate).toHaveBeenCalledWith({
    body: {
      report_code: "PROPOSAL_REPORT",
      binds: {
        object_type: { type: "VARCHAR2", value: "PROPOSAL" },
        object_id: { type: "NUMBER", value: 123 },
        proposal_id: { type: "NUMBER", value: 123 },
        curr_code: { type: "VARCHAR2", value: "GBP" },
        curr_symbol: { type: "VARCHAR2", value: "£" },
        conv_rate: { type: "NUMBER", value: 1 },
        org_id: { type: "NUMBER", value: 202 },
      },
    },
  });
});
