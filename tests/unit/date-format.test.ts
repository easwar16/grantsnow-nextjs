import { expect, it } from "vitest";
import { dateDisplay, datePattern, parseDisplayDate } from "@/lib/format";
it("uses the configured pattern as the placeholder, falling back when it has an unknown token", () => {
  expect(datePattern()).toBe("DD-MMM-YYYY");
  expect(datePattern({ dateFormat: "dd/mm/yyyy" })).toBe("DD/MM/YYYY");
  expect(datePattern({ dateFormat: "Do MMM YYYY" })).toBe("DD-MMM-YYYY");
});
it("reads a date typed in the configured pattern back to ISO", () => {
  expect(parseDisplayDate("05-Jun-2026")).toBe("2026-06-05");
  expect(parseDisplayDate(" 5-jun-2026 ")).toBe("2026-06-05");
  expect(parseDisplayDate("05/06/2026", { dateFormat: "DD/MM/YYYY" })).toBe(
    "2026-06-05",
  );
  expect(parseDisplayDate("June 5, 2026", { dateFormat: "MMMM D, YYYY" })).toBe(
    "2026-06-05",
  );
});
it("rejects text that names no real date or does not follow the pattern", () => {
  for (const bad of [
    "31-Feb-2026",
    "05-Jux-2026",
    "2026-06-05",
    "",
    "5 Jun 2026",
  ])
    expect(parseDisplayDate(bad)).toBeUndefined();
});
it("round-trips with the display formatter", () => {
  const settings = { dateFormat: "DD.MM.YY" };
  expect(parseDisplayDate(dateDisplay("2026-12-31", settings), settings)).toBe(
    "2026-12-31",
  );
});
