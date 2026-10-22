/**
 * Funder tags: split on commas outside parentheses, so "X (A, B)" stays one tag (VBCS split on every comma).
 * A stray ")" never drives the depth below zero.
 */
export function splitFunders(value: string | null | undefined): string[] {
  if (value === null || value === undefined || value === "") return [];
  const tags: string[] = [];
  let depth = 0,
    start = 0;
  for (let i = 0; i < value.length; i++) {
    const c = value[i];
    if (c === "(") depth++;
    else if (c === ")") depth = Math.max(0, depth - 1);
    else if (c === "," && depth === 0) {
      tags.push(value.slice(start, i));
      start = i + 1;
    }
  }
  tags.push(value.slice(start));
  return tags.map((t) => t.trim()).filter((t) => t !== "");
}

/** VBCS canCreate: no Apply or Convert on a closed, expired or withdrawn opportunity. */
export const canCreate = (status: string) =>
  !["CLOSED", "EXPIRED", "WITHDRAWN"].includes(status.toUpperCase());
