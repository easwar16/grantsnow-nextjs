import "server-only";
import { z } from "zod";
import { AppError } from "@/lib/errors";
import { authenticate } from "@/server/identity/session/service";
import { locks as lockApi } from "@/server/oracle/api";
import { invalidate } from "@/server/oracle/client";
import { fixtureMode } from "@/server/platform/configuration/environment";
import { dueDiligenceRecord, type DueDiligenceRecord } from "../record";

const pages = z.object({ items: z.array(z.object({ page_name: z.string() })) });
const lock = z.object({
  status: z.string().nullish(),
  lock_module_id: z.coerce.number().int().nullish(),
});
const request = z
  .object({
    access: z.string(),
    respondent: z.string(),
    page: z.string(),
    finalize: z.boolean(),
  })
  .strict();

function target(
  record: DueDiligenceRecord,
  respondentId: string,
  page: string,
  personId: string,
) {
  if (!record.tabs.includes(page as DueDiligenceRecord["tabs"][number]))
    throw new AppError(
      "FORBIDDEN",
      "Due Diligence page access has not been granted.",
      403,
    );
  const respondent = record.respondents.find((row) => row.id === respondentId);
  if (
    !respondent ||
    (record.access === "RESPONDENT_ACCESS" && respondent.personId !== personId)
  )
    throw new AppError(
      "FORBIDDEN",
      "This Due Diligence participant is unavailable.",
      403,
    );
  const pageId = record.rights[page]?.pageId;
  if (!pageId)
    throw new AppError("FORBIDDEN", "This page cannot be finalized.", 403);
  return { respondent, pageId };
}

export async function dueDiligenceFinalizeState(
  record: DueDiligenceRecord,
  respondentId: string,
  page: string,
) {
  const { user } = await authenticate();
  const { respondent, pageId } = target(
    record,
    respondentId,
    page,
    String(user.personId),
  );
  const [rawPages, rawLock, rawModules] = await Promise.all([
    lockApi.finalizablePages({
      objectType: "DUE_DILIGENCE",
      objectId: respondent.id,
    }),
    lockApi.lockStatus({
      recordId: respondent.id,
      pageId,
      module: "DUE_DILIGENCE",
    }),
    lockApi.lockedModules({ recordId: respondent.id, module: "DUE_DILIGENCE" }),
  ]);
  const allowed = pages
    .parse(rawPages)
    .items.some((row) => row.page_name.toLowerCase() === page);
  const current = lock.parse(rawLock);
  const locked = z
    .object({
      items: z.array(z.object({ page_id: z.coerce.number().int().positive() })),
    })
    .parse(rawModules);
  return {
    visible:
      allowed &&
      record.rights[page]?.edit === true &&
      respondent.answered &&
      respondent.statusCode === "DRFT" &&
      record.statusCode !== "DRFT",
    finalized:
      current.status === "FINALIZE" ||
      locked.items.some((row) => row.page_id === pageId),
    finalizedPageIds: locked.items.map((row) => row.page_id),
  };
}

export async function setDueDiligenceFinalized(id: string, raw: unknown) {
  const input = request.parse(raw);
  const [record, { session, user }] = await Promise.all([
    dueDiligenceRecord(id, input.access),
    authenticate(),
  ]);
  const { respondent, pageId } = target(
    record,
    input.respondent,
    input.page,
    String(user.personId),
  );
  if (
    record.statusCode === "DRFT" ||
    respondent.statusCode !== "DRFT" ||
    !respondent.answered ||
    record.rights[input.page]?.edit !== true
  )
    throw new AppError(
      "FORBIDDEN",
      "This Due Diligence page cannot be finalized.",
      403,
    );
  const allowed = pages.parse(
    await lockApi.finalizablePages({
      objectType: "DUE_DILIGENCE",
      objectId: respondent.id,
    }),
  );
  if (!allowed.items.some((row) => row.page_name.toLowerCase() === input.page))
    throw new AppError(
      "FORBIDDEN",
      "This Due Diligence page cannot be finalized.",
      403,
    );
  const current = lock.parse(
    await lockApi.lockStatus({
      recordId: respondent.id,
      pageId,
      module: "DUE_DILIGENCE",
    }),
  );
  const body = {
    proposal_id: Number(respondent.id),
    created_by: session.token,
    status: input.finalize ? "FINALIZE" : "UNLOCK",
    page_id: pageId,
    id: current.lock_module_id ?? null,
    module_name: "DUE_DILIGENCE",
  };
  if (fixtureMode()) {
    (await import("@/test-support/eoi-writes")).fixtureModuleLock(body);
    await invalidate(lockApi.setLock.invalidates);
  } else await lockApi.setLock({ body });
  return { finalized: input.finalize };
}
