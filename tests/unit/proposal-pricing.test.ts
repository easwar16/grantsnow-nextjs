import { expect, it } from "vitest";
import { mapPricing } from "@/server/modules/proposals/pricing";

const row = (overrides: Record<string, unknown> = {}) => ({
  proposal_id: 123,
  funding_section_header_lkp_code: "DA",
  institution_cost: 20,
  funder_cost: 80,
  fec_cost: 100,
  unindex_cost: 50,
  funder_percent: 80,
  private_note: "DO-NOT-EXPOSE",
  ...overrides,
});

it("derives indexed and unindexed totals without posting raw pricing rows", () => {
  const result = mapPricing({ items: [row()] }, "123");
  expect(result).toEqual({
    institution: 20,
    institutionPercent: 0.2,
    funder: 80,
    funderPercent: 0.8,
    unindexedFunderPercent: 1.6,
    indexed: 100,
    unindexed: 50,
  });
  expect(JSON.stringify(result)).not.toContain("DO-NOT-EXPOSE");
});

it("preserves masked values and rejects malformed or cross-record results", () => {
  const masked = mapPricing(
    { items: [row({ funder_cost: "XXXXX", funder_percent: "XXXXX" })] },
    "123",
  );
  expect(masked.funder).toBe("XXXXX");
  expect(masked.funderPercent).toBe("XXXXX");
  expect(masked.unindexedFunderPercent).toBe("XXXXX");
  expect(() =>
    mapPricing({ items: [row({ proposal_id: 124 })] }, "123"),
  ).toThrow();
  expect(() => mapPricing({ items: {} }, "123")).toThrow();
});

it("retains the backend's unindexed percentage mask even when totals are zero", () => {
  const masked = mapPricing(
    {
      items: [
        row({
          institution_cost: 0,
          funder_cost: 0,
          fec_cost: 0,
          unindex_cost: 0,
          funder_percent_unindexed: "XXXXX",
        }),
      ],
    },
    "123",
  );
  expect(masked.unindexedFunderPercent).toBe("XXXXX");
});
