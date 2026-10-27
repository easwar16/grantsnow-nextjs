import { beforeEach, expect, it, vi } from "vitest";
const state = vi.hoisted(() => ({
  user: { modules: { CONTRACTS: true } },
  oracle: vi.fn(),
  answers: {} as Record<string, unknown>,
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
// Every read is fresh: the per-session cache would carry one test's roles into the next.
vi.mock("@/server/oracle/cache", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/server/oracle/cache")>()),
  memo: (_key: string, _ttl: number, load: () => Promise<unknown>) => load(),
}));
vi.mock("@/server/modules/contracts/lookups", () => ({
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
vi.mock("@/server/platform/configuration/formatting", () => ({
  displayFormat: async () => undefined,
}));
import {
  canCreateContract,
  contractActiveVersion,
  contractDelegationHost,
  contractHistoryHost,
  contractSigners,
  contractVisibleTabs,
  listContracts,
  loadContract,
} from "@/server/modules/contracts/service";
import { contractApprovalHost } from "@/server/modules/contracts/workflow";
import { panelHost } from "@/server/record/objects/panels";
import { auditView } from "@/server/record/objects/audit";
import { parseContractQuery } from "@/features/modules/contracts/schema";
import { authorizeForm, pageOf } from "@/server/record/dynamic-form/access";

const grants = (...pages: (string | [string, "edit"])[]) => ({
  items: pages.map((p) =>
    typeof p === "string"
      ? { page_id: pages.indexOf(p) + 1, page_name: p, read_access: "Y" }
      : {
          page_id: pages.indexOf(p) + 1,
          page_name: p[0],
          read_access: "Y",
          edit_access: "Y",
        },
  ),
});
const contract = (fields: Record<string, unknown> = {}) => ({
  contract_id: 1300,
  contract_number: "C_1300",
  contract_title: "Scoped",
  status_lkp_code: "IA",
  org_id: 202,
  ...fields,
});
const ops = () => state.oracle.mock.calls.map(([op]) => op as string);

beforeEach(() => {
  state.user = { modules: { CONTRACTS: true } };
  // Finalize state, locks and status names answer empty unless a test sets them.
  state.answers = {
    getSharedFinalizablePages: { items: [] },
    getProposalGetLockedModules: { items: [] },
    getPre_awardGetLookupTypesCodes: { items: [] },
  };
  state.oracle.mockReset();
  state.oracle.mockImplementation(async (op: string) => {
    if (!(op in state.answers)) throw new Error(`Unexpected operation: ${op}`);
    return state.answers[op];
  });
  state.choices.mockReset();
  state.choices.mockResolvedValue({ types: [], orgs: [], sorts: [] });
  state.roles.mockReset();
  state.organizations.mockReset();
  state.organizations.mockResolvedValue([{ id: "202" }]);
});
const panel = (page: string) =>
  new URLSearchParams({ type: "CONTRACT", id: "1300", page });

it("scopes the shared panels to a readable Contract page; writing needs its edit", async () => {
  state.answers.getSecurityUser_roles = grants("contracts-summary", [
    "contracts-delegation",
    "edit",
  ]);
  await expect(
    panelHost(panel("contracts-delegation"), "write"),
  ).resolves.toMatchObject({
    objectType: "CONTRACT",
    objectId: "1300",
    bundle: "contract",
    canComment: true,
  });
  await expect(
    panelHost(panel("contracts-summary"), "write"),
  ).rejects.toMatchObject({ code: "FORBIDDEN" });
  await expect(
    panelHost(panel("contracts-workflow"), "read"),
  ).rejects.toMatchObject({ code: "FORBIDDEN" });
  await expect(
    panelHost(panel("contracts-unknown"), "read"),
  ).rejects.toMatchObject({ code: "BAD_REQUEST" });
});
it("maps the history and delegation hosts to the scoped record and denies missing edit grants", async () => {
  state.answers.getSecurityUser_roles = grants(
    "contracts-summary",
    "contracts-history",
    "contracts-delegation",
  );
  state.answers.getContractsContract_id = contract();
  await expect(contractHistoryHost("1300")).resolves.toMatchObject({
    objectType: "CONTRACT",
    objectId: "1300",
    objectNumber: "C_1300",
    approvalType: "CONTRACT",
    rights: { addStatus: false, abandon: false },
  });
  await expect(contractDelegationHost("1300")).resolves.toMatchObject({
    objectType: "CONTRACT",
    objectId: "1300",
    rights: { edit: false, delete: false },
  });
});
it("allows Contract Header form reads only through a scoped Summary record", async () => {
  expect(pageOf({ objectType: "CONTRACT", slot: "CONTRACTS-SUMMARY" })).toBe(
    "contracts-summary",
  );
  expect(pageOf({ objectType: "CONTRACT", slot: "OTHER" })).toBeNull();
  state.answers.getSecurityUser_roles = grants("contracts-summary");
  state.answers.getContractsContract_id = contract();
  const target = {
    objectType: "CONTRACT",
    slot: "CONTRACTS-SUMMARY",
    objectId: "1300",
    parentId: "1300",
  };
  await expect(authorizeForm(target, "read")).resolves.toMatchObject({
    page: "contracts-summary",
    record: { id: "1300", number: "C_1300" },
  });
  await expect(authorizeForm(target, "edit")).rejects.toMatchObject({
    code: "FORBIDDEN",
  });
  await expect(
    authorizeForm({ ...target, parentId: "999" }, "read"),
  ).rejects.toMatchObject({ code: "BAD_REQUEST" });
});
it("denies a tab before the contract read when its grant is absent", async () => {
  state.answers.getSecurityUser_roles = grants("contracts-summary");
  await expect(contractHistoryHost("1300")).rejects.toMatchObject({
    code: "FORBIDDEN",
  });
  await expect(contractDelegationHost("1300")).rejects.toMatchObject({
    code: "FORBIDDEN",
  });
  expect(ops()).not.toContain("getContractsContract_id");
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
it("keeps Workflow and Signers closed on a draft until every finalizable page is finalized", async () => {
  state.answers.getSecurityUser_roles = grants(
    "contracts-summary",
    "contracts-workflow",
    "contracts-signers",
  );
  state.answers.getContractsContract_id = contract({ status_lkp_code: "DRFT" });
  state.answers.getSharedFinalizablePages = {
    items: [{ page_name: "contracts-summary" }],
  };
  await expect(contractSigners("1300")).rejects.toMatchObject({
    code: "FORBIDDEN",
  });
  await expect(contractApprovalHost("1300")).rejects.toMatchObject({
    code: "FORBIDDEN",
  });
  await expect(contractVisibleTabs("1300")).resolves.toMatchObject({
    workflow: false,
    signers: false,
  });
  expect(ops()).not.toContain("getContractsSignerDetails");
  // Summary finalized (its lock on page id 1): legacy getTabs opens both.
  state.answers.getProposalGetLockedModules = {
    items: [{ id: 9, page_id: 1 }],
  };
  await expect(contractVisibleTabs("1300")).resolves.toMatchObject({
    workflow: true,
    signers: true,
  });
});
it("keeps Workflow closed on a draft whose finalize state cannot be read", async () => {
  state.answers.getSecurityUser_roles = grants(
    "contracts-summary",
    "contracts-workflow",
  );
  state.answers.getContractsContract_id = contract({ status_lkp_code: "DRFT" });
  state.answers.getSharedFinalizablePages = { unexpected: true };
  await expect(contractVisibleTabs("1300")).resolves.toMatchObject({
    workflow: false,
  });
});
it("hosts the shared workflow with the legacy fragment's keys; an unknown lock closes Add Stage", async () => {
  state.answers.getSecurityUser_roles = grants(
    "contracts-summary",
    ["contracts-workflow", "edit"],
    ["contract-add-stage", "edit"],
  );
  state.answers.getContractsContract_id = contract({ status_lkp_code: "AIA" });
  // A lock that cannot be read.
  state.answers.getProposalGetLockStatus = null;
  const host = await contractApprovalHost("1300");
  expect(host).toMatchObject({
    docNum: "C_1300",
    docType: "CONTRACT",
    approvalType: "CONTRACT",
    bundle: "contract",
    state: { inApproval: true, withdraw: true, showAddStage: false },
    rights: { route: true, addStage: true, addApprover: false },
  });
  state.answers.getProposalGetLockStatus = { status: "UNLOCK" };
  expect((await contractApprovalHost("1300")).state.showAddStage).toBe(true);
});
it("rejects a version list containing another contract", async () => {
  state.answers.getSecurityUser_roles = grants("contracts-summary");
  state.answers.getContractsContract_id = contract();
  state.answers.getContractsGetContractVersions = {
    items: [
      {
        contract_id: 999,
        object_str_ref: "other.pdf",
        active_version_flag: "Y",
      },
    ],
  };
  await expect(contractActiveVersion("1300")).rejects.toMatchObject({
    code: "FORBIDDEN",
  });
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
it("names a status the row leaves blank from the configured CONTRACT_STATUS lookup", async () => {
  state.answers.getGetAllContracts = {
    items: [contract({ status: null, status_lkp_code: "SUBMIT_SIGN" })],
    offset: 0,
    total_count: 1,
  };
  state.answers.getPre_awardGetLookupTypesCodes = {
    items: [
      { lookup_code: "SUBMIT_SIGN", lookup_code_descr: "Sent for Signing" },
    ],
  };
  const page = await listContracts(parseContractQuery(new URLSearchParams()));
  expect(page.rows[0]).toMatchObject({
    status: "Sent for Signing",
    statusCode: "SUBMIT_SIGN",
  });
});
it("denies a contract without its summary grant before reading the record", async () => {
  state.answers.getSecurityUser_roles = grants("contracts-history");
  await expect(loadContract("1300")).rejects.toMatchObject({
    code: "FORBIDDEN",
  });
  expect(ops()).not.toContain("getContractsContract_id");
  expect(
    state.oracle.mock.calls.find(([op]) => op === "getSecurityUser_roles")?.[1],
  ).toMatchObject({ p_obj_type: "CONTRACT", p_obj_id: "1300" });
});
it("rejects a different contract returned after an authorized role check", async () => {
  state.answers.getSecurityUser_roles = grants("contracts-summary");
  state.answers.getContractsContract_id = contract({ contract_id: 1301 });
  await expect(loadContract("1300")).rejects.toMatchObject({
    code: "FORBIDDEN",
  });
});
it("denies a Contract outside the person's organization scope", async () => {
  state.answers.getSecurityUser_roles = grants("contracts-summary");
  state.answers.getContractsContract_id = contract({ org_id: 999 });
  await expect(loadContract("1300")).rejects.toMatchObject({
    code: "FORBIDDEN",
  });
});
it("reads the Contract audit through the shared panel, with its page key and NEW VERSION CREATED", async () => {
  state.answers.getSecurityUser_roles = grants(
    "contracts-summary",
    "contracts-delegation",
  );
  state.answers.getSharedGetObjectAudits2 = {
    items: [{ event: "NEW VERSION CREATED", field_values: [] }],
  };
  const q = panel("contracts-delegation");
  q.set("event", "NEW VERSION CREATED");
  await expect(auditView(q)).resolves.toMatchObject({
    items: [{ event: "NEW VERSION CREATED" }],
  });
  expect(
    state.oracle.mock.calls.find(
      ([op]) => op === "getSharedGetObjectAudits2",
    )?.[1],
  ).toMatchObject({
    p_page_name: "contracts-delegation",
    p_event: "NEW VERSION CREATED",
  });
  q.set("event", "APPROVED");
  await expect(auditView(q)).rejects.toMatchObject({ code: "BAD_REQUEST" });
});
