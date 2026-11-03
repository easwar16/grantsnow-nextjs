import { afterEach, expect, it } from "vitest";
import { JSDOM } from "jsdom";
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { TruncatedTitles } from "@/components/layout/truncated-titles";

// jsdom has no layout, so each element's text and box widths are given.
const dom = new JSDOM("<!doctype html><div id=root></div><div id=page></div>");
Object.assign(globalThis, {
  window: dom.window,
  document: dom.window.document,
  HTMLElement: dom.window.HTMLElement,
  HTMLInputElement: dom.window.HTMLInputElement,
  getComputedStyle: dom.window.getComputedStyle.bind(dom.window),
  IS_REACT_ACT_ENVIRONMENT: true,
});
let root: Root | undefined;
afterEach(() => {
  act(() => root?.unmount());
  document.getElementById("page")!.innerHTML = "";
});
function sized(html: string, text: number, box: number) {
  const page = document.getElementById("page")!;
  page.innerHTML = html;
  const el = page.firstElementChild as HTMLElement;
  Object.defineProperty(el, "scrollWidth", {
    configurable: true,
    get: () => text,
  });
  Object.defineProperty(el, "clientWidth", {
    configurable: true,
    get: () => box,
  });
  return el;
}
const hover = (el: Element) =>
  el.dispatchEvent(
    new dom.window.PointerEvent("pointerover", { bubbles: true }),
  );
async function mount() {
  root = createRoot(document.getElementById("root")!);
  await act(async () => root!.render(createElement(TruncatedTitles)));
}

it("titles a cut ellipsis text with its full value, reached through an inner span", async () => {
  await mount();
  const el = sized(
    '<span style="text-overflow: ellipsis; overflow: hidden">University of <b>Glasgow</b> (Funder)</span>',
    300,
    120,
  );
  hover(el.querySelector("b")!);
  expect(el.getAttribute("title")).toBe("University of Glasgow (Funder)");
});

it("leaves text that fits, plain overflow and an author's own title alone", async () => {
  await mount();
  const fits = sized(
    '<span style="text-overflow: ellipsis">Short</span>',
    50,
    120,
  );
  hover(fits);
  expect(fits.hasAttribute("title")).toBe(false);
  const scroller = sized(
    '<div style="overflow: auto">A long list</div>',
    900,
    120,
  );
  hover(scroller);
  expect(scroller.hasAttribute("title")).toBe(false);
  const own = sized(
    '<span style="text-overflow: ellipsis" title="Chosen">Something long</span>',
    300,
    120,
  );
  hover(own);
  expect(own.getAttribute("title")).toBe("Chosen");
});

it("drops its title once the text fits again", async () => {
  await mount();
  const el = sized(
    '<span style="text-overflow: ellipsis">Engineering Council</span>',
    300,
    120,
  );
  hover(el);
  expect(el.getAttribute("title")).toBe("Engineering Council");
  Object.defineProperty(el, "clientWidth", {
    configurable: true,
    get: () => 400,
  });
  hover(el);
  expect(el.hasAttribute("title")).toBe(false);
});
