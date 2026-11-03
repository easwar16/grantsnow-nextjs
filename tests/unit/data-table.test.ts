import { afterEach, expect, it, vi } from "vitest";
import { JSDOM } from "jsdom";
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { DataTable } from "@/components/ui/data-table";

const dom = new JSDOM("<!doctype html><div id=root></div>");
Object.assign(globalThis, {
  window: dom.window,
  document: dom.window.document,
  IS_REACT_ACT_ENVIRONMENT: true,
});
type Line = { key: string; name: string; amount: number; children?: Line[] };
let root: Root | undefined;
afterEach(() => act(() => root?.unmount()));
async function render(props: Parameters<typeof DataTable<Line>>[0]) {
  root = createRoot(document.getElementById("root")!);
  await act(async () => root!.render(createElement(DataTable<Line>, props)));
  return document.getElementById(props.id)!;
}
const columns = [
  { id: "name", header: "Name", cell: (l: Line) => l.name },
  {
    id: "amount",
    header: "Amount",
    align: "end" as const,
    cell: (l: Line) => String(l.amount),
    footer: "30",
  },
];

it("renders rows by key, a pinned actions column whose buttons call the parent, and a footer", async () => {
  const edit = vi.fn();
  const table = await render({
    id: "costs",
    columns,
    rows: [
      { key: "a", name: "Travel", amount: 10 },
      { key: "b", name: "Staff", amount: 20 },
    ],
    rowKey: (l) => l.key,
    actions: [
      {
        id: "edit",
        icon: "edit",
        label: (l) => `Edit ${l.name}`,
        onClick: edit,
        disabled: (l) => l.key === "b",
      },
    ],
  });
  expect([...table.querySelectorAll("tbody tr")].map((r) => r.id)).toEqual([
    "costs-a",
    "costs-b",
  ]);
  const button = document.getElementById("costs-a-edit") as HTMLButtonElement;
  expect(button.closest("td")!.className).toContain("gn-table-actions");
  expect(table.querySelector("thead th:last-child")!.className).toContain(
    "gn-table-actions",
  );
  await act(async () => button.click());
  expect(edit).toHaveBeenCalledWith(expect.objectContaining({ key: "a" }));
  expect(
    (document.getElementById("costs-b-edit") as HTMLButtonElement).disabled,
  ).toBe(true);
  expect(table.querySelector("tfoot")!.textContent).toBe("30");
});

it("shows the empty message across every column", async () => {
  const table = await render({
    id: "none",
    columns,
    rows: [],
    rowKey: (l) => l.key,
    actions: [{ id: "x", icon: "edit", label: () => "x", onClick: () => {} }],
    empty: "No data to display.",
  });
  const cell = document.getElementById("none-empty")!;
  expect(cell.getAttribute("colspan")).toBe("3");
  expect(table.textContent).toContain("No data to display.");
});

it("renders a tree expanded, and collapses a branch from its expander", async () => {
  const table = await render({
    id: "tree",
    columns,
    rows: [
      {
        key: "s",
        name: "Section",
        amount: 30,
        children: [{ key: "l", name: "Line", amount: 30 }],
      },
    ],
    rowKey: (l) => l.key,
    childrenOf: (l) => l.children,
  });
  expect(table.getAttribute("role")).toBe("treegrid");
  expect(document.getElementById("tree-l")!.getAttribute("aria-level")).toBe(
    "2",
  );
  const toggle = document.getElementById("tree-s-toggle")!;
  expect(toggle.getAttribute("aria-expanded")).toBe("true");
  await act(async () => toggle.click());
  expect(document.getElementById("tree-l")).toBeNull();
  expect(toggle.getAttribute("aria-expanded")).toBe("false");
});

it("puts a column's class on its header too, and the actions column's and an action's own classes", async () => {
  const table = await render({
    id: "classes",
    columns: [{ ...columns[1], className: "number" }],
    rows: [{ key: "a", name: "Travel", amount: 10 }],
    rowKey: (l) => l.key,
    actions: [
      {
        id: "save",
        icon: "save",
        label: () => "Save",
        className: "gn-btn gn-btn--icon",
        onClick: () => {},
      },
    ],
    actionsClassName: "wide",
  });
  expect(table.querySelector("thead th")!.className).toContain("number");
  expect(table.querySelector("thead th:last-child")!.className).toBe(
    "gn-table-actions wide",
  );
  expect(document.getElementById("classes-a-save")!.className).toBe(
    "gn-btn gn-btn--icon",
  );
});

it("takes the parent's own rows, action-cell content, empty id, footer class and tree indents", async () => {
  const table = await render({
    id: "periods",
    rowIds: "period",
    emptyId: "periods-none",
    columns: [{ ...columns[0], className: "num", footer: "Total" }],
    rows: [
      {
        key: "s",
        name: "Section",
        amount: 1,
        children: [{ key: "l", name: "Line", amount: 1 }],
      },
      { key: "e", name: "Editing", amount: 0 },
    ],
    rowKey: (l) => l.key,
    childrenOf: (l) => l.children,
    rowLabel: (l) => `Toggle ${l.name}`,
    indent: (depth, leaf) => (leaf ? "30px" : `${depth * 19}px`),
    actionCell: (l) => (l.children ? null : `menu ${l.key}`),
    renderRow: (l) =>
      l.key === "e"
        ? createElement("tr", { id: "period-editor" }, createElement("td"))
        : null,
  });
  expect(document.getElementById("period-editor")).not.toBeNull();
  expect(document.getElementById("period-e")).toBeNull();
  expect(
    document.getElementById("period-s-toggle")!.getAttribute("aria-label"),
  ).toBe("Toggle Section");
  const leaf = document.getElementById("period-l")!;
  expect(leaf.querySelector("td.gn-table-actions")!.textContent).toBe("menu l");
  expect(
    (leaf.querySelector("th > span") as HTMLElement).style.paddingInlineStart,
  ).toBe("30px");
  expect(table.querySelector("tfoot td")!.className).toContain("num");
});

it("lets a cell span columns, skipping the ones it covers", async () => {
  const table = await render({
    id: "span",
    columns: [
      {
        id: "name",
        header: "Name",
        cell: (l) => l.name,
        span: (l) => (l.children ? 2 : 1),
      },
      { id: "a", header: "A", cell: (l) => String(l.amount) },
      { id: "b", header: "B", cell: () => "b" },
    ],
    rows: [
      { key: "h", name: "Head", amount: 1, children: [] },
      { key: "l", name: "Line", amount: 2 },
    ],
    rowKey: (l) => l.key,
  });
  const [head, line] = table.querySelectorAll("tbody tr");
  expect(head.children).toHaveLength(2);
  expect(head.children[0].getAttribute("colspan")).toBe("2");
  expect(line.children).toHaveLength(3);
});
