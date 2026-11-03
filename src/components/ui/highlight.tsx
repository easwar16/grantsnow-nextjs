import type { ReactNode } from "react";

/** The text with every case-insensitive occurrence of `needle` in bold, so a typed search shows what matched. */
export function highlight(text: string, needle: string): ReactNode {
  if (needle === "") return text;
  const parts: ReactNode[] = [],
    lower = text.toLowerCase();
  let from = 0;
  for (
    let at = lower.indexOf(needle);
    at !== -1;
    at = lower.indexOf(needle, from)
  ) {
    if (at > from) parts.push(text.slice(from, at));
    parts.push(
      <b key={at} data-match="">
        {text.slice(at, at + needle.length)}
      </b>,
    );
    from = at + needle.length;
  }
  if (from < text.length) parts.push(text.slice(from));
  return parts;
}
