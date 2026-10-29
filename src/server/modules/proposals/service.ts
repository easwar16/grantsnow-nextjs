import { formattingConfiguration } from "@/server/platform/configuration/formatting";
import "server-only";
import { z } from "zod";
import { authenticate } from "@/server/identity/session/service";
import { proposals } from "@/server/oracle/api";
import type { ProposalQuery } from "@/features/modules/proposals/schemas";
import { oracleQuery } from "./where-clause";
import { sortChoices } from "./lookups";
import type {
  Column,
  ProposalPage,
  ProposalRow,
} from "@/features/modules/proposals/types";
import { AppError } from "@/lib/errors";
import { serverFunctions } from "@/server/functions";
const optional = z.string().nullish();
const rowSchema = z.object({
  proposal_id: z.number().int(),
  proposal_number: z.string(),
  proposal_title: z.string(),
  proposal_status_value: z.string(),
  proposal_type: z.string(),
  full_name: optional,
  proposal_status_code: optional,
  risk_desc: optional,
  risk_code: optional,
  created_by: optional,
  assigned_to_name: optional,
  activity_type_descr: optional,
  proposal_type_descr: optional,
  last_update_date: optional,
  tags: optional,
  org_unit_name: optional,
  primary_sponsorer: optional,
  creation_date: optional,
  proposal_start_date: optional,
  proposal_end_date: optional,
  total_cost: z.union([z.string(), z.number()]).nullish(),
  currency_code: optional,
});
const envelope = z.object({
  items: z.array(rowSchema),
  total_count: z.number().int().nonnegative().optional(),
  offset: z.number().int().nonnegative().optional(),
  size: z.number().optional(),
});
export function mapProposals(
  raw: unknown,
  q: ProposalQuery,
  columns: Column[],
): ProposalPage {
  const parsed = envelope.safeParse(raw);
  if (!parsed.success)
    throw new AppError(
      "CONTRACT",
      "Oracle listing returned an unexpected data shape.",
    );
  const b = parsed.data,
    offset = (q.page - 1) * q.pageSize;
  if (b.offset !== undefined && b.offset !== offset)
    throw new AppError("CONTRACT", "Oracle returned a different listing page.");
  const visible = new Set(columns.map((c) => c.key));
  const rows = b.items.map((r) => {
    const mapped: ProposalRow = {
      id: `${r.proposal_type}:${r.proposal_id}`,
      reference: r.proposal_number,
      title: r.proposal_title,
      status: r.proposal_status_value,
      type: r.proposal_type,
      statusCode: r.proposal_status_code ?? undefined,
      risk: r.risk_desc ?? undefined,
      riskCode: r.risk_code ?? undefined,
    };
    const fields = {
      investigator: r.full_name,
      applicant: r.created_by,
      assignedTo: r.assigned_to_name,
      activity: r.activity_type_descr,
      category: r.proposal_type_descr,
      updated: r.last_update_date,
      tags: r.tags,
      organization: r.org_unit_name,
      sponsor: r.primary_sponsorer,
      created: r.creation_date,
      start: r.proposal_start_date,
      end: r.proposal_end_date,
      value: r.total_cost == null ? undefined : String(r.total_cost),
    };
    for (const [key, value] of Object.entries(fields))
      if (visible.has(key as keyof ProposalRow))
        Object.assign(mapped, { [key]: value ?? undefined });
    if (visible.has("value")) mapped.currency = r.currency_code ?? undefined;
    return mapped;
  });
  if (new Set(rows.map((r) => r.id)).size !== rows.length)
    throw new AppError("CONTRACT", "Oracle returned duplicate row identities.");
  return {
    rows,
    total: b.total_count,
    // This backend's `hasMore` is unreliable (true on a short last page, false mid-list), so it is ignored.
    hasMore:
      b.total_count === undefined
        ? rows.length === q.pageSize
        : offset + rows.length < b.total_count,
    offset,
    query: q,
  };
}
export async function listProposals(
  q: ProposalQuery,
  columns: Column[],
  signal?: AbortSignal,
) {
  const { user } = await authenticate();
  serverFunctions.permissions.requireModule(user, "PROPOSALS");
  if (q.sort !== "" && !(await sortChoices()).some((c) => c.value === q.sort))
    throw new AppError("BAD_REQUEST", "Unsupported listing sort.", 400);
  const formatting = await formattingConfiguration();
  // Token defines row scope in the existing listing. Never accept a browser identity/org header.
  const page = mapProposals(
    await proposals.list({ query: oracleQuery(q) }, { signal }),
    q,
    columns,
  );
  return {
    ...page,
    rows: page.rows.map((row) =>
      row.value !== undefined
        ? { ...row, currency: row.currency || formatting.currency }
        : row,
    ),
  };
}
