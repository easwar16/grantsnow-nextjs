import { afterEach, beforeEach, expect, it, vi } from "vitest";
const state = vi.hoisted(() => ({
  app: undefined as unknown,
  save: vi.fn(),
  destroy: vi.fn(),
  calls: vi.fn(),
}));
vi.mock("@/server/identity/session/storage", () => ({
  storage: async () => state,
}));
vi.mock("@/server/oracle/connection", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  oracle: state.calls,
}));
import { GET } from "@/app/api/awards/route";
import { GET as choicesGet } from "@/app/api/awards/choices/route";
import { forgetValidation } from "@/server/identity/session/service";
import { forget } from "@/server/oracle/cache";
import { fixtureUser } from "@/test-support/fixtures";

const TOKEN = "awards-test-token";
const valid = (modules = fixtureUser.module_access) => ({
  ...fixtureUser,
  module_access: modules,
  token: TOKEN,
  expiry_datetime: new Date(Date.now() + 600000).toISOString(),
});
const listCalls = () =>
  state.calls.mock.calls.filter((c) => c[0] === "getPost_awardsAwardHeader");
const get = (query = "") =>
  GET(new Request(`http://127.0.0.1:3000/api/awards${query}`));

beforeEach(() => {
  forgetValidation(TOKEN);
  forget("");
  vi.stubEnv("APP_ORIGIN", "http://127.0.0.1:3000");
  vi.stubEnv("FIXTURE_MODE", "false");
  state.app = {
    token: TOKEN,
    subject: "test-sub",
    expiresAt: Date.now() + 600000,
    identityExpiresAt: Date.now() + 1200000,
    fixture: false,
  };
  state.calls.mockReset();
  state.calls.mockImplementation(async (op: string) => {
    if (op === "getSessionValidate") return valid();
    if (op === "getSharedLabels") return [];
    if (op === "getSharedGetObjectDates")
      return { items: [{ column_name: "creation_date" }] };
    if (op === "getPost_awardsAwardHeader")
      return {
        items: [{ award_id: 1, award_number: "AW_1", award_name: "One" }],
        total_count: 1,
        hasMore: "false",
      };
    throw new Error(`Unexpected ${op}`);
  });
});
afterEach(() => vi.unstubAllEnvs());

it("sends the server-built clause, page and sort, and answers the display model", async () => {
  const response = await get("?status=IA&number=AW_&sortBy=creation_date");
  expect(response.status).toBe(200);
  const body = await response.json();
  expect(body).toMatchObject({ total: 1, hasMore: false });
  expect(body.rows[0]).toMatchObject({ id: "1", number: "AW_1" });
  const query = listCalls()[0][2] as URLSearchParams;
  expect(query.get("p_where_clause")).toBe(
    `("award_status_code"='IA' AND LOWER("award_number") LIKE LOWER('%AW\\_%') ESCAPE '\\')`,
  );
  expect(
    ["p_offset", "p_limit", "p_order_by"].map((k) => query.get(k)),
  ).toEqual(["0", "10", '"creation_date"']);
});

it("refuses bad filters and an unknown date sort before the list is read", async () => {
  expect((await get("?org=1%20OR%201%3D1")).status).toBe(400);
  expect((await get("?sortBy=award_amount")).status).toBe(400);
  expect(listCalls()).toHaveLength(0);
});

it("fails closed without the Awards module", async () => {
  state.calls.mockImplementation(async (op: string) =>
    op === "getSessionValidate" ? valid([]) : { items: [] },
  );
  expect((await get()).status).toBe(403);
  expect(listCalls()).toHaveLength(0);
});

it("serves the drawer's choices only with the Awards module", async () => {
  state.calls.mockImplementation(async (op: string) =>
    op === "getSessionValidate" ? valid([]) : { items: [] },
  );
  expect(
    (await choicesGet(new Request("http://127.0.0.1:3000/api/awards/choices")))
      .status,
  ).toBe(403);
  expect(
    state.calls.mock.calls.some(
      (c) => c[0] === "getPre_awardGetLkpOrgUnitType",
    ),
  ).toBe(false);
});

it("reads each choice list on its own: a failed org lookup leaves the funders loading", async () => {
  const shown = ["list-org-unit", "list-funder"].map((label_name) => ({
    module_name: "award",
    label_type: "labels",
    label_name,
    label_value: label_name,
    is_visible: "Y",
  }));
  state.calls.mockImplementation(async (op: string) => {
    if (op === "getSessionValidate") return valid();
    if (op === "getSharedLabels") return shown;
    if (op === "getPre_awardGetLkpOrgUnitType")
      throw new Error("timed out after 60s");
    if (op === "GetSponsorList")
      return { items: [{ party_id: 7, party_name: "Wellcome" }] };
    throw new Error(`Unexpected ${op}`);
  });
  const choices = (list: string) =>
    choicesGet(
      new Request(`http://127.0.0.1:3000/api/awards/choices?list=${list}`),
    );
  const [orgs, parties] = await Promise.all([
    choices("orgs").then((r) => r.json()),
    choices("parties").then((r) => r.json()),
  ]);
  expect(orgs).toEqual({
    options: [],
    errors: ["Org units could not be loaded."],
  });
  expect(parties.options.map((o: { label: string }) => o.label)).toEqual([
    "Wellcome",
  ]);
  expect(parties.errors).toEqual([]);
  expect((await choices("everything")).status).toBe(400);
});
