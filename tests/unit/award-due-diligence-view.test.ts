import { beforeEach, expect, it, vi } from "vitest";

const deps = vi.hoisted(() => ({
  linked: vi.fn(),
  resources: vi.fn(),
  read: vi.fn(),
}));
vi.mock("@/server/oracle/api", () => ({
  applications: { linked: deps.linked },
}));
vi.mock("@/server/platform/configuration/resources", () => ({
  resources: deps.resources,
}));
vi.mock("@/server/modules/awards/record", () => ({
  awardRecordRead: deps.read,
}));
vi.mock("@/server/modules/due-diligence/record", async () => {
  const { z } = await import("zod");
  return {
    accessType: z.enum(["DDA_ACCESS", "RESPONDENT_ACCESS", "APPROVER_ACCESS"]),
  };
});

import { dueDiligenceView } from "@/server/modules/awards/record/due-diligence";

const row = (id: number, access: string) => ({
  setup_flow_id: id,
  obj_ref_id: 1190,
  obj_ref_type: "AWARD",
  application_number: `DD_${id}`,
  access_type: access,
});
const view = (visible: "Y" | "N") =>
  deps.resources.mockResolvedValue([
    {
      module_name: "award",
      label_type: "button-labels",
      label_name: "dd-list-view-record",
      label_value: "View",
      is_visible: visible,
    },
  ]);

beforeEach(() => {
  deps.read.mockResolvedValue({ access: { roles: new Map() } });
  deps.linked.mockResolvedValue({
    items: [
      row(1, "DDA_ACCESS"),
      row(2, "RESPONDENT_ACCESS"),
      row(3, "READONLY_ACCESS"),
    ],
  });
});

it("opens each record in its own access view (legacy viewButtonActionChain), none for an unbuilt view", async () => {
  view("Y");
  const result = await dueDiligenceView("1190");
  expect(result.records.map((r) => r.href)).toEqual([
    "/due-diligence/1?access=DDA_ACCESS&tab=duediligence-general-overview",
    "/due-diligence/2?access=RESPONDENT_ACCESS&tab=duediligence-responses",
    undefined,
  ]);
  expect(result.texts.view).toBe("View");
});

it("hides View when its RB row is not visible", async () => {
  view("N");
  expect((await dueDiligenceView("1190")).texts.view).toBeNull();
});
