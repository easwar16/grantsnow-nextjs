import { describe, expect, it } from "vitest";
import { mapLinkedApplications } from "@/server/modules/proposals/linked-applications";
import { assertAwardDueDiligenceScope } from "@/server/modules/awards/record/due-diligence";

const row = { setup_flow_id: 949, application_number: "DD_808" };
describe("Due Diligence parent scope", () => {
  it("accepts only the requested Proposal identity", () => {
    expect(mapLinkedApplications({ items: [{ ...row, obj_ref_id: 12, obj_ref_type: "PROPOSAL" }] }, "12", "DUE_DILIGENCE")).toHaveLength(1);
    expect(() => mapLinkedApplications({ items: [{ ...row, obj_ref_id: 13, obj_ref_type: "PROPOSAL" }] }, "12", "DUE_DILIGENCE")).toThrow();
    expect(() => mapLinkedApplications({ items: [{ ...row, obj_ref_id: 12, obj_ref_type: "AWARD" }] }, "12", "DUE_DILIGENCE")).toThrow();
  });
  it("accepts only the requested Award identity", () => {
    expect(() => assertAwardDueDiligenceScope([{ obj_ref_id: 12, obj_ref_type: "AWARD" }], "12")).not.toThrow();
    expect(() => assertAwardDueDiligenceScope([{ obj_ref_id: 13, obj_ref_type: "AWARD" }], "12")).toThrow();
    expect(() => assertAwardDueDiligenceScope([{ obj_ref_id: 12, obj_ref_type: "PROPOSAL" }], "12")).toThrow();
  });
});
