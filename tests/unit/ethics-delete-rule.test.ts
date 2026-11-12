import { expect, it } from "vitest";
import { canDeleteEthics } from "@/shared/ethics/listing";

it("follows legacy checkDeleteEthicsConditions for each view, type and status", () => {
  expect(canDeleteEthics("EA_ACCESS", "INDIVIDUAL", "DRFT", "")).toBe(true);
  expect(canDeleteEthics("EA_ACCESS", "INDIVIDUAL", "WIP", "DRFT")).toBe(false);
  expect(canDeleteEthics("EA_ACCESS", "COLLAB", "DRFT", "")).toBe(true);
  expect(canDeleteEthics("EA_ACCESS", "COLLAB", "WIP", "DRFT")).toBe(true);
  expect(canDeleteEthics("EA_ACCESS", "COLLAB", "WIP", "SUB")).toBe(false);
  expect(canDeleteEthics("RESPONDENT_ACCESS", "COLLAB", "DRFT", "")).toBe(true);
  expect(canDeleteEthics("RESPONDENT_ACCESS", "INDIVIDUAL", "DRFT", "")).toBe(
    false,
  );
  expect(canDeleteEthics("APPROVER_ACCESS", "COLLAB", "DRFT", "")).toBe(false);
  // Missing codes fail closed.
  expect(canDeleteEthics("EA_ACCESS", "", "DRFT", "DRFT")).toBe(false);
});
