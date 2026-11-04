import { beforeEach, expect, it, vi } from "vitest";
const state = vi.hoisted(() => ({
  activity: {} as Record<string, unknown>,
  versions: [] as Record<string, unknown>[],
  writes: [] as unknown[],
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
  roles: {
    record: async () => ({
      items: ["claims-unit-summary", "claims-unit-activities"].map((p) => ({
        page_name: p,
        read_access: "Y",
        edit_access: "Y",
        delete_access: "N",
      })),
    }),
  },
  claims: {
    statusConfigs: async () => ({
      items: [
        {
          transaction_type: "CLAIM_ACTIVITY",
          status_lookup_code: "DRFT",
          allow_user_edit: "Y",
        },
      ],
    }),
    appFunds: async () => ({
      items: [
        {
          app_fund_id: 966,
          full_fund_display: "TITLE II",
          fund_preferences: [
            { pref_key: "HOMELESS_FIELD_FLAG", pref_value: "Y" },
          ],
        },
      ],
    }),
    activity: async () => ({ items: [state.activity] }),
    activityVersions: async () => ({ items: state.versions }),
    setActiveVersion: async (p: unknown) => void state.writes.push(p),
  },
}));
import {
  activityView,
  setActiveVersion,
} from "@/server/modules/claims/units/record/activity";

let app = 5000;
const next = () => String(app++);
const ids = { fund: "966", activity: "1", version: "2" };
beforeEach(() => {
  state.activity = {
    activity_id: 1,
    amend_version_id: 2,
    app_fund_id: 966,
    activity_status_code: "DRFT",
    active_version_flag: "N",
    activity_type_code: "POSITION",
    activity_position_type: {
      fte_code: 1,
      salary_percent: 50,
      activity_cost_items: [
        { category_type_code: "BENEFIT", rate: 10, amount: 5 },
        { category_type_code: "OTHER", rate: 1 },
      ],
    },
  };
  state.versions = [
    { amend_version_id: 1, version_number: 1 },
    { amend_version_id: 2, version_number: 2 },
  ];
  state.writes = [];
});

it("holds percentages as fractions, opens the position tabs and offers Mark as active", async () => {
  const view = await activityView(next(), ids);
  expect(view.activity.position?.salaryPercent).toBe(0.5);
  expect(view.activity.position?.items).toEqual([
    expect.objectContaining({ type: "BENEFIT", rate: 0.1, amount: 5 }),
  ]);
  expect(view.tabs.map((t) => t.id)).toContain("claimable-amount-details");
  expect(view.homeless).toBe(true);
  expect(view.canSetActive).toBe(true);
});

it("closes the position tabs for a lump-sum position (FTE 2)", async () => {
  state.activity.activity_position_type = { fte_code: 2 };
  const view = await activityView(next(), ids);
  expect(view.tabs.map((t) => t.id)).not.toContain("position-details");
});

it("refuses another fund's activity and an already active version", async () => {
  state.activity.app_fund_id = 1;
  await expect(activityView(next(), ids)).rejects.toMatchObject({
    code: "FORBIDDEN",
  });
  state.activity.app_fund_id = 966;
  state.activity.active_version_flag = "Y";
  await expect(setActiveVersion(next(), ids)).rejects.toMatchObject({
    code: "FORBIDDEN",
  });
  state.activity.active_version_flag = "N";
  await setActiveVersion(next(), ids);
  expect(state.writes).toEqual([{ activityId: 1, versionId: 2 }]);
});
