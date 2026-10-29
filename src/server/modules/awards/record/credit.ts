import "server-only";
import { z } from "zod";
import { awards } from "@/server/oracle/api";
import { resources } from "@/server/platform/configuration/resources";
import { AppError } from "@/lib/errors";
import { pageOf } from "@/shared/awards/award-record";
import type { CreditView } from "@/features/modules/awards/record/credit-types";
import {
  awardPageLock,
  awardRecordRead,
  isDraft,
  type AwardRecordContext,
} from "../record";
import { serverFunctions } from "@/server/functions";

const BUNDLE = "award";
const num = z.coerce.number().nullish();
const rowSchema = z.object({
  credit_alloc_id: z.coerce.number().int().positive(),
  employee_name: z.string().nullish(),
  project_role: z.string().nullish(),
  credit_pct: num,
  project_effort: num,
});
const rowsOf = (context: AwardRecordContext) =>
  z.array(rowSchema).parse(context.raw["Award Credit Allocation"] ?? []);
const OVER = "The credit allocations add up to more than 100%.";

async function creditGates(id: string) {
  const context = await awardRecordRead(id, "credit-allocation");
  const lock = await awardPageLock(context, "credit-allocation");
  return {
    context,
    // Legacy checked the status and the page's edit right, not the lock; the lock now applies as on every tab.
    canEdit:
      isDraft(context) &&
      !lock.locked &&
      context.access.roles.get(pageOf("credit-allocation"))?.edit === true,
  };
}

/**
 * The Credit Allocation tab (legacy awards-credit-allocation, which no tab listed): the award's credit rows from
 * AwardDetails. The backend updates existing rows only (postProposalCreditAllocation), so legacy's Add, which posted
 * a person and role the operation ignores, is not offered.
 */
export async function creditView(id: string): Promise<CreditView> {
  const [{ context, canEdit }, rows] = await Promise.all([
    creditGates(id),
    resources(),
  ]);
  const t = (group: string, key: string, fallback: string) =>
    serverFunctions.resources.label(rows, BUNDLE, group, key, fallback);
  return {
    awardId: id,
    canEdit,
    rows: rowsOf(context).map((r) => ({
      id: String(r.credit_alloc_id),
      person: r.employee_name ?? "",
      role: r.project_role ?? "",
      credit: r.credit_pct ?? 0,
      effort: r.project_effort ?? 0,
    })),
    texts: {
      person: t("labels", "person", "Person"),
      role: t("labels", "project-role", "Project Role"),
      credit: t("labels", "credit-allocation", "Credit Allocation %"),
      effort: t("labels", "project-effort", "Project Effort %"),
      title: t("labels", "award-credit-allocation", "Award Credit Allocation"),
      edit: t("button-labels", "edit", "Edit"),
      save: t("button-labels", "save", "Save"),
      cancel: t("button-labels", "cancel", "Cancel"),
      noData: t("helper-texts", "no-data", "No data to display."),
      overAllocated: OVER,
    },
  };
}

const fraction = z.number().finite().min(0).max(1);
const input = z
  .object({
    id: z.string().regex(/^\d{1,15}$/),
    credit: fraction,
    effort: fraction,
  })
  .strict();

/**
 * WRITES: one row's credit and effort (legacy prepareCreditPayload, without the employee_num the operation ignores).
 * Legacy defects fixed: values were fractions behind a step of 1 (one click = +100%), and nothing stopped the
 * award's credit going over 100%.
 */
export async function saveCredit(id: string, body: unknown) {
  const v = input.parse(body);
  const { context, canEdit } = await creditGates(id);
  if (!canEdit)
    throw new AppError("FORBIDDEN", "This page cannot be changed now.", 403);
  const rows = rowsOf(context);
  if (!rows.some((r) => String(r.credit_alloc_id) === v.id))
    throw new AppError("BAD_REQUEST", "Unknown credit allocation.", 400);
  // Basis points, so 0.1 + 0.2 + 0.7 is exactly 100%.
  const total = rows.reduce(
    (sum, r) =>
      sum +
      Math.round(
        (String(r.credit_alloc_id) === v.id ? v.credit : (r.credit_pct ?? 0)) *
          10_000,
      ),
    0,
  );
  if (total > 10_000) throw new AppError("BAD_REQUEST", OVER, 400);
  const version = Number(context.raw.proposal_period_version_id);
  if (!Number.isInteger(version) || version <= 0)
    throw new AppError(
      "CONTRACT",
      "The award has no proposal version to allocate credit on.",
    );
  await awards.saveCredit({
    periodVersionId: version,
    body: [
      {
        credit_alloc_id: Number(v.id),
        credit_pct: v.credit,
        prj_effort: v.effort,
      },
    ],
  });
  return { saved: true };
}
