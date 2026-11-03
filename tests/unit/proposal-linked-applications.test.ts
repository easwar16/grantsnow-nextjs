import { expect, it } from "vitest";
import { mapLinkedApplications } from "@/server/modules/proposals/linked-applications";

it("keeps only linked application card fields", () => {
  const rows = mapLinkedApplications(
    {
      items: [
        {
          setup_flow_id: 20,
          obj_ref_id: 10,
          application_number: "ETH_20",
          setup_description: "Review",
          status: "Draft",
          private_note: "SECRET",
        },
      ],
    },
    "10",
  );
  expect(rows[0]).toMatchObject({
    id: 20,
    reference: "ETH_20",
    title: "Review",
  });
  expect(JSON.stringify(rows)).not.toContain("SECRET");
});

it("rejects malformed and cross-proposal application rows", () => {
  expect(() => mapLinkedApplications({ items: [{}] }, "10")).toThrow();
  expect(() =>
    mapLinkedApplications(
      {
        items: [
          { setup_flow_id: 20, application_number: "ETH_20", obj_ref_id: 11 },
        ],
      },
      "10",
    ),
  ).toThrow();
});
