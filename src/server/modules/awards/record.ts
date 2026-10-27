import "server-only";
import { cache } from "react";
import { z } from "zod";
import { authenticate } from "@/server/identity/session/service";
import {
  finalizedOf,
  objectAccessOf,
  requireDrawerAccess,
} from "@/server/platform/permissions";
import {
  awards,
  eoi as locks,
  lookups,
  people,
  roles as recordRoles,
} from "@/server/oracle/api";
import { invalidate } from "@/server/oracle/client";
import { fixtureMode } from "@/server/platform/configuration/environment";
import { orgUnitRows } from "@/server/platform/configuration/service";
import { orNull, recordId, recordRoleRows } from "@/server/record/shared";
import type { AttachmentHost } from "@/server/record/attachments/attachments";
import { AppError } from "@/lib/errors";
import type { PageLock } from "@/shared/opportunities/eoi-record";
import {
  AWARD_MODULE,
  EDITABLE_STATUSES,
  awardTabs,
  pageOf,
  visibleTabs,
  type AwardTab,
} from "@/shared/awards/award-record";

export const awardRecordIdentity = z.object({
  id: recordId,
  tab: z.enum(awardTabs),
});
const text = z.string().nullish();
const num = z.union([z.number(), z.string()]).nullish();
/** AwardDetails' header; its lists (`Award Budget Periods`…) stay on the raw body for the tabs that show them. */
const detailsSchema = z
  .object({
    award_id: z.coerce.number().int().positive(),
    proposal_id: num,
    pi_pid: num,
    org_id: num,
    sponsor_id: num,
    sponsor_party_name: text,
    billing_party_id: num,
    billing_party_name: text,
    full_title: text,
    award_number: text,
    award_name: text,
    award_start_date: text,
    award_end_date: text,
    currency: text,
    award_status: text,
    award_status_desc: text,
    erp_award_id: text,
    award_amount: num,
    proposal_number: text,
    proposal_period_version_id: num,
    actual_award_date: text,
    is_editable: z.union([z.number(), z.string(), z.boolean()]).nullish(),
    proposal_start_date: text,
    proposal_end_date: text,
    locked_modules: z
      .array(z.object({ id: z.number(), page_id: z.number() }))
      .nullish(),
  })
  .passthrough();
export type AwardDetails = z.infer<typeof detailsSchema>;
const periodSchema = z.object({
  "Award Period Details": z
    .array(
      z.object({
        award_id: num,
        award_start_date: text,
        award_end_date: text,
        amount: num,
        proposal_id: num,
        is_editable: num,
      }),
    )
    .nullish(),
});
export type AwardPeriod = NonNullable<
  z.infer<typeof periodSchema>["Award Period Details"]
>[number];
const pageNames = z.object({
  items: z.array(z.object({ page_name: z.string() })),
});

/**
 * Legacy applyAwardPeriodDates: the award's dates span its periods (earliest start, latest end). Legacy blanked the
 * whole award when the period read failed; here the award keeps its own dates.
 */
export function withPeriodDates(award: AwardDetails, periods: AwardPeriod[]) {
  const mine = periods.filter(
    (p) => p.award_id === null || Number(p.award_id) === award.award_id,
  );
  const day = (v?: string | null) => v?.slice(0, 10) ?? "";
  const starts = mine
    .map((p) => p.award_start_date)
    .filter(Boolean) as string[];
  const ends = mine.map((p) => p.award_end_date).filter(Boolean) as string[];
  return {
    ...award,
    award_start_date: starts.length
      ? starts.reduce((a, b) => (day(a) <= day(b) ? a : b))
      : award.award_start_date,
    award_end_date: ends.length
      ? ends.reduce((a, b) => (day(a) >= day(b) ? a : b))
      : award.award_end_date,
  };
}

/**
 * One award record, read once per request and shared by the layout and the tab (legacy awards-detail-page): the
 * user's rights on it (no `awards-header` read denies it, as legacy beforeEnterHandlerChain), the award, its periods,
 * the finalize state and the PI's and org unit's names for the panel.
 */
export const awardRecordContext = cache(async (id: string) => {
  if (!recordId.safeParse(id).success)
    throw new AppError("BAD_REQUEST", "Invalid award identity.", 400);
  const { session, user } = await authenticate();
  requireDrawerAccess(user, "awards");
  // Reference lists load alongside the access check; no record data is read before it.
  const staffRead = orNull(people.all());
  const orgsRead = orNull(lookups.orgUnits({}).then(orgUnitRows));
  staffRead.catch(() => undefined);
  orgsRead.catch(() => undefined);
  const access = objectAccessOf(
    recordRoleRows.parse(
      await recordRoles.record({ objectType: AWARD_MODULE, objectId: id }),
    ).items,
  );
  if (access.roles.get(pageOf("header"))?.read !== true)
    throw new AppError("FORBIDDEN", "You don't have access to this award", 403);
  const [raw, periods, finalizable, staff, orgs] = await Promise.all([
    awards.details({ awardId: id }),
    orNull(
      awards
        .periods({ awardId: id })
        .then((b) => periodSchema.parse(b)["Award Period Details"] ?? []),
    ),
    orNull(
      locks
        .finalizablePages({ objectType: AWARD_MODULE, objectId: id })
        .then((b) =>
          pageNames.parse(b).items.map((p) => p.page_name.toLowerCase()),
        ),
    ),
    staffRead,
    orgsRead,
  ]);
  const details = detailsSchema.parse(raw);
  if (String(details.award_id) !== id)
    throw new AppError("CONTRACT", "Oracle returned a different award.");
  const award = withPeriodDates(details, periods ?? []);
  // Legacy reads the finalized pages from the award's own locked_modules.
  const finalized = finalizedOf(access.pages, details.locked_modules ?? []);
  const status = award.award_status ?? "";
  return {
    session,
    user,
    id,
    access,
    award,
    raw: raw as Record<string, unknown>,
    periods: periods ?? [],
    // Legacy labels the PI "Created by" (the award has no creator); kept, as there is nothing else to show.
    pi:
      staff?.find((p) => String(p.person_id) === String(award.pi_pid))
        ?.full_name ?? null,
    // Legacy getPersonData: the PI's own row, whose org the creator card is read with.
    piPerson:
      staff?.find((p) => String(p.person_id) === String(award.pi_pid)) ?? null,
    orgName: orgs?.find((o) => o.id === String(award.org_id))?.name ?? null,
    finalizable,
    finalized,
    tabs: visibleTabs(access, status, finalizable, new Set(finalized.keys())),
  };
});
export type AwardRecordContext = Awaited<ReturnType<typeof awardRecordContext>>;

/** A tab the record does not show is denied, as getTabs hides it and subFlowAccessGuard turns it away. */
export async function awardRecordRead(id: string, tab: AwardTab) {
  const context = await awardRecordContext(id);
  if (!context.tabs.includes(tab))
    throw new AppError(
      "FORBIDDEN",
      "You do not have access to this page.",
      403,
    );
  return context;
}

const lockSchema = z.object({
  status: text,
  lock_module_id: z.number().nullish(),
});
async function lockStatus(id: string, page: number) {
  const b = lockSchema.parse(
    await locks.lockStatus({
      recordId: id,
      pageId: page,
      module: AWARD_MODULE,
    }),
  );
  return { locked: b.status !== "UNLOCK", lockId: b.lock_module_id ?? null };
}
/** The tab's lock (getLockStatus, `lock_level` the page id); an unreadable lock is read-only, never open. */
export const awardPageLock = cache(
  async (context: AwardRecordContext, tab: AwardTab): Promise<PageLock> => {
    const page = context.access.pages.find((p) => p.name === pageOf(tab));
    if (!page) return { known: false, locked: false };
    const lock = await orNull(lockStatus(context.id, page.id));
    return lock
      ? { known: true, locked: lock.locked }
      : { known: false, locked: true };
  },
);
export const isDraft = (context: AwardRecordContext) =>
  EDITABLE_STATUSES.includes(context.award.award_status ?? "");

/**
 * The Attachments tab as an attachments host. Legacy: editable in a draft (never once abandoned) with page edit access,
 * and no lock term; here a finalized or unreadable lock also refuses, as on every other record.
 */
export async function awardAttachmentHost(
  id: string,
  mode: "read" | "view" | "edit",
): Promise<AttachmentHost> {
  const context = await awardRecordRead(id, "attachments");
  const page = pageOf("attachments");
  let canEdit = false;
  if (mode !== "read") {
    const lock = await awardPageLock(context, "attachments");
    const finalized = lock.locked || context.finalized.has(page);
    canEdit =
      context.access.roles.get(page)?.edit === true &&
      !finalized &&
      isDraft(context);
    if (mode === "edit" && !canEdit)
      throw new AppError(
        "FORBIDDEN",
        finalized
          ? "This page is finalized, so its attachments cannot be changed."
          : !isDraft(context)
            ? "Attachments can be changed only while the award is a draft."
            : "You do not have access to change these attachments.",
        403,
      );
  }
  return {
    objectType: AWARD_MODULE,
    objectId: id,
    // Legacy files award documents under the award number.
    objectNumber: context.award.award_number ?? id,
    pathSegment: AWARD_MODULE,
    bundle: "award",
    token: context.session.token,
    user: context.user,
    canEdit,
  };
}

export const finalizeInput = z
  .object({ tab: z.enum(awardTabs), finalize: z.boolean() })
  .strict();
/**
 * WRITES: finalizes or unlocks the tab's page (insertModuleLock, module AWARD). Only a draft's readable, finalizable
 * page; page and lock ids come from Oracle; `created_by` carries the session token as the contract has it.
 */
export async function awardSetFinalized(id: string, raw: unknown) {
  const input = finalizeInput.parse(raw);
  const context = await awardRecordRead(id, input.tab);
  const page = context.access.pages.find((p) => p.name === pageOf(input.tab));
  if (!page || !isDraft(context) || !context.finalizable?.includes(page.name))
    throw new AppError("FORBIDDEN", "This page cannot be finalized.", 403);
  const { lockId } = await lockStatus(id, page.id);
  const body = {
    proposal_id: Number(id),
    created_by: context.session.token,
    status: input.finalize ? "FINALIZE" : "UNLOCK",
    page_id: page.id,
    id: lockId,
    module_name: AWARD_MODULE,
  };
  if (fixtureMode()) {
    (await import("@/test-support/eoi-writes")).fixtureModuleLock(body);
    await invalidate([
      ...locks.setLock.invalidates,
      "getPost_awardsAwardDetails",
    ]);
  } else {
    await locks.setLock({ body });
    // The finalized ticks come from AwardDetails' locked_modules.
    await invalidate(["getPost_awardsAwardDetails"]);
  }
  return { finalized: input.finalize };
}
