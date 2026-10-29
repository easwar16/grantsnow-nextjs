"use client";
import { useEffect } from "react";

// Hover reaches the clipped element through its inner spans (a highlighted match, an icon) within a few levels.
const DEPTH = 4;
const AUTO = "data-auto-title";

/** The element's text when its styles cut it (an ellipsis or a line clamp) and it does not fit; otherwise null. */
function clippedText(el: HTMLElement) {
  const style = getComputedStyle(el);
  // An input cuts its value without an ellipsis style; a textarea scrolls instead, so it is left alone.
  const field = el instanceof HTMLInputElement;
  const clips =
    field ||
    style.textOverflow === "ellipsis" ||
    (style.webkitLineClamp !== "" && style.webkitLineClamp !== "none");
  if (!clips) return null;
  const cut =
    el.scrollWidth > el.clientWidth || el.scrollHeight > el.clientHeight + 1;
  if (!cut) return null;
  const text = (field ? el.value : el.innerText || el.textContent || "").trim();
  return text || null;
}

/**
 * Every truncated text in the app shows its full value as a tooltip on hover (owner, 2026-10-29), so a cut name is
 * never missed. One listener for the whole document, dialogs and dropdown panels included; a title set on purpose
 * is never replaced, and the added one goes when the text fits again.
 */
export function TruncatedTitles() {
  useEffect(() => {
    const over = (event: PointerEvent) => {
      let el = event.target instanceof HTMLElement ? event.target : null;
      for (let level = 0; el && level < DEPTH; level++, el = el.parentElement) {
        const own = el.hasAttribute("title") && !el.hasAttribute(AUTO);
        if (own) return;
        const text = clippedText(el);
        if (text) {
          el.setAttribute("title", text);
          el.setAttribute(AUTO, "");
          return;
        }
        if (el.hasAttribute(AUTO)) {
          el.removeAttribute("title");
          el.removeAttribute(AUTO);
        }
      }
    };
    document.addEventListener("pointerover", over);
    return () => document.removeEventListener("pointerover", over);
  }, []);
  return null;
}
