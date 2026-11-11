import "server-only";
import { z } from "zod";
import { AppError } from "@/lib/errors";
import { awards, proposals } from "@/server/oracle/api";
import {
  recordIdentity,
  type RecordIdentity,
} from "@/features/modules/proposals/record";
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
    return {
      rows: [],
      bundle: context.bundle,
      versionId: null,
      canEdit: false,
    };
  const raw = await proposals.creditAllocation({ versionId });
  const pageId = context.pageIds.get("proposals-allocation-for-credit");
  return {
    rows: mapCreditAllocation(raw),
    bundle: context.bundle,
    versionId,
    canEdit:
      previewVersionId === undefined &&
      context.rights.edit &&
      context.summary.statusCode === "DRFT" &&
      pageId != null &&
      !context.summary.lockedPageIds.includes(pageId),
  };
}

const saveInput = z
  .object({
    versionId: z.number().int().positive(),
    rows: z
      .array(
        z
          .object({
            id: z.number().int().positive(),
            effort: z.number().min(0).max(1).nullable(),
            credit: z.number().min(0).max(1),
          })
          .strict(),
      )
      .min(1),
  })
  .strict();

export async function saveProposalCreditAllocation(
  type: string,
  id: string,
  input: unknown,
) {
  const body = saveInput.parse(input);
  const identity = recordIdentity.parse({ type, id });
  const context = await proposalPage(
    identity.type,
    identity.id,
    "proposals-allocation-for-credit",
  );
  const pageId = context.pageIds.get("proposals-allocation-for-credit");
  if (
    !context.rights.edit ||
    context.summary.statusCode !== "DRFT" ||
    pageId == null ||
    context.summary.lockedPageIds.includes(pageId)
  )
    throw new AppError("FORBIDDEN", "Credit Allocation cannot be edited.", 403);
  if (context.summary.budgetVersionId !== body.versionId)
    throw new AppError(
      "BAD_REQUEST",
      "The active Budget version changed. Reload this page.",
      400,
    );
  const fresh = mapCreditAllocation(
    await proposals.creditAllocation({ versionId: body.versionId }),
  );
  if (
    fresh.length !== body.rows.length ||
    new Set(body.rows.map((row) => row.id)).size !== body.rows.length ||
    fresh.some((row) => !body.rows.some((inputRow) => inputRow.id === row.id))
  )
    throw new AppError(
      "BAD_REQUEST",
      "Credit Allocation rows changed. Reload this page.",
      400,
    );
  const total = body.rows.reduce((sum, row) => sum + row.credit, 0);
  if (Math.abs(total - 1) > 0.000001)
    throw new AppError(
      "BAD_REQUEST",
      "Credit Allocation should total to 100%.",
      400,
    );
  await awards.saveCredit({
    periodVersionId: body.versionId,
    body: body.rows.map((row) => ({
      credit_alloc_id: row.id,
      credit_pct: row.credit,
      prj_effort: row.effort,
    })),
  });
  return { saved: true };
}
