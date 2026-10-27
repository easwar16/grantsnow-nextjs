import { afterEach, beforeEach, expect, it, vi } from "vitest";
const state = vi.hoisted(() => ({
  app: undefined as unknown,
  save: vi.fn(),
  destroy: vi.fn(),
  calls: vi.fn(),
  oracleWrite: vi.fn(),
  roles: [] as { page_name: string; read_access: string }[],
}));
vi.mock("@/server/identity/session/storage", () => ({
  storage: async () => state,
}));
vi.mock("@/server/oracle/connection", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  oracle: state.calls,
  oracleWrite: state.oracleWrite,
}));
import { GET, POST } from "@/app/api/awards/actions/[action]/route";
import { GET as list } from "@/app/api/awards/route";
import { forgetValidation } from "@/server/identity/session/service";
import { forget } from "@/server/oracle/cache";
import { fixtureUser } from "@/test-support/fixtures";

const TOKEN = "awards-actions-token";
const origin = "http://127.0.0.1:3000";
const post = (action: string, body: unknown) =>
  POST(
    new Request(`${origin}/api/awards/actions/${action}`, {
      method: "POST",
      headers: { "content-type": "application/json", origin },
      body: JSON.stringify(body),
    }),
    { params: Promise.resolve({ action }) },
  );
const get = (action: string, query = "") =>
  GET(new Request(`${origin}/api/awards/actions/${action}?${query}`), {
    params: Promise.resolve({ action }),
  });
const writes = () => state.oracleWrite.mock.calls.map((c) => c[0]);
const award = (proposal_id: number | null) => ({
  items: [{ award_id: 7, proposal_id }],
});
let awardRow = award(12);
let hierarchyCount = 0;

beforeEach(() => {
  forgetValidation(TOKEN);
  forget("");
  vi.stubEnv("APP_ORIGIN", origin);
  vi.stubEnv("FIXTURE_MODE", "false");
  vi.stubEnv("WRITES_ENABLED", "true");
  state.app = {
    token: TOKEN,
    subject: "test-sub",
    expiresAt: Date.now() + 600000,
    identityExpiresAt: Date.now() + 1200000,
    fixture: false,
  };
  state.roles = [{ page_name: "award-clone", read_access: "Y" }];
  awardRow = award(12);
  hierarchyCount = 0;
  state.oracleWrite.mockReset().mockResolvedValue({ award_id: 99 });
  state.calls.mockReset();
  state.calls.mockImplementation(async (op: string) => {
    switch (op) {
      case "getSessionValidate":
        return {
          ...fixtureUser,
          token: TOKEN,
          expiry_datetime: new Date(Date.now() + 600000).toISOString(),
        };
      case "getSharedLabels":
        return [];
      case "getSecurityUser_roles":
        return { items: state.roles };
      case "getContractsGetRelationItem":
        return {
          items: [{ object_id: 12, object_number: "P_12", object_title: "T" }],
        };
      case "getPre_awardGetPersonList":
        return {
          items: [
            {
              person_id: 101,
              full_name: "Alex Morgan",
              org_unit_id: 202,
              org_unit_name: "Faculty",
            },
          ],
        };
      case "GetSponsorList":
        return { items: [{ sponsor_party_id: 301, party_name: "UKRI" }] };
      case "getPre_awardGetLookupTypesCodes":
        return {
          items: [{ lookup_type_code: "CURRENCY_CODES", lookup_code: "GBP" }],
        };
      case "getPost_awardsAwardhierarchy":
        return { count: hierarchyCount };
      case "getPost_awardsAwardHeader":
        return awardRow;
      case "getPost_awardsCopyAwardObjList":
        return {
          items: [
            { r: "award-header", d: "Header", default_value: true },
            { r: "award-projects", d: "Projects" },
          ],
        };
      case "getSharedObjectLinked2":
        return { ObjectLinks: null };
      case "getSharedGetObjectAttributes":
        return { fields: [] };
      case "getPost_awardsAdvancedSearch":
        return {
          items: [{ award_id: 7, award_number: "AW_7", attribute_1: "x" }],
          total_count: 1,
        };
      default:
        throw new Error(`Unexpected ${op}`);
    }
  });
});
afterEach(() => vi.unstubAllEnvs());

const draft = {
  proposalId: null,
  piId: 101,
  sponsorId: 301,
  fullTitle: "Full",
  name: "Name",
  start: "2026-10-01",
  end: "2027-09-30",
  amount: 400,
  currency: "GBP",
  period: 3,
};

it("posts the legacy PascalCase header without a proposal, the org unit taken from the PI", async () => {
  expect((await post("create", draft)).status).toBe(200);
  expect(writes()).toEqual(["postPost_awardsAwardHeader"]);
  expect(state.oracleWrite.mock.calls[0][2]).toEqual({
    AwardAmount: 400,
    AwardEndDate: "2027-09-30",
    AwardName: "Name",
    AwardStartDate: "2026-10-01",
    Currency: "GBP",
    FullTitle: "Full",
    OrgID: 202,
    Period: 3,
    PIPID: 101,
    SponsorId: 301,
  });
});

it("generates the primary award from a proposal that has none, otherwise posts the header", async () => {
  expect((await post("create", { ...draft, proposalId: 12 })).status).toBe(200);
  expect(writes()).toEqual(["postPost_awardsGenerateAward"]);
  expect(state.oracleWrite.mock.calls[0][1]).toMatchObject({
    proposal_id: "12",
  });
  state.oracleWrite.mockClear();
  hierarchyCount = 2;
  expect((await post("create", { ...draft, proposalId: 12 })).status).toBe(200);
  expect(writes()).toEqual(["postPost_awardsAwardHeader"]);
});

it("refuses a required field left empty, an unknown choice or a reversed date range, writing nothing", async () => {
  for (const body of [
    { ...draft, fullTitle: " " },
    { ...draft, period: null },
    { ...draft, piId: 999 },
    { ...draft, currency: "XXX" },
    { ...draft, proposalId: 13 },
    { ...draft, end: "2026-01-01" },
    { ...draft, extra: 1 },
  ])
    expect((await post("create", body)).status).toBe(400);
  expect(writes()).toEqual([]);
});

it("clones only offered parts of a visible award, and only with the award-clone role", async () => {
  expect(
    (await post("clone", { awardId: 7, parts: ["award-header"] })).status,
  ).toBe(200);
  expect(state.oracleWrite.mock.calls[0][2]).toEqual({
    award_id: 7,
    objects: [{ object_name: "award-header", object_val: "true" }],
  });
  expect(
    (await post("clone", { awardId: 7, parts: ["award-budget"] })).status,
  ).toBe(400);
  awardRow = { items: [] } as never;
  expect(
    (await post("clone", { awardId: 7, parts: ["award-header"] })).status,
  ).toBe(404);
  state.roles = [];
  forget("");
  expect((await get("clone", "awardId=7")).status).toBe(403);
  expect(writes()).toEqual(["postPost_awardsCopyAward"]);
});

it("links a proposal only to an award that has none", async () => {
  expect((await post("link", { awardId: 7, proposalId: 12 })).status).toBe(400);
  awardRow = award(null);
  const links = await (await get("links", "awardId=7")).json();
  expect(links.link.proposals).toEqual([
    { value: "12", label: "P_12", detail: "T" },
  ]);
  expect((await post("link", { awardId: 7, proposalId: 12 })).status).toBe(200);
  expect(state.oracleWrite.mock.calls[0][1]).toMatchObject({
    "award-id": "7",
    "proposal-id": "12",
  });
});

it("runs an Advanced Query only on the probe's columns, from advanced-search", async () => {
  const q = (conditions: unknown) =>
    list(
      new Request(
        `${origin}/api/awards?conditions=${encodeURIComponent(JSON.stringify(conditions))}`,
      ),
    );
  expect(
    (await q([{ attribute: "award_number", op: "$eq", value: "AW_7" }])).status,
  ).toBe(200);
  const call = state.calls.mock.calls.findLast(
    (c) => c[0] === "getPost_awardsAdvancedSearch",
  )!;
  expect((call[2] as URLSearchParams).get("p_where_clause")).toBe(
    `("award_number"='AW_7')`,
  );
  expect(
    (await q([{ attribute: "salary", op: "$eq", value: "1" }])).status,
  ).toBe(400);
  // attribute_1 has no description in the AWARD attribute set, so legacy never offers it.
  expect(
    (await q([{ attribute: "attribute_1", op: "$eq", value: "x" }])).status,
  ).toBe(400);
});
