import { expect, it } from "vitest";
import {
  clampWidth,
  keyWidth,
  maxWidth,
  PANEL_WIDTH,
  parseStoredWidth,
  storageKey,
} from "@/components/ui/filter-panel-width";

it("bounds the panel between its minimum and the room the results need", () => {
  expect(maxWidth(2000)).toBe(PANEL_WIDTH.max);
  expect(maxWidth(700)).toBe(380);
  // A container too narrow for both still keeps the minimum panel width.
  expect(maxWidth(300)).toBe(PANEL_WIDTH.min);
  expect(clampWidth(100, 2000)).toBe(PANEL_WIDTH.min);
  expect(clampWidth(900, 2000)).toBe(PANEL_WIDTH.max);
  expect(clampWidth(500, 700)).toBe(380);
  expect(clampWidth(300.6, 2000)).toBe(301);
});

it("moves by keyboard steps, jumps to the bounds and ignores other keys", () => {
  expect(keyWidth("ArrowRight", 240, 2000)).toBe(256);
  expect(keyWidth("ArrowLeft", 240, 2000)).toBe(224);
  expect(keyWidth("ArrowLeft", 205, 2000)).toBe(PANEL_WIDTH.min);
  expect(keyWidth("ArrowRight", 552, 2000)).toBe(PANEL_WIDTH.max);
  expect(keyWidth("Home", 400, 2000)).toBe(PANEL_WIDTH.min);
  expect(keyWidth("End", 240, 700)).toBe(380);
  expect(keyWidth("Enter", 240, 2000)).toBeUndefined();
  expect(keyWidth("ArrowUp", 240, 2000)).toBeUndefined();
});

it("accepts only a positive stored number, keyed per page", () => {
  expect(parseStoredWidth("320")).toBe(320);
  for (const raw of [null, "", "abc", "-5", "0", "Infinity"])
    expect(parseStoredWidth(raw)).toBeUndefined();
  expect(storageKey("proposals")).not.toBe(storageKey("opportunities"));
});
