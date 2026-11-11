import { expect, it } from "vitest";
import { canDeleteEthicsRow } from "@/features/modules/ethics/listing/delete-rules";

it("matches the Ethics list deletion matrix and fails closed on missing codes", () => {
  expect(canDeleteEthicsRow("EA_ACCESS", "INDIVIDUAL", "DRFT", "")).toBe(true);
  expect(canDeleteEthicsRow("EA_ACCESS", "INDIVIDUAL", "WIP", "DRFT")).toBe(false);
  expect(canDeleteEthicsRow("EA_ACCESS", "COLLAB", "WIP", "DRFT")).toBe(true);
  expect(canDeleteEthicsRow("EA_ACCESS", "COLLAB", "WIP", "SUBMITTED")).toBe(false);
  expect(canDeleteEthicsRow("RESPONDENT_ACCESS", "COLLAB", "DRFT", "")).toBe(true);
  expect(canDeleteEthicsRow("RESPONDENT_ACCESS", "INDIVIDUAL", "DRFT", "")).toBe(false);
  expect(canDeleteEthicsRow("APPROVER_ACCESS", "COLLAB", "DRFT", "DRFT")).toBe(false);
  expect(canDeleteEthicsRow("EA_ACCESS", "", "DRFT", "DRFT")).toBe(false);
});
