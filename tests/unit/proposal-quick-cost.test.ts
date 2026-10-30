import { beforeEach, expect, it, vi } from "vitest";

const oracle = vi.hoisted(() => ({
  summary: vi.fn(),
  fundingSections: vi.fn(),
  projectRoles: vi.fn(),
  costItems: vi.fn(),
  insertCostingBulk: vi.fn(),
  insertCostingHeader: vi.fn(),
  saveCostingLines: vi.fn(),
  codes: vi.fn(),
  inOrg: vi.fn(),
  page: vi.fn(),
}));
vi.mock("@/server/oracle/api", () => ({
  proposals: oracle,
  lookups: { codes: oracle.codes },
  people: { inOrg: oracle.inOrg },
}));
vi.mock("@/server/modules/proposals/record", () => ({
  proposalPage: oracle.page,
}));

import { saveQuickCost } from "@/server/modules/proposals/quick-cost";

const access = new Map(
  [
    "proposals-budget",
    "quick-costing",
    "proposals-budget-staff",
    "proposals-budget-non-staff",
    "proposals-budget-collab",
  ].map((name) => [name, { read: true, edit: true }]),
);
const row = {
  section: "DA",
  category: "STAFF",
  item: "PI",
  description: "",
  personId: 101,
  startDate: "2026-10-01",
  endDate: "2027-09-30",
  units: 1,
  cost: null,
};

beforeEach(() => {
  vi.resetAllMocks();
  oracle.page.mockResolvedValue({
    access,
    pageIds: new Map([["proposals-budget", 40]]),
    rights: { read: true, edit: true },
    summary: { lockedPageIds: [] },
  });
  oracle.summary.mockResolvedValue({
    proposal_id: 1001,
    proposal_status: "DRFT",
    proposal_period_version_id: 12113,
    cost_model: 338,
    proposal_start_date: "01-Oct-2026",
    proposal_end_date: "30-Sep-2027",
    currency_code: "GBP",
    departments: [{ org_unit_id: 202 }],
  });
  oracle.fundingSections.mockResolvedValue({
    items: [{ lookup_code: "DA", lookup_code_value: "Directly Allocated" }],
  });
  oracle.projectRoles.mockResolvedValue({
    items: [
      { project_role_code: "PI", project_role_name: "Principal investigator" },
    ],
  });
  oracle.costItems.mockResolvedValue({
    items: [
      {
        cost_category_type_lkp_code: "EQUIP",
        cost_item_lkp_code: "EQ",
        cost_item_desc: "Equipment",
      },
    ],
  });
  oracle.codes.mockResolvedValue({
    items: [
      {
        lookup_type_code: "COST_CATEGORY_TYPES",
        lookup_code: "STAFF",
        lookup_code_value: "Staff",
      },
      {
        lookup_type_code: "COST_CATEGORY_TYPES",
        lookup_code: "EQUIP",
        lookup_code_value: "Equipment",
      },
    ],
  });
  oracle.inOrg.mockResolvedValue({
    items: [
      {
        person_id: 101,
        full_name: "Alex Morgan",
        employee_number: "EMP101",
        org_unit_id: 202,
        costing_allowed_flag: "Y",
      },
    ],
  });
  oracle.insertCostingBulk.mockResolvedValue({});
  oracle.insertCostingHeader.mockResolvedValue({
    costing_line_json: [
      { costing_header_id: 500, costing_line_id: 501, costmodel_id: 338 },
    ],
  });
  oracle.saveCostingLines.mockResolvedValue({});
});

it("sends only the source-backed staff bulk fields and verified person", async () => {
  await saveQuickCost("PROPOSAL", "1001", {
    kind: "staff",
    versionId: 12113,
    rows: [row],
  });
  expect(oracle.insertCostingBulk).toHaveBeenCalledWith({
    rows: [
      {
        APP_COST_MODEL: 338,
        COST_CATEGORY_ITEM_LKP_CODE: "PI",
        COST_CATEGORY_LKP_CODE: "STAFF",
        EMPLOYEE_NUMBER: "EMP101",
        END_DATE: "2027-09-30",
        FUNDING_SECTION_HEADER_LKP_CODE: "DA",
        UNITS: 1,
        ITEM_DESCRIPTION: "Alex Morgan",
        ORG_UNIT_ID: 202,
        PERSON_ID: 101,
        PROJECT_ROLE_LKP_CODE: "PI",
        PROPOSAL_ID: 1001,
        PROPOSAL_PERIOD_VERSION_ID: 12113,
        START_DATE: "2026-10-01",
        SAL_MODEL_FIELDS: {},
        INDIRECT_COST_FIELDS: {},
      },
    ],
  });
});

it("uses the VBCS nonstaff header and costing line sequence", async () => {
  await saveQuickCost("PROPOSAL", "1001", {
    kind: "non-staff",
    versionId: 12113,
    rows: [
      {
        ...row,
        category: "EQUIP",
        item: "EQ",
        description: "Microscope",
        personId: null,
        cost: 10,
        units: 2,
      },
    ],
  });
  expect(oracle.insertCostingHeader).toHaveBeenCalledWith({
    body: expect.objectContaining({
      SALARY_MODEL_LKP_CODE: "NON_SAL",
      COST_CATEGORY_ITEM_LKP_CODE: "EQ",
      UNIT_COST: 10,
    }),
  });
  expect(oracle.saveCostingLines).toHaveBeenCalledWith({
    rows: [
      expect.objectContaining({
        costing_header_id: 500,
        cost_type: "NON_STAFF",
        baseline_cost: 20,
      }),
    ],
  });
  expect(oracle.insertCostingBulk).not.toHaveBeenCalled();
});

it("rejects a stale version before a write", async () => {
  await expect(
    saveQuickCost("PROPOSAL", "1001", {
      kind: "staff",
      versionId: 12112,
      rows: [row],
    }),
  ).rejects.toThrow("cannot be edited");
  expect(oracle.insertCostingBulk).not.toHaveBeenCalled();
});
