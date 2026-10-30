import "server-only";
import { z } from "zod";
import { AppError } from "@/lib/errors";
import { proposals } from "@/server/oracle/api";
import type { RecordIdentity } from "@/features/modules/proposals/record";
import { proposalPage } from "./record";
import { sumCost } from "./budget";

const amount = z.union([z.string(), z.number()]).nullish();
const pricingResponse = z.object({
  items: z.array(
    z.object({
      proposal_id: z.coerce.number().int().positive(),
      funding_section_header_lkp_code: z.string().nullish(),
      institution_cost: amount,
      funder_cost: amount,
      fec_cost: amount,
      unindex_cost: amount,
      funder_percent_unindexed: amount,
    }),
  ),
});

function ratio(numerator: string | number, denominator: string | number) {
  const n = Number(numerator);
  const d = Number(denominator);
  if (!Number.isFinite(n)) return String(numerator);
  if (!Number.isFinite(d)) return String(denominator);
  return d === 0 ? 0 : n / d;
}

export function mapPricing(raw: unknown, proposalId: string) {
  const parsed = pricingResponse.safeParse(raw);
  if (!parsed.success)
    throw new AppError("CONTRACT", "Oracle returned invalid Funder Rules.");
  if (parsed.data.items.some((row) => String(row.proposal_id) !== proposalId))
    throw new AppError(
      "FORBIDDEN",
      "Funder Rules are outside this Proposal scope.",
      403,
    );
  const rows = parsed.data.items.filter(
    (row) => row.funding_section_header_lkp_code,
  );
  const sum = (
    key: "institution_cost" | "funder_cost" | "fec_cost" | "unindex_cost",
  ) => sumCost(rows.map((row) => row[key]));
  const institution = sum("institution_cost");
  const funder = sum("funder_cost");
  const indexed = sum("fec_cost");
  const unindexed = sum("unindex_cost");
  const maskedUnindexedPercent = rows
    .map((row) => row.funder_percent_unindexed)
    .find((value) => value != null && !Number.isFinite(Number(value)));
  return {
    institution,
    institutionPercent: ratio(institution, indexed),
    funder,
    funderPercent: ratio(funder, indexed),
    unindexedFunderPercent:
      maskedUnindexedPercent == null
        ? ratio(funder, unindexed)
        : String(maskedUnindexedPercent),
    indexed,
    unindexed,
  };
}

export async function proposalPricing(
  type: RecordIdentity["type"],
  id: string,
) {
  const context = await proposalPage(type, id, "proposals-pricing");
  const raw = await proposals.pricingDetails({ proposalId: id });
  return {
    ...mapPricing(raw, id),
    bundle: context.bundle,
    reference: context.summary.reference,
  };
}
