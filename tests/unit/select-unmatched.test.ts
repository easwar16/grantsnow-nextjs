import { afterEach, expect, it } from "vitest";
import { JSDOM } from "jsdom";
import { act, createElement, type ReactElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { Select } from "@/components/ui/select";
import { MultiSelect } from "@/components/ui/multi-select";

const dom = new JSDOM("<!doctype html><div id=root></div>");
Object.assign(globalThis, {
  window: dom.window,
  document: dom.window.document,
  Element: dom.window.Element,
  HTMLElement: dom.window.HTMLElement,
  IS_REACT_ACT_ENVIRONMENT: true,
});
let root: Root | undefined;
afterEach(() => act(() => root?.unmount()));
async function render(element: ReactElement) {
  root = createRoot(document.getElementById("root")!);
  await act(async () => root!.render(element));
}
const options = [{ value: "1188", label: "1188" }];

it("shows a Select value that is not among its options as blank (live 621: award 1188 Attribute 5)", async () => {
  await render(
    createElement(Select, {
      id: "attr",
      label: "Attribute 5",
      options,
      value: "AASU",
      onChange: () => {},
    }),
  );
  const field = document.getElementById("attr-trigger") as HTMLInputElement;
  expect(field.value).toBe("");
});

it("shows a matching Select value by its label", async () => {
  await render(
    createElement(Select, {
      id: "attr",
      label: "Attribute 5",
      options,
      value: "1188",
      onChange: () => {},
    }),
  );
  expect(
    (document.getElementById("attr-trigger") as HTMLInputElement).value,
  ).toBe("1188");
});

it("shows no chip or summary for MultiSelect values that are not among its options", async () => {
  await render(
    createElement(MultiSelect, {
      id: "many",
      label: "Tags",
      options,
      value: ["AASU", "1188"],
      onChange: () => {},
    }),
  );
  const host = document.getElementById("many")!;
  expect(host.textContent).toContain("1188");
  expect(host.textContent).not.toContain("AASU");
  expect(document.getElementById("many-remove-aasu")).toBeNull();
});

it("shows a tree option's label without its indent in the field (org units by depth)", async () => {
  await render(
    createElement(Select, {
      id: "org",
      label: "Org",
      options: [{ value: "202", label: "  Grants Now dev" }],
      value: "202",
      onChange: () => {},
    }),
  );
  expect(
    (document.getElementById("org-trigger") as HTMLInputElement).value,
  ).toBe("Grants Now dev");
});
