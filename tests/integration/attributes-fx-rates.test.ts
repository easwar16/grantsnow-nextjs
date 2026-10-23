import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AppError } from "@/lib/errors";
const state = vi.hoisted(() => ({
  oracle: vi.fn(),
  oracleWrite: vi.fn(),
  modules: {} as Record<string, boolean>,
  rb: [] as Record<string, unknown>[],
  dashboard: [] as { page_name: string; read_access: string }[],
}));
vi.mock("@/server/session/service", () => ({
  authenticate: async () => ({
    session: { token: "server-token" },
    user: {
      personId: "101",
      organizationId: "202",
      legalId: "77",
      modules: state.modules,
    },
  }),
}));
vi.mock("@/server/api/transport", () => ({
  oracle: state.oracle,
  oracleWrite: state.oracleWrite,
}));
vi.mock("@/server/configuration/service", () => ({
  dashboardRoles: async () => state.dashboard,
}));
vi.mock("@/server/configuration/resources", async (importOriginal) => ({
  ...(await importOriginal<
    typeof import("@/server/configuration/resources")
  >()),
  resources: async () => state.rb,
}));
import { GET as getAttributes } from "@/app/api/attributes/route";
import { GET as getFx, POST as postFx } from "@/app/api/fx-rates/route";
const origin = "http://127.0.0.1:3000";
const rb = (module: string, group: string, key: string, visible = "Y") => ({
  module_name: module,
  label_type: group,
  label_name: key,
  label_value: key === "more_info" ? "Help" : key,
  is_visible: visible,
});
const GLOBALS = {
  items: [{ var_key: "DECIMAL_PLACES_COUNT", var_value: "3" }],
};
afterEach(() => vi.unstubAllEnvs());

describe("object attributes (EOI Application tab)", () => {
  let roles: Record<string, unknown>[];
  let fields: unknown;
  beforeEach(() => {
    state.modules = { "opportunities-group": true };
    state.rb = [
      rb("OPPORTUNITIES-EOI", "labels", "show-attributes"),
      rb("OPPORTUNITIES-EOI", "button-labels", "more_info"),
    ];
    roles = [
      {
        page_id: 101,
        page_name: "opportunities-eoi-application",
        read_access: "Y",
        edit_access: "Y",
      },
    ];
    fields = {
      fields: [
        {
          fieldId: 1,
          description: "Programme",
          fieldType: "LOV",
          isVisible: "Y",
          isRequired: "Y",
          colspan: 6,
          attributeName: "ATTRIBUTE_1",
          helperText: '<p onclick="x()">Pick one</p><script>alert(1)</script>',
          options: [{ optionId: "P1", optionValue: "P1", extra: 1 }],
        },
        {
          fieldId: 2,
          description: "Hidden",
          fieldType: "TEXTBOX",
          isVisible: "N",
          isRequired: "Y",
          attributeName: "attribute_2",
        },
        {
          fieldId: 3,
          description: "Signature",
          fieldType: "SIGNATURE",
          isVisible: "Y",
          attributeName: "attribute_3",
        },
        {
          fieldId: 4,
          description: "Code",
          fieldType: "TEXTBOX",
          isVisible: "Y",
          isReadonly: "Y",
          attributeName: "attribute_4",
          parent_header_attr: "not a name",
        },
      ],
    };
    state.oracle.mockReset();
    state.oracle.mockImplementation(
      async (op: string, headers: Record<string, string>) => {
        switch (op) {
          case "getSecurityUser_roles":
            return { items: roles };
          case "getDynamicFormsGetRequestDetails":
            return {
              items: [
                {
                  request_id: Number(headers.request_id),
                  request_number: "AOI_513",
                  request_type: "OPPORTUNITIES-EOI",
                  status_code: "DRFT",
                  ref_object_id: 7165673,
                },
              ],
            };
          case "getSharedGetObjectAttributes":
            return fields;
          case "getPre_award_costingGetGlobalVar":
            return GLOBALS;
        }
        throw new Error(`Unexpected ${op}`);
      },
    );
  });
  const read = (
    q = "host=opportunities-eoi-application&parentId=7165673&objectId=3934",
  ) => getAttributes(new Request(`${origin}/api/attributes?${q}`));
  const calls = (op: string) =>
    state.oracle.mock.calls.filter(([name]) => name === op);

  it("reads with the record's p_obj_id and maps an allowlisted display model", async () => {
    const response = await read();
    expect(response.status).toBe(200);
    const view = await response.json();
    expect(calls("getSharedGetObjectAttributes")[0][1]).toEqual({
      token: "server-token",
      p_obj_type: "OPPORTUNIES-EOI",
      p_obj_id: "3934",
    });
    expect(view.visible).toBe(true);
    expect(view.decimals).toBe(3);
    // The bundle is opportunities-eoi, not the object type (the legacy `opportunies-eoi` lookup).
    expect(view.texts.moreInfo).toBe("Help");
    expect(view.texts.sourceCode).toBe("Source code");
    // A hidden field and an unknown type never reach the browser; names are lower-cased.
    expect(view.fields.map((f: { name: string }) => f.name)).toEqual([
      "attribute_1",
      "attribute_4",
    ]);
    expect(view.fields[0].helperText).toBe("<p>Pick one</p>");
    expect(view.fields[0].options).toEqual([
      { optionId: "P1", optionValue: "P1", parent_lkp_code: null },
    ]);
    expect(view.fields[1]).toMatchObject({
      readOnly: true,
      parent_header_attr: null,
    });
  });

  it("sends an empty p_obj_id for a new application, as legacy", async () => {
    state.oracle.mockImplementation(async (op: string) => {
      if (op === "getSharedGetOpportunities")
        return {
          items: [
            {
              opportunities_id: 7165673,
              opportunity_status: "OPEN",
              create_application_of_interest: "Y",
            },
          ],
        };
      if (op === "getSharedGetObjectAttributes") return { fields: [] };
      if (op === "getPre_award_costingGetGlobalVar") return GLOBALS;
      throw new Error(`Unexpected ${op}`);
    });
    state.dashboard = [{ page_name: "apply-opportunities", read_access: "Y" }];
    const response = await read(
      "host=opportunities-eoi-application&parentId=7165673",
    );
    expect(response.status).toBe(200);
    expect(calls("getSharedGetObjectAttributes")[0][1].p_obj_id).toBe("");
  });

  it("stays hidden, reading nothing, unless show-attributes is 'Y'", async () => {
    for (const rows of [
      [],
      [rb("OPPORTUNITIES-EOI", "labels", "show-attributes", "N")],
      // A visible entry under the misspelt legacy bundle does not count.
      [rb("OPPORTUNIES-EOI", "labels", "show-attributes")],
    ]) {
      state.rb = rows;
      state.oracle.mockClear();
      const response = await read();
      expect(await response.json()).toEqual({ visible: false });
      expect(calls("getSharedGetObjectAttributes")).toHaveLength(0);
    }
  });

  it("fails closed: no role row, a read 'N', no module, an unknown host", async () => {
    for (const set of [
      () => (roles = []),
      () =>
        (roles = [
          { page_name: "opportunities-eoi-application", read_access: "Y" },
          { page_name: "opportunities-eoi-application", read_access: "N" },
        ]),
      () => (state.modules = {}),
    ]) {
      set();
      const { forget } = await import("@/server/cache/memo");
      forget("");
      state.oracle.mockClear();
      expect((await read()).status).toBe(403);
      expect(calls("getSharedGetObjectAttributes")).toHaveLength(0);
    }
    expect((await read("host=proposals-summary&objectId=1")).status).toBe(400);
    expect(
      (await read("host=opportunities-eoi-application&objectId=0")).status,
    ).toBe(400);
  });

  it("passes an Oracle error through verbatim", async () => {
    state.oracle.mockImplementation(async (op: string) => {
      if (op === "getSharedGetObjectAttributes")
        throw new AppError("BUSINESS", "ORA-1 : Bad type", 502, "Ask admin");
      if (op === "getSecurityUser_roles") return { items: roles };
      if (op === "getDynamicFormsGetRequestDetails")
        return {
          items: [
            {
              request_id: 3934,
              request_number: "AOI_513",
              request_type: "OPPORTUNITIES-EOI",
              ref_object_id: 7165673,
            },
          ],
        };
      if (op === "getPre_award_costingGetGlobalVar") return GLOBALS;
      throw new Error(`Unexpected ${op}`);
    });
    const response = await read();
    expect(response.status).toBe(502);
    expect((await response.json()).error).toEqual({
      code: "BUSINESS",
      message: "ORA-1 : Bad type",
      action: "Ask admin",
    });
  });
});

describe("FX rates (proposal Budget / Pricing)", () => {
  let roles: Record<string, unknown>[];
  let proposal: Record<string, unknown>;
  let rates: Record<string, unknown>;
  const TARGET = {
    type: "PROPOSAL",
    id: "5581",
    versionId: "6649",
    mode: "PURCHASE",
  };
  beforeEach(() => {
    vi.stubEnv("APP_ORIGIN", origin);
    state.modules = { PROPOSALS: true };
    state.rb = [
      rb("PROPOSAL", "button-labels", "fx-rates"),
      rb("PROPOSAL", "table-headers", "fx-currency"),
    ];
    roles = [
      { page_id: 40, page_name: "proposals-budget", read_access: "Y" },
      { page_id: 41, page_name: "proposals-pricing", read_access: "Y" },
      {
        page_name: "proposal-fx-rates",
        read_access: "Y",
        edit_access: "Y",
      },
    ];
    proposal = {
      proposal_id: 5581,
      proposal_type: "PROPOSAL",
      proposal_status: "DRFT",
      locked_modules: [],
    };
    rates = {
      can_edit: "Y",
      is_active_version: "Y",
      proposal_id: 5581,
      proposal_period_version_id: 6649,
      fx_rates: [
        {
          proposal_fx_rate_id: 1,
          currency_code: "USD",
          currency_name: "US Dollars",
          costing_fx_rate: 1.34,
          pricing_fx_rate: 1.3,
          default_costing_fx_rate: 1.3,
          default_pricing_fx_rate: 1.3,
          rate_status: "OVERRIDDEN",
          currency_symbol: "$",
        },
        {
          proposal_fx_rate_id: 2,
          currency_code: "EUR",
          currency_name: "Euros",
          costing_fx_rate: 1.2,
          pricing_fx_rate: 1.25,
          default_costing_fx_rate: null,
          default_pricing_fx_rate: null,
          rate_status: "OVERRIDDEN",
        },
      ],
    };
    state.oracle.mockReset();
    state.oracleWrite.mockReset();
    state.oracleWrite.mockResolvedValue({});
    state.oracle.mockImplementation(async (op: string) => {
      switch (op) {
        case "getSecurityUser_roles":
          return { items: roles };
        case "getProposalProposal_id":
          return proposal;
        case "getProposalFxRates":
          return rates;
      }
      throw new Error(`Unexpected ${op}`);
    });
  });
  const read = (t: Record<string, string> = TARGET) =>
    getFx(new Request(`${origin}/api/fx-rates?${new URLSearchParams(t)}`));
  const save = (body: unknown, from = origin) =>
    postFx(
      new Request(`${origin}/api/fx-rates`, {
        method: "POST",
        headers: { "content-type": "application/json", origin: from },
        body: JSON.stringify(body),
      }),
    );

  it("reads the version's rates with every edit gate passed", async () => {
    const response = await read();
    expect(response.status).toBe(200);
    const view = await response.json();
    expect(state.oracle).toHaveBeenCalledWith("getProposalFxRates", {
      token: "server-token",
      proposal_id: "5581",
      version_id: "6649",
    });
    expect(view.editable).toBe(true);
    expect(view.texts.currency).toBe("fx-currency");
    expect(view.texts.cost).toBe("Cost Rate");
    expect(view.rates[0]).toEqual({
      rateId: 1,
      currency: "USD",
      name: "US Dollars",
      cost: 1.34,
      price: 1.3,
      defaultCost: 1.3,
      defaultPrice: 1.3,
      status: "OVERRIDDEN",
    });
  });

  it("is read-only (never blank) when any edit gate fails", async () => {
    const cases: (() => void)[] = [
      // Legacy's blank dialog read `can_edit` off an unloaded object; here a missing flag is simply read-only.
      () => delete rates.can_edit,
      () => (rates.can_edit = "N"),
      () => delete rates.is_active_version,
      () => (proposal.proposal_status = "SUB"),
      () => (proposal.locked_modules = [{ id: 9, page_id: 40 }]),
      () => (roles = roles.filter((r) => r.page_name !== "proposals-budget")),
      () => (roles = roles.map((r) => ({ ...r, edit_access: "N" }))),
    ];
    for (const change of cases) {
      const saved = {
        rates: structuredClone(rates),
        proposal: structuredClone(proposal),
        roles: structuredClone(roles),
      };
      change();
      const { forget } = await import("@/server/cache/memo");
      forget("");
      const response = await read();
      expect(response.status).toBe(200);
      const view = await response.json();
      expect(view.editable).toBe(false);
      expect(view.rates).toHaveLength(2);
      ({ rates, proposal, roles } = saved);
    }
    // A finalized Pricing tab does not lock Budget's rates.
    proposal.locked_modules = [{ id: 9, page_id: 41 }];
    (await import("@/server/cache/memo")).forget("");
    expect((await (await read()).json()).editable).toBe(true);
  });

  it("a sub-proposal's rates are read-only (legacy host editable)", async () => {
    proposal.proposal_type = "SUB_PROPOSAL";
    state.rb.push(rb("SUB_PROPOSAL", "button-labels", "fx-rates"));
    const view = await (await read({ ...TARGET, type: "SUB_PROPOSAL" })).json();
    expect(view.editable).toBe(false);
  });

  it("fails closed: no fx-rates role, no module, button hidden, a different record", async () => {
    const cases: (() => void)[] = [
      () => (roles = roles.filter((r) => r.page_name !== "proposal-fx-rates")),
      () =>
        (roles = [
          ...roles,
          { page_name: "proposal-fx-rates", read_access: "N" },
        ]),
      () => (state.modules = {}),
      () => (state.rb = [rb("PROPOSAL", "button-labels", "fx-rates", "N")]),
    ];
    for (const change of cases) {
      const saved = structuredClone(roles);
      change();
      const { forget } = await import("@/server/cache/memo");
      forget("");
      expect((await read()).status).toBe(403);
      roles = saved;
      state.modules = { PROPOSALS: true };
      state.rb = [rb("PROPOSAL", "button-labels", "fx-rates")];
    }
    proposal.proposal_type = "OUTLINE_PROPOSAL";
    expect((await read()).status).toBe(502);
    expect((await read({ ...TARGET, mode: "BOTH" })).status).toBe(400);
  });

  it("writes an explicit pick with the edits applied, the tab's mode, then re-reads", async () => {
    const response = await save({
      target: TARGET,
      edits: [
        { currency: "USD", reset: false, rate: 1.5 },
        { currency: "EUR", reset: true },
      ],
    });
    expect(response.status).toBe(200);
    expect(state.oracleWrite).toHaveBeenCalledTimes(1);
    const [op, headers, body] = state.oracleWrite.mock.calls[0];
    expect(op).toBe("postProposalFxRates");
    expect(headers).toEqual({
      token: "server-token",
      proposal_id: "5581",
      version_id: "6649",
      mode: "PURCHASE",
    });
    expect(body).toEqual({
      fx_rates: [
        {
          proposal_fx_rate_id: 1,
          currency_code: "USD",
          currency_name: "US Dollars",
          // PURCHASE changes the cost rate only.
          costing_fx_rate: 1.5,
          pricing_fx_rate: 1.3,
          default_costing_fx_rate: 1.3,
          default_pricing_fx_rate: 1.3,
          rate_status: "OVERRIDDEN",
        },
        {
          proposal_fx_rate_id: 2,
          currency_code: "EUR",
          currency_name: "Euros",
          // RESET restores the defaults, 1 when there are none.
          costing_fx_rate: 1,
          pricing_fx_rate: 1,
          default_costing_fx_rate: null,
          default_pricing_fx_rate: null,
          rate_status: "ADMIN_DEFAULT",
        },
      ],
    });
    // The write comes before the re-read.
    const writeOrder = state.oracleWrite.mock.invocationCallOrder[0];
    const lastRead = state.oracle.mock.invocationCallOrder.at(-1)!;
    expect(lastRead).toBeGreaterThan(writeOrder);
  });

  it("INCOME (Pricing) changes the price rate, never the cost rate", async () => {
    await save({
      target: { ...TARGET, mode: "INCOME" },
      edits: [{ currency: "USD", reset: false, rate: 2 }],
    });
    const [, headers, body] = state.oracleWrite.mock.calls[0];
    expect(headers.mode).toBe("INCOME");
    expect(body.fx_rates[0]).toMatchObject({
      costing_fx_rate: 1.34,
      pricing_fx_rate: 2,
      rate_status: "OVERRIDDEN",
    });
  });

  it("writes nothing when not editable, cross-origin, or for a bad edit", async () => {
    rates.can_edit = "N";
    const ok = { target: TARGET, edits: [] };
    expect((await save(ok)).status).toBe(403);
    rates.can_edit = "Y";
    expect((await save(ok, "https://evil.example")).status).toBe(403);
    for (const edits of [
      [{ currency: "GBP", reset: true }],
      [
        { currency: "USD", reset: true },
        { currency: "USD", reset: false, rate: 1 },
      ],
      [{ currency: "USD", reset: false, rate: "1" }],
      [{ currency: "USD", reset: false, rate: 1, status: "X" }],
    ])
      expect((await save({ target: TARGET, edits })).status).toBe(400);
    expect((await save({ ...ok, extra: 1 })).status).toBe(400);
    expect(state.oracleWrite).not.toHaveBeenCalled();
  });

  it("surfaces writes switched off (WRITES_ENABLED) without re-reading", async () => {
    state.oracleWrite.mockRejectedValue(
      new AppError(
        "WRITES_DISABLED",
        "Saving isn't enabled in this build yet.",
        409,
      ),
    );
    const response = await save({ target: TARGET, edits: [] });
    expect(response.status).toBe(409);
    expect((await response.json()).error.code).toBe("WRITES_DISABLED");
    expect(
      state.oracle.mock.calls.filter(([op]) => op === "getProposalFxRates"),
    ).toHaveLength(1);
  });
});
