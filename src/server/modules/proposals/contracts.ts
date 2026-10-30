import "server-only";
import { z } from "zod";
import { contracts } from "@/server/oracle/api";
import { organizations } from "@/server/platform/configuration/service";
import { AppError } from "@/lib/errors";
import type { RecordIdentity } from "@/features/modules/proposals/record";
import { proposalPage } from "./record";

const contract = z.object({
  contract_id: z.number().int().positive(),
  contract_number: z.string(),
  contract_title: z.string(),
  status: z.string().nullish(),
  contract_level: z.string().nullish(),
  contract_type_name: z.string().nullish(),
  object_ref_id: z.string(),
  contract_start_date: z.string().nullish(),
  contract_end_date: z.string().nullish(),
  creation_date: z.string().nullish(),
  last_update_date: z.string().nullish(),
  org_id: z.union([z.string(), z.number()]),
  org_unit_name: z.string().nullish(),
  assigned_to_name: z.string().nullish(),
});
const pageSchema = z.object({
  items: z.array(contract),
  offset: z.number().int().nonnegative().optional(),
  total_count: z.number().int().nonnegative().optional(),
});

export function mapProposalContracts(
  raw: unknown,
  reference: string,
  orgIds: string[],
  page: number,
) {
  const offset = (page - 1) * 10;
  const parsed = pageSchema.safeParse(raw);
  if (
    !parsed.success ||
    (parsed.data.offset !== undefined && parsed.data.offset !== offset)
  )
    throw new AppError(
      "CONTRACT",
      "Oracle returned an invalid linked Contracts page.",
    );
  const allowed = new Set(orgIds);
  for (const row of parsed.data.items) {
    if (row.object_ref_id !== reference || !allowed.has(String(row.org_id)))
      throw new AppError(
        "FORBIDDEN",
        "A linked Contract is outside this Proposal scope.",
        403,
      );
  }
  if (
    new Set(parsed.data.items.map((row) => row.contract_id)).size !==
    parsed.data.items.length
  )
    throw new AppError(
      "CONTRACT",
      "Oracle returned duplicate linked Contracts.",
    );
  return {
    rows: parsed.data.items,
    page,
    hasMore:
      parsed.data.total_count === undefined
        ? parsed.data.items.length === 10
        : offset + parsed.data.items.length < parsed.data.total_count,
  };
}

export async function proposalContracts(
  type: RecordIdentity["type"],
  id: string,
  page: number,
) {
  if (!Number.isSafeInteger(page) || page < 1 || page > 100000)
    throw new AppError("BAD_REQUEST", "Invalid Contracts page.", 400);
  const context = await proposalPage(type, id, "proposals-contracts");
  const offset = (page - 1) * 10;
  const [raw, orgs] = await Promise.all([
    contracts.linkedToProposal({
      reference: context.summary.reference,
      offset,
      limit: 10,
    }),
    organizations(),
  ]);
  const pageData = mapProposalContracts(
    raw,
    context.summary.reference,
    orgs.map((org) => org.id),
    page,
  );
  return {
    ...pageData,
    bundle: context.bundle,
    canOpen: context.user.modules.CONTRACTS === true,
  };
}
