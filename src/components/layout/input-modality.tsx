"use client";
import { useEffect } from "react";

// Keys that move focus around the page; typing into a field does not switch to keyboard mode.
const NAVIGATION = new Set([
  "Tab",
  "ArrowUp",
  "ArrowDown",
  "ArrowLeft",
  "ArrowRight",
  "Home",
  "End",
  "PageUp",
  "PageDown",
  "Escape",
]);
/**
 * Marks how the user last moved through the page (`data-input` on <html>): "pointer" after a mouse, touch or pen
 * press, "keyboard" after a navigation key. globals.css draws focus rings only in keyboard mode, so a click never
 * leaves an outline while Tab still shows where focus is (WCAG 2.4.7).
 */
export function InputModality() {
  useEffect(() => {
    const root = document.documentElement;
    const pointer = () => (root.dataset.input = "pointer");
    const key = (e: KeyboardEvent) => {
      if (NAVIGATION.has(e.key)) root.dataset.input = "keyboard";
    };
    document.addEventListener("pointerdown", pointer, true);
    document.addEventListener("keydown", key, true);
    return () => {
      document.removeEventListener("pointerdown", pointer, true);
      document.removeEventListener("keydown", key, true);
    };
  }, []);
  return null;
}
