import { describe, expect, it } from "vitest";
import {
  chatPosition,
  dragTo,
  keepInView,
  nearestEdge,
  snapToEdge,
  toEdge,
} from "@/components/chatbot/position";
const box = (left: number, top: number) => ({
  left,
  top,
  width: 55,
  height: 55,
});
describe("chatPosition (GN-Angular spec)", () => {
  it("opens above a bottom-left launcher, kept 10px from the left edge", () => {
    expect(
      chatPosition({ top: 830, bottom: 885, right: 70, height: 55 }, 1440, 900),
    ).toEqual({ top: 220, left: 10, width: 450, height: 600 });
  });
  it("opens below a launcher snapped to the top, right-aligned to it", () => {
    expect(
      chatPosition({ top: 15, bottom: 70, right: 1425, height: 55 }, 1440, 900),
    ).toMatchObject({ top: 80, left: 975 });
  });
  it("fits a phone-sized window from the default bottom-right spot", () => {
    expect(
      chatPosition({ top: 597, bottom: 652, right: 345, height: 55 }, 360, 667),
    ).toEqual({ top: 10, left: 10, width: 340, height: 582 });
  });
});
describe("launcher snapping", () => {
  it("snaps to the nearest edge with a 15px margin", () => {
    expect(nearestEdge(box(5, 400), 1000, 800)).toBe("left");
    expect(snapToEdge(box(5, 400), 1000, 800)).toEqual({ left: 15, top: 400 });
    expect(snapToEdge(box(900, 790), 1000, 800)).toEqual({
      left: 900,
      top: 730,
    });
    expect(snapToEdge(box(500, 3), 1000, 800)).toEqual({ left: 500, top: 15 });
  });
  it("clamps the other axis into the margin box", () => {
    expect(snapToEdge(box(980, 0), 1000, 800)).toEqual({ left: 930, top: 15 });
  });
  it("moves to a chosen edge from the keyboard", () => {
    expect(toEdge(box(930, 730), "top", 1000, 800)).toEqual({
      left: 930,
      top: 15,
    });
    expect(toEdge(box(930, 730), "left", 1000, 800)).toEqual({
      left: 15,
      top: 730,
    });
  });
  it("keeps drags and resizes inside the window", () => {
    expect(dragTo(box(900, 700), 500, 500, 1000, 800)).toEqual({
      left: 945,
      top: 745,
    });
    expect(dragTo(box(10, 10), -50, -50, 1000, 800)).toEqual({
      left: 0,
      top: 0,
    });
    expect(keepInView(box(930, 730), 600, 500)).toEqual({
      left: 530,
      top: 430,
    });
    expect(keepInView(box(15, 15), 600, 500)).toEqual({ left: 15, top: 15 });
  });
});
