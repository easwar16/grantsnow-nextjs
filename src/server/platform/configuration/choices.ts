import "server-only";
import { z } from "zod";

/** A filter's option as the listings' drawers take it. */
export interface Choice {
  value: string;
  label: string;
}
const items = z.object({
  items: z.array(z.record(z.string(), z.unknown())),
});
const str = (v: unknown) =>
  typeof v === "string" && v.trim() !== "" ? v : undefined;

/** One lookup type's codes with "All" (code '') first, as legacy loadLookups adds it for status lists. */
export function statusChoices(raw: unknown, type: string): Choice[] {
  const rows = items
    .parse(raw)
    .items.filter(
      (r) =>
        (r.lookup_type_code ?? type) === type &&
        typeof r.lookup_code === "string" &&
        /^[A-Z0-9_]{1,40}$/.test(r.lookup_code),
    );
  return [
    { value: "", label: "All" },
    ...rows.map((r) => ({
      value: r.lookup_code as string,
      label:
        str(r.lookup_code_descr) ??
        str(r.lookup_code_value) ??
        (r.lookup_code as string),
    })),
  ];
}

const sortColumn = /^[A-Za-z][A-Za-z0-9_]{0,62}$/;
/** getObjectDates: the date columns a listing can sort by; an unsafe column name is dropped. */
export function objectDateChoices(raw: unknown): Choice[] {
  return items.parse(raw).items.flatMap((r) => {
    const value = str(r.column_name);
    return value && sortColumn.test(value)
      ? [{ value, label: str(r.column_description) ?? value }]
      : [];
  });
}

/** Distinct non-empty values of one field, in their order, each its own label (funder and party names). */
export function nameChoices(raw: unknown, field: string): Choice[] {
  const values = items.parse(raw).items.flatMap((r) => str(r[field]) ?? []);
  return [...new Set(values)].map((value) => ({ value, label: value }));
}
