import { expect, it } from "vitest";
import {
  drawerAccess,
  requireDrawerAccess,
  visibleNavigation,
} from "@/server/platform/permissions";
import { externalToolUrls } from "@/app/(authenticated)/modules/external-tools";
const ids = (modules: Record<string, boolean>) =>
  visibleNavigation(modules).map((i) =>
    i.children ? `${i.id}[${i.children.map((c) => c.id).join(",")}]` : i.id,
  );
it("fails closed to Home and Announcements when no module is granted", () => {
  expect(ids({})).toEqual(["home", "announcements"]);
});
it("needs the group's own id: a child grant alone shows nothing", () => {
  expect(
    ids({ "opportunities-finder": true, "opportunities-analytics": true }),
  ).toEqual(["home", "announcements"]);
});
it("shows each group child only with its own id", () => {
  expect(
    ids({
      "opportunities-group": true,
      "opportunities-eoi-list": true,
      "claims-group": true,
      "claims-funds-inquiry": true,
    }),
  ).toEqual([
    "home",
    "opportunities-group[opportunities-eoi-list]",
    "claims-group[claims-funds-inquiry]",
    "announcements",
  ]);
});
it("gates plain items and deep links on their upper-cased id", () => {
  expect(
    ids({
      PROPOSALS: true,
      "DUE-DILIGENCE": true,
      REPORTS: true,
      ADMINISTRATION: true,
      APIDOCS: true,
      ethics: true,
      "CUSTOMER-SUPPORT": false,
    }),
  ).toEqual([
    "home",
    "proposals",
    "due-diligence",
    "reports",
    "announcements",
    "administration",
    "apidocs",
  ]);
});
it("guards drawer routes with the same grant", () => {
  const user = {
    name: "",
    organization: "",
    organizationId: "1",
    personId: "1",
    landing: "",
    modules: { "opportunities-finder": true },
  };
  expect(() => requireDrawerAccess(user, "opportunities-finder")).toThrow(
    expect.objectContaining({ code: "FORBIDDEN" }),
  );
  expect(
    drawerAccess(
      { "opportunities-group": true, "opportunities-finder": true },
      "opportunities-finder",
    ),
  ).toBe(true);
  expect(drawerAccess({}, "announcements")).toBe(true);
});
it("reads external tools from configuration and drops unsafe values", () => {
  const urls = externalToolUrls({
    APEX_REPORTS_URL: "https://apex.example/ords/r/dev/preawards/reports",
    APEX_ADMINISTRATION_URL: "javascript:alert(1)",
    CUSTOMER_SUPPORT_URL: "https://user:secret@support.example/home",
  });
  expect(urls.reports).toBe(
    "https://apex.example/ords/r/dev/preawards/reports",
  );
  expect(urls.administration).toBeUndefined();
  expect(urls["customer-support"]).toBeUndefined();
  expect(urls.apidocs).toMatch(/^https:\/\/app\.swaggerhub\.com\//);
  expect(externalToolUrls({}).reports).toBeUndefined();
});
