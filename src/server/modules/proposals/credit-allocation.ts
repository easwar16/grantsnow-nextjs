import "server-only";
import { z } from "zod";
import { AppError } from "@/lib/errors";
import { proposals } from "@/server/oracle/api";
import type { RecordIdentity } from "@/features/modules/proposals/record";
import { budgetVersions } from "./budget";
import { proposalPage } from "./record";

const allocationResponse = z.object({
  items: z.array(
    z.object({
      credit_alloc_id: z.coerce.number().int().positive(),
      full_name: z.string().nullish(),
      proposal_number: z.string().nullish(),
      project_role_name: z.string().nullish(),
      org_unit_name: z.string().nullish(),
      prj_effort: z.union([z.number(), z.string()]).nullish(),
      credit_pct: z.union([z.number(), z.string()]).nullish(),
    }),
  ),
});

export function mapCreditAllocation(raw: unknown) {
  const parsed = allocationResponse.safeParse(raw);
  if (!parsed.success)
    throw new AppError(
      "CONTRACT",
      "Oracle returned invalid Credit Allocation.",
    );
  return parsed.data.items.map((row) => ({
    id: row.credit_alloc_id,
    name: row.full_name || "",
    proposalNumber: row.proposal_number || "",
    role: row.project_role_name || "",
    orgUnit: row.org_unit_name || "",
    effort: row.prj_effort ?? "",
    credit: row.credit_pct ?? "",
  }));
}

export async function proposalCreditAllocation(
  type: RecordIdentity["type"],
  id: string,
  previewVersionId?: number,
) {
  const context = await proposalPage(
    type,
    id,
    "proposals-allocation-for-credit",
  );
  if (previewVersionId !== undefined) {
    const versions = await budgetVersions(type, id);
    if (!versions.some((version) => version.id === previewVersionId))
      throw new AppError("BAD_REQUEST", "Invalid Budget version.", 400);
  }
  const versionId = previewVersionId ?? context.summary.budgetVersionId;
  if (versionId === null)
    return { rows: [], bundle: context.bundle, versionId: null };
  const raw = await proposals.creditAllocation({ versionId });
  return {
    rows: mapCreditAllocation(raw),
    bundle: context.bundle,
    versionId,
  };
}
