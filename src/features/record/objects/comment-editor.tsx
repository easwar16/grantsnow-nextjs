"use client";
import { useEffect, useRef, useState } from "react";
import Quill from "quill";
import Embed from "quill/blots/embed";
import "quill/dist/quill.snow.css";
import { type MentionPerson } from "@/lib/mentions";
import styles from "./panels.module.css";
import { functions } from "@/lib/functions";

/** A person mention as one atomic anchor, written as legacy's UserMentionCustomization writes it. */
class MentionBlot extends Embed {
  static blotName = "mention";
  static tagName = "A";
  static className = "mention";
  static create(person: MentionPerson) {
    const node = super.create() as HTMLElement;
    for (const [name, value] of functions.mentions.mentionAttributes(person))
      node.setAttribute(name, value);
    node.textContent = functions.mentions.mentionText(person);
    return node;
  }
  static value(node: HTMLElement): MentionPerson {
    return {
      id: node.getAttribute("data-person-id") ?? "",
      name: node.getAttribute("data-first-name") ?? "",
      detail: "",
      email: node.getAttribute("data-email-address") ?? "",
    };
  }
}
Quill.register(MentionBlot, true);

// The oj-sp-input-rich-text-2 context toolbar: bold, italic, underline, strikethrough, bullet list.
const TOOLBAR = [
  ["bold", "italic", "underline", "strike"],
  [{ list: "bullet" }],
];
const FORMATS = ["bold", "italic", "underline", "strike", "list", "mention"];
const EMPTY = "<p><br></p>";
/** The editor's HTML as stored: mentions without Quill's guards, bullet lists as `<ul>`, no editor-only parts. */
function editorHtml(root: HTMLElement) {
  if (root.innerHTML === EMPTY) return null;
  const copy = root.cloneNode(true) as HTMLElement;
  copy.querySelectorAll(".ql-ui").forEach((n) => n.remove());
  copy.querySelectorAll<HTMLElement>("a.mention").forEach((a) => {
    a.textContent = (a.textContent ?? "").replaceAll("﻿", "");
  });
  copy.querySelectorAll("ol").forEach((ol) => {
    const items = [...ol.children];
    if (items.some((li) => li.getAttribute("data-list") !== "bullet")) return;
    const ul = document.createElement("ul");
    ul.append(...items);
    ol.replaceWith(ul);
  });
  return copy.innerHTML;
}
const optionId = (id: string, p: MentionPerson) => `${id}-mention-${p.id}`;
interface Menu {
  start: number;
  length: number;
  matches: MentionPerson[];
  active: number;
}
/**
 * The comment input (legacy oj-sp-input-rich-text-2 with a person mention feed): Quill 2 with an `@` dropdown.
 * HTML in and out; an empty editor is null. `id` names the editable area; the dropdown takes `${id}-mentions`.
 */
export default function CommentEditor({
  id,
  value,
  onChange,
  people,
  label,
  disabled = false,
}: {
  id: string;
  value: string | null;
  onChange: (html: string | null) => void;
  people: MentionPerson[];
  label: string;
  disabled?: boolean;
}) {
  const host = useRef<HTMLDivElement>(null),
    quill = useRef<Quill | null>(null),
    shown = useRef<string | null | undefined>(undefined),
    latest = useRef({ onChange, people }),
    menuRef = useRef<Menu | null>(null),
    pickRef = useRef<((p: MentionPerson) => void) | null>(null),
    [menu, setMenuState] = useState<Menu | null>(null),
    [anchor, setAnchor] = useState({ top: 0, left: 0 });
  const listId = `${id}-mentions`;
  useEffect(() => {
    latest.current = { onChange, people };
  }, [onChange, people]);
  useEffect(() => {
    const el = host.current;
    if (!el) return;
    const q = new Quill(el.appendChild(document.createElement("div")), {
      theme: "snow",
      formats: FORMATS,
      modules: { toolbar: TOOLBAR },
    });
    const setMenu = (next: Menu | null) => {
      menuRef.current = next;
      setMenuState(next);
    };
    // The `@query` just before the caret, from this line's text (a mention or other embed ends a query).
    const refresh = () => {
      const range = q.getSelection();
      if (!range || range.length > 0) return setMenu(null);
      const [, offset] = q.getLine(range.index);
      const before = q
        .getContents(range.index - offset, offset)
        .ops.map((op) => (typeof op.insert === "string" ? op.insert : "\n"))
        .join("");
      const typed = functions.mentions.mentionQuery(before);
      const matches = typed
        ? functions.mentions.matchMentions(latest.current.people, typed.query)
        : [];
      if (!typed || matches.length === 0) return setMenu(null);
      const start = range.index - typed.length,
        bounds = q.getBounds(start);
      if (bounds)
        setAnchor({
          top: q.container.offsetTop + bounds.top + bounds.height,
          left: Math.max(0, bounds.left),
        });
      setMenu({ start, length: typed.length, matches, active: 0 });
    };
    const pick = (person: MentionPerson) => {
      const current = menuRef.current;
      if (!current) return;
      q.deleteText(current.start, current.length, "user");
      q.insertEmbed(current.start, "mention", person, "user");
      q.insertText(current.start + 1, " ", "user");
      q.setSelection(current.start + 2, 0, "user");
      setMenu(null);
    };
    pickRef.current = pick;
    q.on("text-change", () => {
      const html = editorHtml(q.root);
      shown.current = html;
      latest.current.onChange(html);
      refresh();
    });
    q.on("selection-change", (range) =>
      range === null ? setMenu(null) : refresh(),
    );
    // Capture runs before Quill's own key bindings, so Enter picks instead of breaking the line.
    const keys = (e: KeyboardEvent) => {
      const current = menuRef.current;
      if (!current) return;
      const count = current.matches.length;
      if (e.key === "ArrowDown" || e.key === "ArrowUp")
        setMenu({
          ...current,
          active:
            (current.active + (e.key === "ArrowDown" ? 1 : count - 1)) % count,
        });
      else if (e.key === "Enter" || e.key === "Tab")
        pick(current.matches[current.active]);
      else if (e.key === "Escape") setMenu(null);
      else return;
      e.preventDefault();
      e.stopPropagation();
    };
    q.root.addEventListener("keydown", keys, true);
    quill.current = q;
    return () => {
      q.root.removeEventListener("keydown", keys, true);
      quill.current = null;
      pickRef.current = null;
      shown.current = undefined;
      el.replaceChildren();
    };
  }, []);
  useEffect(() => {
    const q = quill.current;
    if (!q || value === shown.current) return;
    shown.current = value;
    q.setContents(q.clipboard.convert({ html: value ?? "" }), "silent");
  }, [value]);
  useEffect(() => {
    quill.current?.enable(!disabled);
  }, [disabled]);
  useEffect(() => {
    const root = quill.current?.root;
    if (!root) return;
    root.setAttribute("role", "textbox");
    root.setAttribute("aria-multiline", "true");
    root.setAttribute("aria-label", label);
    root.setAttribute("id", id);
  }, [label, id]);
  useEffect(() => {
    const root = quill.current?.root;
    if (!root) return;
    const active = menu?.matches[menu.active];
    if (active) {
      root.setAttribute("aria-controls", `${id}-mentions`);
      root.setAttribute("aria-activedescendant", optionId(id, active));
    } else {
      root.removeAttribute("aria-controls");
      root.removeAttribute("aria-activedescendant");
    }
    if (active)
      document
        .getElementById(optionId(id, active))
        ?.scrollIntoView({ block: "nearest" });
  }, [menu, id]);
  return (
    <div className={styles.editor}>
      <div ref={host} />
      {menu && (
        <ul
          id={listId}
          role="listbox"
          aria-label={label}
          className={`${styles.mentions} enter-pop`}
          style={{ top: anchor.top, left: anchor.left }}
        >
          {menu.matches.map((p, i) => (
            <li
              key={p.id}
              id={optionId(id, p)}
              role="option"
              aria-selected={i === menu.active}
              className={styles.mention}
              // Keep the editor's focus and caret: pick on mousedown.
              onMouseDown={(e) => {
                e.preventDefault();
                pickRef.current?.(p);
              }}
            >
              <span>{p.name}</span>
              {p.detail && <small>{p.detail}</small>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
