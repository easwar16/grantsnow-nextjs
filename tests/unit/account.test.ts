import { expect, it } from "vitest";
import {
  accessibilityKeys,
  accessibilitySchema,
  nextAccessibility,
  researchSchema,
  dashboardChange,
  preferencesChanges,
} from "@/features/modules/account/contracts";
import { infoletSettings } from "@/features/modules/account/infolets";
it("cycles multi-step accessibility controls and toggles binary controls", () => {
  expect(
    [0, 25, 50, 75, 100].map((v) => nextAccessibility("accFontSize", v)),
  ).toEqual([25, 50, 75, 100, 0]);
  expect(nextAccessibility("accHighlightLinks", 0)).toBe(100);
  expect(nextAccessibility("accHighlightLinks", 100)).toBe(0);
});
it("rejects unknown identity and settings fields and invalid adjustment levels", () => {
  const values = Object.fromEntries(accessibilityKeys.map((k) => [k, 0]));
  expect(accessibilitySchema.safeParse(values).success).toBe(true);
  expect(
    accessibilitySchema.safeParse({ ...values, accFontSize: 15 }).success,
  ).toBe(false);
  expect(
    accessibilitySchema.safeParse({ ...values, accDyslexicFont: 25 }).success,
  ).toBe(false);
  expect(
    dashboardChange.safeParse({ theme: "theme-dark", person_id: 5 }).success,
  ).toBe(false);
  expect(dashboardChange.safeParse({ theme: "javascript:bad" }).success).toBe(
    false,
  );
});
it("prevents comma injection into legacy research CSV and rejects identity overrides", () => {
  expect(
    researchSchema.safeParse({
      research_areas: ["Medicine"],
      favourite_funder: ["UKRI"],
      research_keywords: [],
    }).success,
  ).toBe(true);
  expect(
    researchSchema.safeParse({
      research_areas: ["Medicine,Other"],
      favourite_funder: [],
      research_keywords: [],
    }).success,
  ).toBe(false);
  expect(
    researchSchema.safeParse({
      research_areas: [],
      favourite_funder: [],
      research_keywords: [],
      pid: "other",
    }).success,
  ).toBe(false);
});
it("rejects incomplete Out of Office and unknown status identity", async () => {
  const { personStatusSchema } =
    await import("@/features/modules/account/contracts");
  expect(
    personStatusSchema.safeParse({
      status_code: "OOO",
      effective_start_date: "",
      effective_end_date: "",
      status_msg: "",
      proxy_users: [],
    }).success,
  ).toBe(false);
  expect(
    personStatusSchema.safeParse({
      status_code: "ACTIVE",
      effective_start_date: "",
      effective_end_date: "",
      status_msg: "",
      proxy_users: [],
      pid: "other",
    }).success,
  ).toBe(false);
});

const draft = {
  theme: "theme-dark",
  accessibility: { accFontSize: 25 },
  needAttention: { pPendingApprovals: false },
  insights: { pByYearChart: true },
  opportunity: true,
};
it("saves the infolets only where the drawer showed them (legacy: Home)", () => {
  expect(preferencesChanges("preferences", draft, false)).toEqual({
    theme: "theme-dark",
  });
  expect(preferencesChanges("preferences", draft, true)).toEqual({
    theme: "theme-dark",
    needAttention: { pPendingApprovals: false },
    insights: { pByYearChart: true },
    opportunity: true,
  });
  expect(preferencesChanges("accessibility", draft, true)).toEqual({
    accessibility: { accFontSize: 25 },
  });
});
it("lists only the stored legacy infolet switches, in legacy order", () => {
  expect(
    infoletSettings("needAttention", {
      ePendingApprovals: { isVisible: true },
      unknownWidget: { isVisible: true },
      pApproachingDeadlines: { isVisible: "Y" },
    }),
  ).toEqual({ pApproachingDeadlines: false, ePendingApprovals: true });
  expect(Object.keys(infoletSettings("insights", undefined))).toEqual([]);
});
