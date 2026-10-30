import "server-only";
import { z } from "zod";
import { claims } from "@/server/oracle/api";
import { AppError } from "@/lib/errors";
import { clearedFundFilters } from "@/features/modules/claims/funds/schema";
import type { FundSummary } from "@/features/modules/claims/funds/types";
import { constants } from "@/lib/constants";

import { actor, fundPage, fundQuery } from "./listing";
import { accountSummary } from "./record/summary";

const summaryInput = z
  .object({
    id: z.coerce.number().int().positive(),
    year: z.string().regex(/^\d{4}$/),
  })
  .strict();
/**
 * A fund's account summary (legacy viewFundSummary). The fund must be one this user's listing shows for its year.
 * `spent` is a fraction: the backend sends 0–100 and legacy's dialog showed it undivided (45% read 4,500%).
 */
export async function fundSummary(raw: unknown): Promise<FundSummary> {
  const parsed = summaryInput.safeParse(raw);
  if (!parsed.success) throw new AppError("BAD_REQUEST", "Invalid fund.", 400);
  const input = parsed.data;
  const { user, rows } = await actor();
  const scan = await claims.fundList({
    orgId: user.organizationId,
    query: fundQuery(
      { ...clearedFundFilters(), year: input.year },
      false,
      constants.paging.claimsScan,
    ),
  });
  if (!fundPage.parse(scan).items.some((f) => f.app_fund_id === input.id))
    throw new AppError("BAD_REQUEST", "The fund was not found.", 404);
  return accountSummary(input.id, rows);
}
