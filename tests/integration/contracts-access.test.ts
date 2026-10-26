import { beforeEach, expect, it, vi } from "vitest";
const state = vi.hoisted(() => ({
  user: { modules: { CONTRACTS: true } },
  oracle: vi.fn(),
  choices: vi.fn(),
  roles: vi.fn(),
  organizations: vi.fn(),
}));
vi.mock("@/server/identity/session/service", () => ({
  authenticate: async () => ({
    user: state.user,
    session: { token: "test-token" },
  }),
}));
vi.mock("@/server/oracle/connection", () => ({ oracle: state.oracle }));
vi.mock("@/server/contracts/lookups", () => ({
  contractListingChoices: state.choices,
}));
vi.mock("@/server/platform/configuration/service", () => ({
  dashboardRoles: state.roles,
  organizations: state.organizations,
}));
vi.mock("@/server/platform/configuration/resources", () => ({
  resources: async () => ({}),
  label: (
    _rb: unknown,
    _module: string,
    _group: string,
    _key: string,
    fallback: string,
  ) => fallback,
  resourceVisible: () => true,
}));
import {
  canCreateContract,
  contractComments,
  contractAudits,
  parseContractAuditEvent,
  contractHistory,
  contractHistoryHost,
  contractDelegationHost,
  contractSigners,
  contractWorkflow,
  contractStageUsers,
  contractActiveVersion,
  contractApprovalHistory,
  loadContract,
  listContracts,
} from "@/server/contracts/service";
import { parseContractQuery } from "@/features/contracts/schema";
import { authorizeForm, pageOf } from "@/server/record/dynamic-form/access";

beforeEach(() => {
  state.user = { modules: { CONTRACTS: true } };
  state.oracle.mockReset();
  state.choices.mockReset();
  state.choices.mockResolvedValue({ types: [], orgs: [], sorts: [] });
  state.roles.mockReset();
  state.organizations.mockReset();
  state.organizations.mockResolvedValue([{ id: "202" }]);
});
it("maps Contract fragment hosts to the scoped record and denies missing write grants", async () => {
  state.oracle.mockImplementation(async (operation: string) => {
    if (operation === "getSecurityUser_roles")
      return {
        items: [
          { page_name: "contracts-summary", read_access: "Y" },
          { page_name: "contracts-history", read_access: "Y" },
          { page_name: "contracts-delegation", read_access: "Y" },
        ],
      };
    if (operation === "getContractsContract_id")
      return {
        contract_id: 1420,
        contract_number: "C_1420",
        contract_title: "Scoped",
        status_lkp_code: "IA",
        org_id: 202,
      };
    throw new Error(`Unexpected operation: ${operation}`);
  });
  const history = await contractHistoryHost("1420");
  expect(history).toMatchObject({
    objectType: "CONTRACT",
    objectId: "1420",
    objectNumber: "C_1420",
    approvalType: "CONTRACT",
    rights: { addStatus: false, abandon: false },
  });
  const delegation = await contractDelegationHost("1420");
  expect(delegation).toMatchObject({
    objectType: "CONTRACT",
    objectId: "1420",
    rights: { edit: false, delete: false },
  });
});
it("allows Contract Header form reads only through a scoped Summary record", async () => {
  expect(pageOf({ objectType: "CONTRACT", slot: "CONTRACTS-SUMMARY" })).toBe(
    "contracts-summary",
  );
  expect(pageOf({ objectType: "CONTRACT", slot: "OTHER" })).toBeNull();
  state.oracle.mockImplementation(async (operation: string) => {
    if (operation === "getSecurityUser_roles")
      return { items: [{ page_name: "contracts-summary", read_access: "Y" }] };
    if (operation === "getContractsContract_id")
      return {
        contract_id: 1423,
        contract_number: "C_1423",
        contract_title: "Scoped",
        org_id: 202,
      };
    throw new Error(`Unexpected operation: ${operation}`);
  });
  const target = {
    objectType: "CONTRACT",
    slot: "CONTRACTS-SUMMARY",
    objectId: "1423",
    parentId: "1423",
  };
  await expect(authorizeForm(target, "read")).resolves.toMatchObject({
    page: "contracts-summary",
    record: { id: "1423", number: "C_1423" },
  });
  await expect(authorizeForm(target, "edit")).rejects.toMatchObject({
    code: "FORBIDDEN",
  });
  await expect(
    authorizeForm({ ...target, parentId: "999" }, "read"),
  ).rejects.toMatchObject({ code: "BAD_REQUEST" });
});
it("denies a Contract fragment before its object read when the tab grant is absent", async () => {
  state.oracle.mockResolvedValue({
    items: [{ page_name: "contracts-summary", read_access: "Y" }],
  });
  await expect(contractHistoryHost("1421")).rejects.toMatchObject({
    code: "FORBIDDEN",
  });
  await expect(contractDelegationHost("1422")).rejects.toMatchObject({
    code: "FORBIDDEN",
  });
  expect(state.oracle).not.toHaveBeenCalledWith(
    "getContractsContract_id",
    expect.anything(),
  );
});
it("shows creation only for an explicit unanimous dashboard grant", async () => {
  state.roles
    .mockResolvedValueOnce([])
    .mockResolvedValueOnce([
      { page_name: "create-contract", read_access: "Y" },
      { page_name: "create-contract", read_access: "N" },
    ])
    .mockResolvedValueOnce([
      { page_name: "create-contract", read_access: "Y" },
    ]);
  await expect(canCreateContract()).resolves.toBe(false);
  await expect(canCreateContract()).resolves.toBe(false);
  await expect(canCreateContract()).resolves.toBe(true);
});
it("denies Contract History before either history endpoint when the tab grant is missing", async () => {
  state.oracle.mockResolvedValueOnce({
    items: [{ page_name: "contracts-summary", read_access: "Y" }],
  });
  await expect(contractHistory("1300", "C_1300")).rejects.toMatchObject({
    code: "FORBIDDEN",
  });
  expect(state.oracle).toHaveBeenCalledTimes(1);
});
it("blocks Signers in Draft before any Oracle call", async () => {
  await expect(contractSigners("1300", "DRFT")).rejects.toMatchObject({
    code: "FORBIDDEN",
  });
  expect(state.oracle).not.toHaveBeenCalled();
});
it("blocks Workflow in Draft before any Oracle call", async () => {
  await expect(
    contractWorkflow("1300", "C_1300", "DRFT"),
  ).rejects.toMatchObject({ code: "FORBIDDEN" });
  expect(state.oracle).not.toHaveBeenCalled();
});
it("does not trust a caller-supplied Signers status", async () => {
  const grants = {
    items: [
      { page_name: "contracts-signers", read_access: "Y" },
      { page_name: "contracts-summary", read_access: "Y" },
    ],
  };
  state.oracle
    .mockResolvedValueOnce(grants)
    .mockResolvedValueOnce(grants)
    .mockResolvedValueOnce({
      contract_id: 1300,
      contract_number: "C_1300",
      contract_title: "Draft",
      status_lkp_code: "DRFT",
      org_id: 202,
    });
  await expect(contractSigners("1300", "AIA")).rejects.toMatchObject({
    code: "FORBIDDEN",
  });
  expect(state.oracle).not.toHaveBeenCalledWith(
    "getContractsSignerDetails",
    expect.anything(),
  );
});
it("rejects approval stages belonging to another contract", async () => {
  state.oracle
    .mockResolvedValueOnce({
      items: [
        { page_name: "contracts-workflow", read_access: "Y" },
        { page_name: "contracts-summary", read_access: "Y" },
      ],
    })
    .mockResolvedValueOnce({
      items: [
        { page_name: "contracts-workflow", read_access: "Y" },
        { page_name: "contracts-summary", read_access: "Y" },
      ],
    })
    .mockResolvedValueOnce({
      contract_id: 1300,
      contract_number: "C_1300",
      contract_title: "Scoped",
      org_id: 202,
    })
    .mockResolvedValueOnce({
      items: [{ approval_number: "C_999", level_id: 1 }],
    });
  await expect(contractWorkflow("1300", "C_1300", "AIA")).rejects.toMatchObject(
    { code: "FORBIDDEN" },
  );
});
it("rejects approvers returned for another approval stage", async () => {
  state.oracle.mockImplementation(async (operation: string) => {
    if (operation === "getSecurityUser_roles")
      return {
        items: [
          { page_name: "contracts-summary", read_access: "Y" },
          { page_name: "contracts-workflow", read_access: "Y" },
        ],
      };
    if (operation === "getContractsContract_id")
      return {
        contract_id: 1300,
        contract_number: "C_1300",
        contract_title: "Scoped",
        status_code: "AIA",
        org_id: 202,
      };
    if (operation === "getApproval_setupApproval_stages")
      return {
        items: [
          { approval_number: "C_1300", level_id: 42, level_name: "Stage 1" },
        ],
      };
    if (operation === "getApproval_setupGet_stage_users")
      return {
        items: [{ stage_id: 99, name: "Other approver" }],
      };
    throw new Error(`Unexpected operation: ${operation}`);
  });
  await expect(contractStageUsers("1300", "C_1300", 42)).rejects.toMatchObject({
    code: "FORBIDDEN",
  });
  expect(
    state.oracle.mock.calls.map(([op, headers]) => [op, headers]),
  ).toContainEqual([
    "getApproval_setupGet_stage_users",
    {
      token: "test-token",
      p_approval_number: "C_1300",
      stage_id: "42",
      doc_type: "CONTRACT",
    },
  ]);
});
it("rejects a version list containing another contract", async () => {
  state.oracle.mockImplementation(async (operation: string) => {
    if (operation === "getSecurityUser_roles")
      return { items: [{ page_name: "contracts-summary", read_access: "Y" }] };
    if (operation === "getContractsContract_id")
      return {
        contract_id: 1300,
        contract_number: "C_1300",
        contract_title: "Scoped",
        org_id: 202,
      };
    if (operation === "getContractsGetContractVersions")
      return {
        items: [
          {
            contract_id: 999,
            object_str_ref: "other.pdf",
            active_version_flag: "Y",
          },
        ],
      };
    throw new Error(`Unexpected operation: ${operation}`);
  });
  await expect(contractActiveVersion("1300")).rejects.toMatchObject({
    code: "FORBIDDEN",
  });
});
it("rejects approval history returned for another contract", async () => {
  state.oracle.mockImplementation(async (operation: string) => {
    if (operation === "getSecurityUser_roles")
      return {
        items: [
          { page_name: "contracts-summary", read_access: "Y" },
          { page_name: "contracts-workflow", read_access: "Y" },
        ],
      };
    if (operation === "getContractsContract_id")
      return {
        contract_id: 1300,
        contract_number: "C_1300",
        contract_title: "Scoped",
        org_id: 202,
      };
    if (operation === "getPre_awardGetApprovalHistory")
      return {
        items: [{ transaction_number: "C_999", full_name: "Other approver" }],
      };
    throw new Error(`Unexpected operation: ${operation}`);
  });
  await expect(contractApprovalHistory("1300", "C_1300")).rejects.toMatchObject(
    { code: "FORBIDDEN" },
  );
});
it("rejects unconfigured sort and organization choices before listing", async () => {
  await expect(
    listContracts(
      parseContractQuery(new URLSearchParams("sort=unapproved_column")),
    ),
  ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  await expect(
    listContracts(parseContractQuery(new URLSearchParams("orgUnit=999"))),
  ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  expect(state.oracle).not.toHaveBeenCalled();
});
it("denies listing before Oracle when module access is absent", async () => {
  state.user = { modules: { CONTRACTS: false } };
  await expect(
    listContracts(parseContractQuery(new URLSearchParams())),
  ).rejects.toMatchObject({ code: "FORBIDDEN" });
  expect(state.oracle).not.toHaveBeenCalled();
});
it("denies a contract when its summary grant is missing before fetching the record", async () => {
  state.oracle.mockResolvedValueOnce({
    items: [{ page_name: "contracts-history", read_access: "Y" }],
  });
  await expect(loadContract("1300")).rejects.toMatchObject({
    code: "FORBIDDEN",
  });
  expect(state.oracle).toHaveBeenCalledTimes(1);
  expect(
    state.oracle.mock.calls.map(([op, headers]) => [op, headers]),
  ).toContainEqual([
    "getSecurityUser_roles",
    {
      token: "test-token",
      p_obj_type: "CONTRACT",
      p_obj_id: "1300",
    },
  ]);
});
it("rejects a different contract returned after an authorized role check", async () => {
  state.oracle.mockResolvedValueOnce({
    items: [{ page_name: "contracts-summary", read_access: "Y" }],
  });
  state.oracle.mockResolvedValueOnce({
    contract_id: 1301,
    contract_number: "C_1301",
    contract_title: "Other",
    status: "Draft",
  });
  await expect(loadContract("1300")).rejects.toMatchObject({
    code: "FORBIDDEN",
  });
});
it("denies a Contract outside the person's organization scope", async () => {
  state.oracle
    .mockResolvedValueOnce({
      items: [{ page_name: "contracts-summary", read_access: "Y" }],
    })
    .mockResolvedValueOnce({
      contract_id: 1300,
      contract_number: "C_1300",
      contract_title: "Scoped",
      org_id: 999,
    });
  await expect(loadContract("1300")).rejects.toMatchObject({
    code: "FORBIDDEN",
  });
  expect(state.organizations).toHaveBeenCalledOnce();
});
it("rejects comments belonging to another Contract", async () => {
  state.oracle
    .mockResolvedValueOnce({
      items: [{ page_name: "contracts-summary", read_access: "Y" }],
    })
    .mockResolvedValueOnce({
      contract_id: 1300,
      contract_number: "C_1300",
      contract_title: "Scoped",
      org_id: 202,
    })
    .mockResolvedValueOnce({
      items: [{ page_name: "contracts-summary", read_access: "Y" }],
    })
    .mockResolvedValueOnce({
      items: [{ comment_id: 1, object_id: 1301, comments: "Other" }],
    });
  await expect(contractComments("1300")).rejects.toMatchObject({
    code: "FORBIDDEN",
  });
});
it("validates Audit Trail filters and rejects another Contract's events", async () => {
  expect(() => parseContractAuditEvent("APPROVED")).toThrow();
  expect(parseContractAuditEvent(undefined)).toBe("");
  state.oracle
    .mockResolvedValueOnce({
      items: [{ page_name: "contracts-summary", read_access: "Y" }],
    })
    .mockResolvedValueOnce({
      contract_id: 1300,
      contract_number: "C_1300",
      contract_title: "Scoped",
      org_id: 202,
    })
    .mockResolvedValueOnce({
      items: [{ page_name: "contracts-summary", read_access: "Y" }],
    })
    .mockResolvedValueOnce({
      items: [{ object_id: 1301, object_type: "CONTRACT", event: "UPDATED" }],
    });
  await expect(contractAudits("1300", "UPDATED")).rejects.toMatchObject({
    code: "FORBIDDEN",
  });
});
