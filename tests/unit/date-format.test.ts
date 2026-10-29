import { expect, it } from "vitest";
import moment from "moment";
import { functions } from "@/lib/functions";

it("uses the configured pattern as the placeholder, falling back when it has an unknown token", () => {
  expect(functions.format.datePattern()).toBe("DD-MMM-YYYY");
  expect(functions.format.datePattern({ dateFormat: "dd/mm/yyyy" })).toBe(
    "DD/MM/YYYY",
  );
  expect(functions.format.datePattern({ dateFormat: "Do MMM YYYY" })).toBe(
    "DD-MMM-YYYY",
  );
});
it("reads a date typed in the configured pattern back to ISO", () => {
  expect(functions.format.parseDisplayDate("05-Jun-2026")).toBe("2026-06-05");
  expect(functions.format.parseDisplayDate(" 5-jun-2026 ")).toBe("2026-06-05");
  expect(
    functions.format.parseDisplayDate("05/06/2026", {
      dateFormat: "DD/MM/YYYY",
    }),
  ).toBe("2026-06-05");
  expect(
    functions.format.parseDisplayDate("June 5, 2026", {
      dateFormat: "MMMM D, YYYY",
    }),
  ).toBe("2026-06-05");
});
it("rejects text that names no real date or does not follow the pattern", () => {
  for (const bad of [
    "31-Feb-2026",
    "05-Jux-2026",
    "2026-06-05",
    "",
    "5 Jun 2026",
  ])
    expect(functions.format.parseDisplayDate(bad)).toBeUndefined();
});
it("round-trips with the display formatter", () => {
  const settings = { dateFormat: "DD.MM.YY" };
  expect(
    functions.format.parseDisplayDate(
      functions.format.dateDisplay("2026-12-31", settings),
      settings,
    ),
  ).toBe("2026-12-31");
});
it("shows an instant in the viewer's zone, a wall-clock time as written, as legacy's datetime converter", () => {
  const instant = "2026-10-13T13:47:01Z";
  expect(functions.format.stampDisplay(instant)).toBe(
    moment(instant).format("DD-MMM-YYYY HH:mm:ss"),
  );
  expect(functions.format.stampDisplay("2026-10-13T13:47:01")).toBe(
    "13-Oct-2026 13:47:01",
  );
  // Fixed zones: Oracle's 17:35Z is 23:05 in India and 18:35 in the UK (BST).
  const at = (zone: string) =>
    moment("2026-10-13T17:35:15Z")
      .utcOffset(zone === "IST" ? 330 : 60)
      .format("DD-MMM-YYYY HH:mm:ss");
  expect(at("IST")).toBe("13-Oct-2026 23:05:15");
  expect(at("BST")).toBe("13-Oct-2026 18:35:15");
  expect(functions.format.stampDisplay("2026-10-13")).toBe("13-Oct-2026");
  expect(functions.format.stampDisplay(null)).toBe("—");
});
