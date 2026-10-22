"use client";
import { useEffect, useRef } from "react";
import Quill from "quill";
import "quill/dist/quill.snow.css";
import styles from "./rich-text.module.css";
// The original oj-sp-input-rich-text-2 basics: headings, emphasis, lists, links, clearing (GN-Angular D41).
const TOOLBAR = [
  [{ header: [1, 2, 3, false] }],
  ["bold", "italic", "underline", "strike"],
  [{ list: "ordered" }, { list: "bullet" }],
  ["link"],
  ["clean"],
];
const EMPTY = "<p><br></p>";
/**
 * Quill 2 itself, loaded only by <RichText> when an editable field is in view (its own chunk with the snow theme).
 * HTML in and out; an empty editor is no value.
 */
export default function RichTextEditor({
  value,
  onChange,
  onBlur,
  label,
  id,
  invalid,
  disabled,
}: {
  value: string | null;
  onChange: (html: string | null) => void;
  onBlur?: () => void;
  label: string;
  id?: string;
  invalid?: boolean;
  disabled?: boolean;
}) {
  const host = useRef<HTMLDivElement>(null),
    quill = useRef<Quill | null>(null),
    // What the editor holds; undefined until the first value is put in.
    shown = useRef<string | null | undefined>(undefined),
    handlers = useRef({ onChange, onBlur });
  useEffect(() => {
    handlers.current = { onChange, onBlur };
  }, [onChange, onBlur]);
  useEffect(() => {
    const el = host.current;
    if (!el) return;
    const q = new Quill(el.appendChild(document.createElement("div")), {
      theme: "snow",
      modules: { toolbar: TOOLBAR },
    });
    // Quill 2's getSemanticHTML writes every space as &nbsp; (fails length rules); the editor's own HTML does not.
    q.on("text-change", () => {
      const html = q.root.innerHTML === EMPTY ? null : q.root.innerHTML;
      shown.current = html;
      handlers.current.onChange(html);
    });
    q.on("selection-change", (range) => {
      if (range === null) handlers.current.onBlur?.();
    });
    quill.current = q;
    return () => {
      quill.current = null;
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
    root.setAttribute("aria-invalid", invalid ? "true" : "false");
    if (id) root.setAttribute("id", id);
  }, [label, id, invalid]);
  return <div ref={host} className={styles.editor} />;
}
