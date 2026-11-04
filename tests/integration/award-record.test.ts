import { beforeEach, describe, expect, it, vi } from "vitest";
const state = vi.hoisted(() => ({ calls: vi.fn(), writes: vi.fn() }));
vi.mock("@/server/identity/session/service", () => ({
  authenticate: async () => ({
    session: { token: "isolated-token" },
    user: {
      personId: "101",
      organizationId: "202",
      legalId: "77",
      modules: { AWARDS: true },
    },
  }),
}));
const erpFlow = vi.hoisted(() => vi.fn());
vi.mock("@/server/oic/api/catalogue", () => ({
  getIcApiIntegrationV1FlowsRestUNIT4_MAIN_FLOW1_0Unit4integration: erpFlow,
}));
vi.mock("@/server/oracle/connection", () => ({
  oracle: state.calls,
  oracleWrite: state.writes,
}));
import {
  awardRecordRead,
  awardSetFinalized,
} from "@/server/modules/awards/record";
import { saveBudgetPeriod } from "@/server/modules/awards/record/budget";
import { creatorCard } from "@/server/modules/awards/record/creator";
import { saveCredit } from "@/server/modules/awards/record/credit";
import { sendToErp } from "@/server/modules/awards/record/erp";
import { installmentsView } from "@/server/modules/awards/record/installments";
import { forget } from "@/server/oracle/cache";
import {
  cloneCost,
  deleteCost,
  saveCost,
  saveCostPeriod,
  saveGlobalCosts,
  saveProject,
  saveTeamMember,
} from "@/server/modules/awards/record/projects";

const role = (
  page_name: string,
  page_id: number,
  edit = "Y",
  remove = "Y",
) => ({
  page_id,
  page_name,
  read_access: "Y",
  edit_access: edit,
  delete_access: remove,
});
const line = (over: Record<string, unknown> = {}) => ({
  id: 501,
  project_id: 31,
  funding_section_lkp_code: "DIRECT",
  cost_category_type_lkp_code: "MATERIALS",
  costing_group_id: 9,
  award_project_link_id: 41,
  cost_start_date: "2026-01-01",
  cost_end_date: "2026-12-31",
  sponsor_contribution: 100,
  instituition_contribution: 0,
  total_cost: 100,
  is_editable: 1,
  ...over,
});
/** One award's reads, overridable per operation. */
function reads(over: Record<string, unknown> = {}) {
  return async (op: string) => {
    if (op in over) return over[op];
    if (op === "getSecurityUser_roles")
      return {
        items: [
          role("awards-header", 1),
          role("awards-budget-periods", 6),
          role("awards-projects", 2),
          role("awards-projects-add-project", 3),
          role("awards-projects-add-project-cost", 4),
          role("awards-projects-add-project-teammember", 5),
        ],
      };
    if (op === "getPost_awardsAwardDetails")
      return {
        award_id: Number(current),
        proposal_id: 12,
        award_status: "DRFT",
        is_editable: 1,
        award_start_date: "2026-01-01",
        award_end_date: "2027-12-31",
        "Award Projects": [
          {
            project_id: 31,
            award_project_link_id: 41,
            project_name: "P",
            project_number: "PRJ_31",
            is_editable: 1,
          },
        ],
        "Award ProjectsTeam Members": [
          {
            team_member_id: 61,
            person_id: 101,
            project_id: 31,
            is_editable: 0,
          },
        ],
        "Award Project Cost Line": [line(), line({ id: 502, is_editable: 0 })],
        "Award Budget Periods": [
          {
            budget_period: "BP_1",
            budget_period_type: "Monthly",
            cost_start_date: "2026-01-01",
            cost_end_date: "2026-06-30",
            is_editable: 0,
          },
        ],
      };
    if (op === "getSharedLabels") return [];
    if (op === "getPre_awardGetLkpOrgUnitType")
      return { items: [{ org_unit_id: 5, org_unit_name: "Faculty" }] };
    if (op === "getProposalGetLockStatus")
      return { status: "UNLOCK", lock_module_id: null };
    if (op === "getPre_awardGetPersonList")
      return { items: [{ person_id: 101, full_name: "Alex Morgan" }] };
    return { items: [] };
  };
}
// The context is cached per request; each test gets its own award id.
let current = 700;
const next = () => String(++current);
const written = () => state.writes.mock.calls.map((c) => [c[0], c[2]]);
const cost = {
  level: "LINE",
  lineId: null,
  projectId: "31",
  section: "",
  category: "",
  itemId: "",
  personId: "",
  roleId: "",
  unitType: "",
  units: null,
  hours: null,
  months: null,
  description: "Parts",
  glNominal: "",
  start: "2026-02-01",
  end: "2026-03-01",
  sponsor: 60,
  institution: 40,
  total: 100,
};
const project = {
  id: "",
  name: "New",
  managerEmail: "",
  orgId: "",
  start: "",
  end: "",
  intellectualProperty: "",
  researchLocation: "",
  researchOffice: "",
  enteredBy: "",
  creditReceiver: "",
  conflict: "",
  conflictDetails: "",
};
beforeEach(() => {
  state.calls.mockReset().mockImplementation(reads());
  state.writes.mockReset().mockResolvedValue({});
});

describe("award projects writes", () => {
  it("adds a project with the award's ids and the contract's spelling", async () => {
    const id = next();
    await saveProject(id, {
      ...project,
      orgId: "5",
      start: "2026-02-01",
      end: "2026-06-30",
      intellectualProperty: "IP",
      creditReceiver: "Dept",
    });
    expect(written()).toEqual([
      [
        "postPost_awardsAwardProjects",
        expect.objectContaining({
          ProjectName: "New",
          AwardID: Number(id),
          ProposalID: 12,
          CreditReciever: "Dept",
        }),
      ],
    ]);
  });
  it("refuses any change outside a draft, and while the page is locked", async () => {
    state.calls.mockImplementation(
      reads({
        getPost_awardsAwardDetails: {
          award_id: current + 1,
          award_status: "AIA",
          is_editable: 1,
        },
      }),
    );
    await expect(saveProject(next(), project)).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    state.calls.mockImplementation(
      reads({ getProposalGetLockStatus: { status: "LOCK" } }),
    );
    await expect(
      saveGlobalCosts(next(), { sponsor: 1, institution: 0, total: 1 }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(state.writes).not.toHaveBeenCalled();
  });
  it("refuses dates outside the award and an institution share above the total", async () => {
    await expect(
      saveProject(next(), { ...project, start: "2025-12-31" }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await expect(
      saveGlobalCosts(next(), { sponsor: 0, institution: 200, total: 100 }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(state.writes).not.toHaveBeenCalled();
  });
  it("refuses a team member the award does not let be edited", async () => {
    await expect(
      saveTeamMember(next(), {
        id: "61",
        personId: "101",
        projectId: "31",
        roleId: "",
        start: "",
        end: "",
      }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
  it("adds a cost line without an ID, and refuses a line it cannot edit", async () => {
    await saveCost(next(), cost);
    const [[op, body]] = written();
    expect(op).toBe("postPost_awardsAwardPrjCostItem");
    expect(body).not.toHaveProperty("ID");
    expect(body).toMatchObject({
      AwardProjectLinkId: 41,
      ProjectID: 31,
      TotalCost: 100,
    });
    await expect(
      saveCost(next(), { ...cost, level: "CATEGORY", lineId: 502 }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
  it("splits a category through the cost-line operation", async () => {
    await saveCost(next(), { ...cost, level: "CATEGORY", lineId: 501 });
    expect(written()).toEqual([
      [
        "postAwardPrjCostLine",
        expect.objectContaining({
          COST_CATEGORY_TYPE: "MATERIALS",
          FUNDING_SECTION_LKP_CODE: "DIRECT",
          costing_group_id: null,
        }),
      ],
    ]);
  });
  it("sends a period's hours and months and keeps it inside its line", async () => {
    const period = {
      lineId: 501,
      itemId: 800,
      start: "2026-02-01",
      end: "2026-02-28",
      unitType: "",
      quantity: 2,
      hours: 5,
      months: 1,
      sponsor: 10,
      institution: 0,
      total: 10,
    };
    await saveCostPeriod(next(), period);
    expect(written()[0][1]).toMatchObject({
      ID: 800,
      Units: 2,
      project_hours: 5,
      project_months: 1,
      costing_group_id: 9,
    });
    await expect(
      saveCostPeriod(next(), { ...period, end: "2027-01-31" }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });
  it("deletes a whole line by its costing group and clones from its first item", async () => {
    await deleteCost(next(), { lineId: 501 });
    await cloneCost(next(), { lineId: 501 });
    expect(state.writes.mock.calls.map((c) => [c[0], c[1]])).toEqual([
      [
        "deletePost_awardsAwardPrjCostItem",
        expect.objectContaining({ p_costing_group_id: "9" }),
      ],
      [
        "postPost_awardsCopyAwardPrjCostItem",
        expect.objectContaining({ p_award_cost_item_id: "501" }),
      ],
    ]);
    await expect(deleteCost(next(), { lineId: 999 })).rejects.toMatchObject({
      code: "BAD_REQUEST",
    });
  });
});

describe("award record access and other writes", () => {
  it("denies an award without header read before reading it", async () => {
    state.calls.mockImplementation(
      reads({ getSecurityUser_roles: { items: [role("awards-projects", 2)] } }),
    );
    await expect(awardRecordRead(next(), "projects")).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    expect(state.calls.mock.calls.map((c) => c[0])).not.toContain(
      "getPost_awardsAwardDetails",
    );
  });
  it("denies a tab without read", async () => {
    await expect(awardRecordRead(next(), "report")).rejects.toMatchObject({
      code: "FORBIDDEN",
      message: "You do not have access to this page.",
    });
  });
  it("refuses to edit a budget period the award marks not editable", async () => {
    await expect(
      saveBudgetPeriod(next(), {
        key: "BP_1",
        start: "2026-01-01",
        end: "2026-06-30",
        direct: 1,
        indirect: 0,
        sponsor: 1,
        institution: 0,
        total: 1,
      }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(state.writes).not.toHaveBeenCalled();
  });
  it("finalizes only a finalizable page, with the page id from Oracle", async () => {
    await expect(
      awardSetFinalized(next(), { tab: "projects", finalize: true }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    state.calls.mockImplementation(
      reads({
        getSharedFinalizablePages: {
          items: [{ page_name: "awards-projects" }],
        },
      }),
    );
    await awardSetFinalized(next(), { tab: "projects", finalize: true });
    expect(written()).toEqual([
      [
        "postProposalInsertModuleLock",
        expect.objectContaining({
          page_id: 2,
          status: "FINALIZE",
          module_name: "AWARD",
        }),
      ],
    ]);
  });
});

describe("award creator card", () => {
  // The creator comes from the held person list, so each test starts without it.
  beforeEach(() => forget(""));
  // 9412: the card is the award's created_by, not its PI.
  const withPi = (over: Record<string, unknown>) => {
    const base = reads(over);
    return async (op: string) => {
      if (op === "getPost_awardsAwardDetails")
        return {
          award_id: Number(current),
          award_status: "DRFT",
          pi_pid: 202,
          created_by: 101,
        };
      return base(op);
    };
  };
  it("reads the creator's card with their own org, as legacy getContactDetails", async () => {
    state.calls.mockImplementation(
      withPi({
        getPre_awardGetPersonListAll: {
          items: [
            { person_id: 101, org_unit_id: 5, full_name: "Alex" },
            { person_id: 202, org_unit_id: 6, full_name: "PI" },
          ],
        },
        getProposalContactDtls: {
          items: [{ full_name: "Dr Alex", email_address: "a@x.test" }],
        },
      }),
    );
    const card = await creatorCard(next());
    const call = state.calls.mock.calls.find(
      (c) => c[0] === "getProposalContactDtls",
    );
    expect(call?.[1]).toMatchObject({
      p_person_id: "101",
      p_dept_id: "5",
      p_record_type: "PI",
    });
    expect(card.fields.map((f) => f.value)).toEqual([
      "Dr Alex",
      "",
      "a@x.test",
      "",
      "",
      "",
      "",
    ]);
  });
  it("opens empty without reading when the creator's org is unknown", async () => {
    state.calls.mockImplementation(withPi({}));
    const card = await creatorCard(next());
    expect(card.fields.every((f) => f.value === "")).toBe(true);
    expect(state.calls.mock.calls.map((c) => c[0])).not.toContain(
      "getProposalContactDtls",
    );
  });
  it("is denied without header read, before any card is read", async () => {
    state.calls.mockImplementation(
      withPi({
        getSecurityUser_roles: { items: [role("awards-projects", 2)] },
      }),
    );
    await expect(creatorCard(next())).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    expect(state.calls.mock.calls.map((c) => c[0])).not.toContain(
      "getProposalContactDtls",
    );
  });
});

describe("award installments", () => {
  const withRole = (edit: string) =>
    reads({
      getSecurityUser_roles: {
        items: [role("awards-header", 1), role("awards-installments", 9, edit)],
      },
    });
  it("lets a draft's unlocked page be changed only with its edit right (legacy ignored both)", async () => {
    state.calls.mockImplementation(withRole("Y"));
    expect((await installmentsView(next())).canEdit).toBe(true);
    state.calls.mockImplementation(withRole("N"));
    expect((await installmentsView(next())).canEdit).toBe(false);
  });
  it("reads the award's cost lines for the proration and writes nothing", async () => {
    state.calls.mockImplementation(withRole("Y"));
    const view = await installmentsView(next());
    expect(view.lines.map((l) => l.sponsor_contribution)).toEqual([100, 100]);
    expect(view.projects).toEqual([
      { project_id: 31, project_number: "PRJ_31", project_name: "P" },
    ]);
    expect(state.writes).not.toHaveBeenCalled();
  });
});

describe("award credit allocation", () => {
  const credit = (id: number, pct: number) => ({
    credit_alloc_id: id,
    employee_name: "Alex",
    project_role: "Principal Investigator",
    credit_pct: pct,
    project_effort: 1,
  });
  const award = (edit = "Y", rows = [credit(71, 0.6), credit(72, 0.4)]) => {
    const base = reads({
      getSecurityUser_roles: {
        items: [
          role("awards-header", 1),
          role("awards-credit-allocation", 8, edit),
        ],
      },
    });
    return async (op: string) =>
      op === "getPost_awardsAwardDetails"
        ? {
            award_id: Number(current),
            award_status: "DRFT",
            proposal_period_version_id: 12098,
            "Award Credit Allocation": rows,
          }
        : base(op);
  };
  beforeEach(() => state.writes.mockReset());
  it("posts the one row's fractions on the award's proposal period version", async () => {
    state.calls.mockImplementation(award());
    await saveCredit(next(), { id: "71", credit: 0.5, effort: 0.8 });
    expect(state.writes.mock.calls[0][0]).toBe("postProposalCreditAllocation");
    expect(state.writes.mock.calls[0][1]).toMatchObject({
      p_prop_period_version_id: "12098",
    });
    expect(state.writes.mock.calls[0][2]).toEqual([
      { credit_alloc_id: 71, credit_pct: 0.5, prj_effort: 0.8 },
    ]);
  });
  it("refuses credit over 100%, an unknown row, a value above 100% and a page without edit", async () => {
    state.calls.mockImplementation(award());
    await expect(
      saveCredit(next(), { id: "71", credit: 0.7, effort: 1 }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await expect(
      saveCredit(next(), { id: "99", credit: 0.1, effort: 1 }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await expect(
      saveCredit(next(), { id: "71", credit: 1.5, effort: 1 }),
    ).rejects.toThrow();
    state.calls.mockImplementation(award("N"));
    await expect(
      saveCredit(next(), { id: "71", credit: 0.5, effort: 1 }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(state.writes).not.toHaveBeenCalled();
  });
  it("accepts 0.1 + 0.2 + 0.7 as exactly 100%", async () => {
    state.calls.mockImplementation(
      award("Y", [credit(71, 0.1), credit(72, 0.2), credit(73, 0.5)]),
    );
    await saveCredit(next(), { id: "73", credit: 0.7, effort: 1 });
    expect(state.writes).toHaveBeenCalledTimes(1);
  });
});

describe("award send to ERP", () => {
  const award = (
    status: string,
    target: Record<string, unknown> = {
      erp_type: "UNIT4",
      oic_endpoint: "/UNIT4_ERP_FLOW/1.0/unit4integration",
    },
  ) => {
    const base = reads();
    return async (op: string) =>
      op === "getPost_awardsAwardDetails"
        ? { award_id: Number(current), award_status: status }
        : op === "getSharedCustErpDetails2"
          ? target
          : base(op);
  };
  beforeEach(() => {
    erpFlow.mockReset();
    erpFlow.mockResolvedValue({ Status: "Award sent" });
  });
  it("posts the award to the configured flow, server to server, and returns its status", async () => {
    state.calls.mockImplementation(award("IA"));
    const id = next();
    await expect(sendToErp(id)).resolves.toEqual({ status: "Award sent" });
    expect(erpFlow).toHaveBeenCalledWith({
      flow: "UNIT4_ERP_FLOW",
      version: "1.0",
      resource: "unit4integration",
      body: { AwardId: Number(id), Token: "isolated-token" },
    });
  });
  it("refuses an award that is not internally approved, an unknown ERP and an address outside the flows", async () => {
    state.calls.mockImplementation(award("DRFT"));
    await expect(sendToErp(next())).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    state.calls.mockImplementation(award("IA", { erp_type: "SAP" }));
    await expect(sendToErp(next())).rejects.toMatchObject({
      code: "BUSINESS",
    });
    state.calls.mockImplementation(
      award("IA", { erp_type: "UNIT4", oic_endpoint: "/../admin/1.0/x" }),
    );
    await expect(sendToErp(next())).rejects.toMatchObject({
      code: "CONTRACT",
    });
    state.calls.mockImplementation(
      award("IA", {
        erp_type: "ORACLE",
        oic_endpoint: "https://evil.example/x/1.0/y",
      }),
    );
    await expect(sendToErp(next())).rejects.toMatchObject({
      code: "CONTRACT",
    });
    expect(erpFlow).not.toHaveBeenCalled();
  });
});
