import { expect, it } from "vitest";
import { ethicsStakeholder, type EthicsRecord } from "@/server/modules/ethics/record";

const record = (access: EthicsRecord["access"]) => ({
  access,
  respondents: [
    { id: "1940", personId: "101", status: "Draft", statusCode: "DRFT", answered: false },
    { id: "1941", personId: "102", status: "Draft", statusCode: "DRFT", answered: false },
  ],
}) as EthicsRecord;

it("selects the signed-in stakeholder ahead of the first record", () => {
  expect(ethicsStakeholder(record("EA_ACCESS"), "102")?.id).toBe("1941");
});

it("allows an administrator to inspect the first stakeholder by default", () => {
  expect(ethicsStakeholder(record("EA_ACCESS"), "999")?.id).toBe("1940");
});

it("rejects an unknown participant and allows source-supported cross-participant reads", () => {
  expect(() => ethicsStakeholder(record("EA_ACCESS"), "101", "1942")).toThrow();
  expect(ethicsStakeholder(record("RESPONDENT_ACCESS"), "101", "1941")?.id).toBe("1941");
  expect(ethicsStakeholder(record("EA_ACCESS"), "101", "1941")?.id).toBe("1941");
});

it("fails closed when a respondent is absent from the setup", () => {
  expect(() => ethicsStakeholder(record("RESPONDENT_ACCESS"), "999")).toThrowError(
    "Ethics participant access has not been granted.",
  );
});
