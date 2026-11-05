import { beforeEach, expect, it, vi } from "vitest";
const state = vi.hoisted(() => ({
  roles: [] as {
    page_name: string;
    read_access: string;
    edit_access: string;
    delete_access: string;
  }[],
  summary: {} as Record<string, unknown>,
  funds: [] as Record<string, unknown>[],
  documents: [] as Record<string, unknown>[],
  calls: [] as string[],
  saved: [] as unknown[],
}));
vi.mock("@/server/identity/session/service", () => ({
  authenticate: async () => ({
    session: { token: "t" },
    user: {
      organizationId: "202",
      modules: { "claims-group": true, "claims-unit-inquiry": true },
    },
  }),
}));
vi.mock("@/server/platform/configuration/resources", () => ({
  resources: async () => [],
}));
vi.mock("@/server/oracle/api", () => ({
  roles: { record: async () => ({ items: state.roles }) },
  lookups: {
    codes: async () => ({
      items: [{ lookup_code: "ORG", lookup_code_value: "Organization Chart" }],
    }),
  },
  claims: {
    appSummary: async () => ({ items: [state.summary] }),
    appFundSummary: async () => ({ items: state.funds }),
    stakeholders: async () => {
      state.calls.push("stakeholders");
      return { items: [] };
    },
    meetings: async () => ({ items: [] }),
    documents: async () => ({ items: state.documents }),
    saveAppSummary: async (p: { body: unknown }) => {
      state.saved.push(p.body);
      return {};
    },
  },
}));
import { unitRecordContext } from "@/server/modules/claims/units/record";
import {
  saveAppSummary,
  unitSummaryView,
} from "@/server/modules/claims/units/record/summary";
import { signOffList } from "@/server/modules/claims/units/record/sign-off";
import { serverFunctions } from "@/server/functions";

const row = (page: string, read = "Y") => ({
  page_name: page,
  read_access: read,
  edit_access: "N",
  delete_access: "N",
});
beforeEach(() => {
  state.roles = [row("claims-unit-summary")];
  state.summary = { app_id: 1130, unit_id: 202, fy_code: 2037 };
  state.funds = [];
  state.documents = [];
  state.calls = [];
  state.saved = [];
});

it("opens an application only with Summary read (legacy vbBeforeEnter), fail closed", async () => {
  await expect(unitRecordContext("1130")).resolves.toMatchObject({
    tabs: ["summary"],
  });
  state.roles = [row("claims-unit-summary", "N")];
  await expect(unitRecordContext("1131")).rejects.toMatchObject({
    code: "FORBIDDEN",
  });
  state.roles = [];
  await expect(unitRecordContext("1132")).rejects.toMatchObject({
    code: "FORBIDDEN",
  });
  await expect(unitRecordContext("12x")).rejects.toMatchObject({
    code: "BAD_REQUEST",
  });
});

it("sums the fund columns as legacy summaryTotals (null adds 0) and keeps legacy's period split", async () => {
  state.funds = [
    {
      app_fund_id: 1,
      full_fund_display: "TITLE I",
      original_allocation: 18500,
      total_budget: 18500,
      unapplied_balance: null,
      grant_period: "2026-07-01~~2027-06-30",
    },
    {
      app_fund_id: 2,
      full_fund_display: "TITLE III",
      original_allocation: "10000",
      total_budget: 10000,
      unapplied_balance: 10000,
      grant_period: "~~",
    },
    { app_fund_id: 3, full_fund_display: "TITLE IV", grant_period: null },
  ];
  const view = await unitSummaryView("1140");
  const fs = view.fundSummary;
  expect(fs.totals).toMatchObject({
    original: 28500,
    budget: 28500,
    unapplied: 10000,
    pending: 0,
  });
  expect(fs.rows.map((r) => r.period)).toEqual([
    ["2026-07-01", "2027-06-30"],
    ["", ""],
    null,
  ]);
  expect(fs.rows[2]).toMatchObject({ original: null, budget: null });
});

it("shows Network Chief only for a CONTRACT unit, and the people as text", async () => {
  state.summary = {
    ...state.summary,
    program_preparer_name: "Ada",
    school_admin_sign_date: "2026-07-16T00:00:00Z",
    unit_category: null,
  };
  const plain = await unitSummaryView("1150");
  expect(plain.signedOff.fields.map((f) => f.key)).not.toContain(
    "network-chief",
  );
  expect(plain.preparer.fields[0]).toMatchObject({ value: "Ada" });
  expect(
    plain.signedOff.fields.find((f) => f.key === "school-admin-sign-date"),
  ).toMatchObject({ date: true, value: "2026-07-16T00:00:00Z" });
  state.summary = { ...state.summary, unit_category: "CONTRACT" };
  const contract = await unitSummaryView("1151");
  expect(contract.signedOff.fields.map((f) => f.key)).toContain(
    "network-chief",
  );
});

it("reads one sign-off list per request; refuses an unknown one; a document type shows its lookup name", async () => {
  await expect(signOffList("1160", "audits")).rejects.toMatchObject({
    code: "BAD_REQUEST",
  });
  await signOffList("1160", "stakeholders");
  expect(state.calls).toEqual(["stakeholders"]);
  state.documents = [
    { doc_id: 1, document_type_code: "ORG", description: "Chart" },
    { doc_id: 2, document_type_code: "GONE", description: "Old" },
  ];
  const docs = await signOffList("1160", "documents");
  expect(docs.rows.map((r) => r.cells["document-type"])).toEqual([
    "Organization Chart",
    "",
  ]);
});

it("decodes an entity-encoded RB description as legacy renderAsHTML, and keeps real markup", () => {
  const rows = (text: string) => [
    {
      module_name: "claims",
      label_type: "description",
      label_name: "note",
      label_value: "Note",
      label_description: text,
    },
  ];
  const describe = (text: string) =>
    serverFunctions.resources.resourceDescription(
      rows(text) as never,
      "claims",
      "description",
      "note",
    );
  expect(describe("&lt;p&gt;Approval &amp;amp; sign-off&lt;/p&gt;")).toBe(
    "<p>Approval &amp; sign-off</p>",
  );
  expect(describe("<p>Kept &lt;b&gt;</p>")).toBe("<p>Kept &lt;b&gt;</p>");
  expect(describe("&lt;img src=x onerror=alert(1)&gt;")).toBe("<img>");
});

const FILLED = {
  program_preparer_name: "Ada",
  program_preparer_title: "Coordinator",
  program_preparer_email: "ada@example.test",
  program_preparer_phone: "0100",
  cfo_controller_name: "Grace",
  cfo_controller_email: "grace@example.test",
  cfo_controller_phone: "0200",
  school_admin_name: "Admin",
  school_admin_sign_date: "2026-07-16",
  board_member_name: "Board",
  board_member_sign_date: "2026-07-17",
  parent_rep_name: "Parent",
  parent_rep_sign_date: "2026-07-18",
};

it("saves the row as read with the edits (an explicit pick); an unchanged date keeps its stored value", async () => {
  state.roles = [
    row("claims-unit-summary"),
    { ...row("unit-summary-edit"), edit_access: "Y" },
  ];
  state.summary = {
    app_id: 1065,
    unit_id: 13507,
    fy_code: 2027,
    program_type_code: "SCHOOLWIDE",
    school_admin_sign_date: "2026-07-16T00:00:00Z",
    stray_column: "never sent",
  };
  await saveAppSummary("1170", {
    values: { ...FILLED, network_chief_name: "Ignored" },
  });
  expect(state.saved[0]).toMatchObject({
    app_id: 1065,
    program_type_code: "SCHOOLWIDE",
    program_preparer_name: "Ada",
    school_admin_sign_date: "2026-07-16T00:00:00Z",
    board_member_sign_date: "2026-07-17",
  });
  // Network Chief is only a CONTRACT unit's field; unknown columns are never sent.
  expect(state.saved[0]).not.toHaveProperty("stray_column");
  expect(
    (state.saved[0] as Record<string, unknown>).network_chief_name,
  ).toBeUndefined();
});

it("refuses Save without the edit right (legacy tested only that the role row exists), an empty field or a bad body", async () => {
  state.roles = [row("claims-unit-summary"), row("unit-summary-edit")];
  await expect(
    saveAppSummary("1180", { values: FILLED }),
  ).rejects.toMatchObject({
    code: "FORBIDDEN",
  });
  state.roles = [
    row("claims-unit-summary"),
    { ...row("unit-summary-edit"), edit_access: "Y" },
  ];
  await expect(
    saveAppSummary("1181", {
      values: { ...FILLED, cfo_controller_phone: " " },
    }),
  ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  await expect(
    saveAppSummary("1182", {
      values: { ...FILLED, school_admin_sign_date: "16/07/2026" },
    }),
  ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  await expect(
    saveAppSummary("1183", { values: { ...FILLED, app_id: "1" } }),
  ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  // A CONTRACT unit requires Network Chief.
  state.summary = { ...state.summary, unit_category: "CONTRACT" };
  await expect(
    saveAppSummary("1184", { values: FILLED }),
  ).rejects.toMatchObject({
    code: "BAD_REQUEST",
  });
  expect(state.saved).toEqual([]);
});
