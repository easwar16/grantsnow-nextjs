import { beforeEach, expect, it, vi } from "vitest";
import { serverFunctions } from "@/server/functions";
const { oracle, session, user } = vi.hoisted(() => ({
  oracle: vi.fn(),
  session: { token: "token-a" },
  user: { modules: { ETHICS: true } as Record<string, boolean> },
}));
vi.mock("@/server/oracle/connection", () => ({ oracle }));
vi.mock("@/server/identity/session/service", () => ({
  authenticate: async () => ({ session, user }),
}));
vi.mock("@/server/modules/home/service", () => ({
  homeAccess: async () => ({ session, user }),
}));
import {
  ethicsAccess,
  grantsEthicsAccess,
} from "@/server/modules/home/ethics-access";
import {
  monthOptions,
  pruneMonths,
  yearOptions,
} from "@/features/modules/home/insight-filters";
import { stepSlide } from "@/features/modules/home/components/announcements";
import { announcementMessages } from "@/server/modules/home/announcements";
import { indent } from "@/features/modules/home/components/organization-heading";
beforeEach(() => {
  oracle.mockReset();
  user.modules.ETHICS = true;
});
it("narrows Months to the chosen quarters and prunes months outside them", () => {
  expect(monthOptions([]).map((m) => m.value)).toHaveLength(12);
  expect(monthOptions(["2"]).map((m) => m.label)).toEqual([
    "April",
    "May",
    "June",
  ]);
  expect(monthOptions(["1", "4"]).map((m) => m.value)).toEqual([
    "1",
    "2",
    "3",
    "10",
    "11",
    "12",
  ]);
  expect(pruneMonths(["1", "5", "12"], ["2"])).toEqual(["5"]);
  // Clearing the quarters keeps every chosen month.
  expect(pruneMonths(["1", "5"], [])).toEqual(["1", "5"]);
});
it("offers the current year back to 1995, newest first", () => {
  const years = yearOptions(2026);
  expect(years[0]).toEqual({ value: "2026", label: "2026" });
  expect(years.at(-1)?.value).toBe("1995");
  expect(years).toHaveLength(32);
});
it("loops the announcement strip at both ends", () => {
  expect(stepSlide(0, 1, 3)).toBe(1);
  expect(stepSlide(2, 1, 3)).toBe(0);
  expect(stepSlide(0, -1, 3)).toBe(2);
  expect(stepSlide(0, 1, 0)).toBe(0);
});
it("indents orgs by depth with spaces an <option> keeps, and degrades bad depths to none", () => {
  expect(indent(2)).toBe("  ");
  expect(indent(-1)).toBe("");
  expect(serverFunctions.organizations.orgDepth(3)).toBe(3);
  expect(serverFunctions.organizations.orgDepth("2")).toBe(2);
  expect(serverFunctions.organizations.orgDepth(null)).toBe(0);
  expect(serverFunctions.organizations.orgDepth("")).toBe(0);
  expect(serverFunctions.organizations.orgDepth("x")).toBe(0);
  expect(serverFunctions.organizations.orgDepth(1.5)).toBe(0);
  expect(serverFunctions.organizations.orgDepth(500)).toBe(20);
});
it("grants Ethics access only on true, 'true' or 'Y'", () => {
  expect(grantsEthicsAccess({ hasAccess: true })).toBe(true);
  expect(grantsEthicsAccess({ hasAccess: "Y" })).toBe(true);
  expect(grantsEthicsAccess({ hasAccess: "true" })).toBe(true);
  expect(grantsEthicsAccess({ hasAccess: "N" })).toBe(false);
  expect(grantsEthicsAccess({ hasAccess: false })).toBe(false);
  expect(grantsEthicsAccess({})).toBe(false);
  expect(() => grantsEthicsAccess({ hasAccess: 1 })).toThrow();
});
it("asks Oracle on each check, as legacy reads it per Home visit and holds it nowhere longer", async () => {
  session.token = "token-once";
  oracle.mockResolvedValue({ hasAccess: "N" });
  expect(await ethicsAccess()).toBe(false);
  expect(await ethicsAccess()).toBe(false);
  expect(oracle).toHaveBeenCalledTimes(2);
  // The client also passes its optional signal / query / path arguments; compare the leading ones.
  expect(oracle.mock.calls[0].slice(0, 2)).toEqual([
    "getDynamicFormsCheckApplApprAccess",
    { token: "token-once" },
  ]);
  session.token = "token-failing";
  oracle.mockRejectedValueOnce(new Error("upstream"));
  await expect(ethicsAccess()).rejects.toThrow("upstream");
  oracle.mockResolvedValueOnce({ hasAccess: "Y" });
  expect(await ethicsAccess()).toBe(true);
  expect(oracle).toHaveBeenCalledTimes(4);
});
it("refuses the Ethics check without the Ethics module", async () => {
  session.token = "token-no-module";
  user.modules.ETHICS = false;
  await expect(ethicsAccess()).rejects.toMatchObject({ code: "FORBIDDEN" });
  expect(oracle).not.toHaveBeenCalled();
});

it("drops a bad announcement row instead of blanking the strip", async () => {
  oracle.mockResolvedValueOnce({
    items: [{ msg: "<p>First</p>" }, { msg: null }, {}, { msg: "  " }],
  });
  expect(await announcementMessages("token-bad-row", "DASHBOARD")).toEqual({
    messages: ["<p>First</p>"],
  });
});
