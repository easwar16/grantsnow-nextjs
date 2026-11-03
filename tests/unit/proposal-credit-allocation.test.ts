import { expect, it } from "vitest";
import { mapCreditAllocation } from "@/server/modules/proposals/credit-allocation";

it("maps only credit allocation display fields and retains zero percentages", () => {
  const rows = mapCreditAllocation({
    items: [
      {
        credit_alloc_id: 12,
        full_name: "Ada",
        proposal_number: "P_1",
        project_role_name: "PI",
        org_unit_name: "School",
        prj_effort: 0,
        credit_pct: 0.5,
        private_note: "SECRET",
      },
    ],
  });
  expect(rows).toEqual([
    {
      id: 12,
      name: "Ada",
      proposalNumber: "P_1",
      role: "PI",
      orgUnit: "School",
      effort: 0,
      credit: 0.5,
    },
  ]);
  expect(JSON.stringify(rows)).not.toContain("SECRET");
});

it("rejects malformed credit allocation results", () => {
  expect(() =>
    mapCreditAllocation({ items: [{ credit_alloc_id: 0 }] }),
  ).toThrow();
});
