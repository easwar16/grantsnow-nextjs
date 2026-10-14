import "server-only";
import { z } from "zod";
import { authenticate } from "@/server/session/service";
import { requireModule } from "@/server/permissions/policy";
import { oracle } from "@/server/api/transport";
import { resources } from "@/server/configuration/resources";
import { AppError } from "@/lib/errors";
export const eoiQuerySchema = z.object({
  search: z.string().max(200).default(""),
  reference: z.string().max(100).default(""),
  status: z
    .string()
    .regex(/^[A-Z0-9_]{0,40}$/)
    .default(""),
  page: z.coerce.number().int().min(1).max(10000).default(1),
});
export type EoiQuery = z.infer<typeof eoiQuerySchema>;
const text = z.string().nullish();
const schema = z.object({
  items: z.array(
    z.object({
      request_id: z.number().int().positive(),
      request_number: z.string(),
      status: text,
      status_lkp_code: text,
      opp_heading: text,
      full_name: text,
      org_unit_name: text,
      funders: text,
      creation_date: text,
      last_update_date: text,
    }),
  ),
  totalcount: z.union([
    z.number().int().nonnegative(),
    z.string().regex(/^\d+$/).transform(Number),
  ]),
  hasMore: z.union([z.boolean(), z.enum(["true", "false"])]),
});
export function eoiOracleQuery(q: EoiQuery) {
  const literal = (v: string) => `'${v.replace(/'/g, "''")}'`;
  const parts: string[] = [];
  if (q.search)
    parts.push(`LOWER("opp_heading") LIKE LOWER(${literal(`%${q.search}%`)})`);
  if (q.reference)
    parts.push(
      `LOWER("request_number") LIKE LOWER(${literal(`%${q.reference}%`)})`,
    );
  if (q.status) parts.push(`"status_lkp_code"=${literal(q.status)}`);
  return new URLSearchParams({
    p_offset: String((q.page - 1) * 25),
    p_limit: "25",
    p_order_by: '"creation_date"',
    p_sort_order: "DESC",
    ...(parts.length ? { p_where_clause: `(${parts.join(" AND ")})` } : {}),
  });
}
export async function listEois(q: EoiQuery, signal?: AbortSignal) {
  const { user, session } = await authenticate();
  requireModule(user, "opportunities-eoi-list");
  const [raw, labels] = await Promise.all([
    oracle(
      "getDynamicFormsAllRequests",
      { token: session.token, p_module_name: "OPPORTUNITIES-EOI" },
      eoiOracleQuery(q),
      signal,
    ),
    resources(),
  ]);
  const b = schema.parse(raw);
  const visible = new Set(
    labels
      .filter(
        (r) =>
          r.module_name.toLowerCase() === "opportunities-eoi" &&
          r.label_type === "labels" &&
          r.is_visible === "Y",
      )
      .map((r) => r.label_name),
  );
  const show = (key: string) => visible.has(key);
  const rows = b.items.map((r) => ({
    id: String(r.request_id),
    reference: r.request_number,
    status: show("eoi-status") ? r.status || undefined : undefined,
    title: show("eoi-list-opportunity-title")
      ? r.opp_heading || undefined
      : undefined,
    investigator: show("eoi-list-created-by")
      ? r.full_name || undefined
      : undefined,
    organization: show("eoi-list-department")
      ? r.org_unit_name || undefined
      : undefined,
    sponsor: show("eoi-list-sponsor") ? r.funders || undefined : undefined,
    created: show("eoi-list-created-on")
      ? r.creation_date || undefined
      : undefined,
    updated: show("eoi-list-updated-on")
      ? r.last_update_date || undefined
      : undefined,
  }));
  if (new Set(rows.map((r) => r.id)).size !== rows.length)
    throw new AppError("CONTRACT", "Oracle returned duplicate applications.");
  return {
    rows,
    total: b.totalcount,
    hasMore: b.hasMore === true || b.hasMore === "true",
    query: q,
  };
}
