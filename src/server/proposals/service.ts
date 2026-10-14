import { formattingConfiguration } from "@/server/configuration/formatting";
import "server-only";
import { z } from "zod";
import { authenticate } from "@/server/session/service";
import { requireModule } from "@/server/permissions/policy";
import { oracle } from "@/server/api/transport";
import { oracleQuery, type ProposalQuery } from "@/features/proposals/schemas";
import type {
  Column,
  ProposalPage,
  ProposalRow,
} from "@/features/proposals/types";
import { AppError } from "@/lib/errors";
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
  hasMore: z.union([z.boolean(), z.enum(["true", "false"])]).optional(),
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
  if (b.hasMore === undefined && b.total_count === undefined)
    throw new AppError("CONTRACT", "Oracle listing omitted paging metadata.");
  return {
    rows,
    total: b.total_count,
    hasMore:
      b.hasMore === undefined
        ? offset + rows.length < (b.total_count ?? 0)
        : b.hasMore === true || b.hasMore === "true",
    offset,
    query: q,
  };
}
export async function listProposals(
  q: ProposalQuery,
  columns: Column[],
  signal?: AbortSignal,
) {
  const { user, session } = await authenticate();
  requireModule(user, "PROPOSALS");
  const formatting = await formattingConfiguration();
  // Token defines row scope in the existing listing. Never accept a browser identity/org header.
  const page = mapProposals(
    await oracle(
      "getPre_awardGetProposalsList",
      { token: session.token },
      oracleQuery(q),
      signal,
    ),
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
