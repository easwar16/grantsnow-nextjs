import { describe, expect, it } from "vitest";
import {
  canSaveApplication,
  finalizeSwitch,
  formOf,
  headerConverts,
  visibleTabs,
} from "@/shared/opportunities/eoi-record";
import { finalizedOf, objectAccessOf } from "@/server/platform/permissions";
import {
  inAppDestination,
  mustAsk,
} from "@/features/modules/opportunities/eoi/unsaved";
const rows = (...pages: [string, number, string?][]) =>
  pages.map(([page, id, read = "Y"]) => ({
    page_id: id,
    page_name: page,
    read_access: read,
    edit_access: "Y",
  }));
const all = objectAccessOf(
  rows(
    ["opportunities-eoi-summary", 1],
    ["opportunities-eoi-application", 2],
    ["opportunities-eoi-dynamic-form-1", 3],
    ["opportunities-eoi-approvals", 4],
    ["opportunities-eoi-history", 5],
  ),
);
describe("EOI tabs (getTabs)", () => {
  it("shows a new application only Summary and Application", () => {
    expect(visibleTabs(null, [], new Set())).toEqual([
      "summary",
      "application",
    ]);
  });
  it("keeps the original's order and needs read on each tab", () => {
    expect(visibleTabs(all, [], new Set())).toEqual([
      "summary",
      "application",
      "dynamic-form-1",
      "approvals",
      "history",
    ]);
  });
  it("gates Workflow on read and every finalizable page finalized", () => {
    const finalizable = ["opportunities-eoi-application"];
    expect(visibleTabs(all, finalizable, new Set())).not.toContain("approvals");
    expect(visibleTabs(all, finalizable, new Set(finalizable))).toContain(
      "approvals",
    );
    expect(visibleTabs(all, null, new Set())).not.toContain("approvals");
    const noRead = objectAccessOf(
      rows(["opportunities-eoi-approvals", 4, "N"]),
    );
    expect(visibleTabs(noRead, [], new Set())).toEqual([]);
  });
});
describe("object access (D38)", () => {
  it("fails closed: no rows, an N row or a duplicate N row denies", () => {
    expect(objectAccessOf([]).roles.size).toBe(0);
    const a = objectAccessOf(
      rows(["p", 1], ["p", 1, "N"], ["q", 2, "N"], ["r", 3]),
    );
    expect(a.roles.get("p")?.read).toBe(false);
    expect(a.roles.get("q")?.read).toBe(false);
    expect(a.pages).toEqual([{ id: 3, name: "r" }]);
  });
  it("maps locks to readable pages only", () => {
    const f = finalizedOf(all.pages, [
      { id: 9, page_id: 2 },
      { id: 10, page_id: 99 },
    ]);
    expect([...f]).toEqual([["opportunities-eoi-application", 9]]);
  });
});
describe("finalize switch and converts", () => {
  const fin = ["opportunities-eoi-application"];
  const known = { known: true, locked: false };
  it("shows on a draft's finalizable tab with a known lock", () => {
    expect(
      finalizeSwitch("DRFT", fin, new Set(), "application", known),
    ).toEqual({
      on: false,
    });
    expect(
      finalizeSwitch("DRFT", fin, new Set(fin), "application", known),
    ).toEqual({ on: true });
    expect(
      finalizeSwitch("IA", fin, new Set(), "application", known),
    ).toBeNull();
    expect(finalizeSwitch("DRFT", fin, new Set(), "summary", known)).toBeNull();
    expect(
      finalizeSwitch("DRFT", fin, new Set(), "application", {
        known: false,
        locked: true,
      }),
    ).toBeNull();
    expect(
      finalizeSwitch("DRFT", null, new Set(), "application", known),
    ).toBeNull();
  });
  it("converts only an approved application with the record role", () => {
    const a = objectAccessOf(rows(["eoi-convert-outline-proposal", 7]));
    expect(headerConverts("IA", a)).toEqual({ outline: true, full: false });
    expect(headerConverts("DRFT", a)).toEqual({ outline: false, full: false });
  });
});
describe("forms and modes", () => {
  it("uses OPPORTUNITIES for the Application and OPPORTUNITIES-EOI for Dynamic Form 1–5", () => {
    expect(formOf("application")).toEqual({
      objectType: "OPPORTUNITIES",
      slot: "OPPORTUNITIES-EOI-APPLICATION",
    });
    expect(formOf("dynamic-form-3")).toEqual({
      objectType: "OPPORTUNITIES-EOI",
      slot: "OPPORTUNITIES-EOI-DYNAMIC-FORM-3",
    });
  });
  it("offers Create on a new application and Save only while editing a draft", () => {
    expect(canSaveApplication(undefined, false, undefined)).toBe(true);
    expect(canSaveApplication("12", false, "DRFT")).toBe(false);
    expect(canSaveApplication("12", true, "DRFT")).toBe(true);
    expect(canSaveApplication("12", true, "IA")).toBe(false);
  });
});
describe("unsaved changes", () => {
  const click = {
    button: 0,
    metaKey: false,
    ctrlKey: false,
    shiftKey: false,
    altKey: false,
    defaultPrevented: false,
  };
  const here = {
    origin: "https://app.test",
    pathname: "/opportunities/eoi/12/application",
    search: "",
  };
  const link = (href: string, extra = {}) => ({
    href,
    target: "",
    download: false,
    ...extra,
  });
  it("asks only for unsaved changes on an unlocked page", () => {
    expect(mustAsk(null)).toBe(false);
    expect(mustAsk({ locked: false, dirty: () => true })).toBe(true);
    expect(mustAsk({ locked: true, dirty: () => true })).toBe(false);
    expect(mustAsk({ locked: false, dirty: () => false })).toBe(false);
  });
  it("intercepts plain in-app links that leave the page", () => {
    expect(
      inAppDestination(click, link("https://app.test/opportunities/eoi"), here),
    ).toBe("/opportunities/eoi");
    expect(
      inAppDestination(
        click,
        link("https://app.test/opportunities/eoi/12/summary"),
        here,
      ),
    ).toBe("/opportunities/eoi/12/summary");
  });
  it("lets new tabs, downloads, other origins and the same page through", () => {
    const to = link("https://app.test/home");
    expect(inAppDestination({ ...click, ctrlKey: true }, to, here)).toBeNull();
    expect(inAppDestination({ ...click, metaKey: true }, to, here)).toBeNull();
    expect(inAppDestination({ ...click, button: 1 }, to, here)).toBeNull();
    expect(
      inAppDestination(click, { ...to, target: "_blank" }, here),
    ).toBeNull();
    expect(inAppDestination(click, { ...to, download: true }, here)).toBeNull();
    expect(
      inAppDestination(click, link("https://elsewhere.test/x"), here),
    ).toBeNull();
    expect(
      inAppDestination(
        click,
        link("https://app.test/opportunities/eoi/12/application#top"),
        here,
      ),
    ).toBeNull();
  });
});
