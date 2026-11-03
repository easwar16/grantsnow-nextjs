import { beforeEach, expect, it, vi } from "vitest";

const mock = vi.hoisted(() => ({
  setLock: vi.fn(),
  lockStatus: vi.fn(),
}));

vi.mock("@/server/modules/proposals/record", () => ({
  proposalPage: async () => ({
    finalize: { visible: true, editable: true, pageId: 1 },
    summary: {
      sponsors: [{ roleCode: "PRM" }],
      piFields: [],
      proposalFields: [
        {
          key: "full-project-title",
          label: "Full Project Title",
          value: "Test",
        },
        { key: "keywords", label: "Keywords", value: "" },
        { key: "assigned-to", label: "Assigned To", value: "" },
      ],
      attributes: {},
    },
    bundle: "proposal",
    session: { token: "session-token" },
  }),
}));
vi.mock("@/server/oracle/api", () => ({
  proposals: { lockStatus: mock.lockStatus, setLock: mock.setLock },
}));
vi.mock("@/server/platform/configuration/resources", () => ({
  resources: async () => [
    {
      module_name: "proposal",
      label_type: "labels",
      label_name: "keywords",
      is_mandatory: "Y",
    },
    {
      module_name: "proposal",
      label_type: "labels",
      label_name: "assigned-to",
      is_mandatory: "Y",
    },
  ],
}));
vi.mock("@/server/record/attributes/service", () => ({
  loadAttributes: async () => ({ visible: false, fields: [] }),
}));

import { setProposalSummaryFinalized } from "@/server/modules/proposals/finalize";

beforeEach(() => {
  mock.lockStatus.mockReset().mockResolvedValue({ status: "UNLOCK" });
  mock.setLock.mockReset().mockResolvedValue({});
});

it("finalizes without revalidating read-only Summary display fields", async () => {
  await expect(
    setProposalSummaryFinalized("PROPOSAL", "6741", { finalize: true }),
  ).resolves.toEqual({ finalized: true });
  expect(mock.setLock).toHaveBeenCalledWith({
    body: {
      proposal_id: 6741,
      created_by: "session-token",
      status: "FINALIZE",
      page_id: 1,
      id: null,
      module_name: "PROPOSAL",
    },
  });
});
