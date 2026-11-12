import "server-only";
import { z } from "zod";
import { AppError } from "@/lib/errors";
import { authenticate } from "@/server/identity/session/service";
import { locks as lockApi } from "@/server/oracle/api";
import { ethicsRecord, ethicsStakeholder, type EthicsRecord } from "../record";
import { ethicsEditableStatus } from "./status";

const pages = z.object({ items: z.array(z.object({ page_name: z.string() })) });
const lock = z.object({
  status: z.string().nullish(),
  lock_module_id: z.coerce.number().int().nullish(),
});
const locked = z.object({
  items: z.array(z.object({ page_id: z.coerce.number().int().positive() })),
});
const request = z
  .object({
    access: z.enum(["EA_ACCESS", "RESPONDENT_ACCESS", "APPROVER_ACCESS"]),
    participant: z.string().regex(/^[1-9]\d{0,14}$/),
    page: z.string(),
    finalize: z.boolean(),
  })
  .strict();

function target(
  record: EthicsRecord,
  participantId: string,
  page: string,
  personId: string,
) {
  if (!record.tabs.includes(page as EthicsRecord["tabs"][number]))
    throw new AppError(
      "FORBIDDEN",
      "Ethics page access has not been granted.",
      403,
    );
  const participant = ethicsStakeholder(record, personId, participantId);
  if (
    !participant ||
    (record.access === "RESPONDENT_ACCESS" && participant.personId !== personId)
  )
    throw new AppError(
      "FORBIDDEN",
      "This Ethics participant is unavailable.",
      403,
    );
  const pageId = record.pageIds[page];
  if (!pageId)
    throw new AppError("FORBIDDEN", "This page cannot be finalized.", 403);
  return { participant, pageId };
}

export async function ethicsFinalizeState(
  record: EthicsRecord,
  participantId: string,
  page: string,
) {
  const { user } = await authenticate();
  const { participant, pageId } = target(
    record,
    participantId,
    page,
    String(user.personId),
  );
  const [rawPages, rawLock, rawModules] = await Promise.all([
    lockApi.finalizablePages({
      objectType: "ETHICS",
      objectId: participant.id,
    }),
    lockApi.lockStatus({ recordId: participant.id, pageId, module: "ETHICS" }),
    lockApi.lockedModules({ recordId: participant.id, module: "ETHICS" }),
  ]);
  const allowed = pages
    .parse(rawPages)
    .items.some((row) => row.page_name.toLowerCase() === page);
  const current = lock.parse(rawLock);
  const modules = locked.parse(rawModules);
  return {
    visible:
      allowed &&
      participant.answered &&
      (await ethicsEditableStatus(participant.statusCode).catch(() => false)) &&
      record.statusCode !== "DRFT" &&
      record.rights[page]?.edit === true,
    finalized:
      current.status === "FINALIZE" ||
      modules.items.some((row) => row.page_id === pageId),
    finalizedPages: Object.entries(record.pageIds)
      .filter(([, id]) => modules.items.some((row) => row.page_id === id))
      .map(([name]) => name),
  };
}

export async function setEthicsFinalized(id: string, raw: unknown) {
  const input = request.parse(raw);
  const [record, { session, user }] = await Promise.all([
    ethicsRecord(id, input.access),
    authenticate(),
  ]);
  const { participant, pageId } = target(
    record,
    input.participant,
    input.page,
    String(user.personId),
  );
  if (
    record.statusCode === "DRFT" ||
    !(await ethicsEditableStatus(participant.statusCode).catch(() => false)) ||
    !participant.answered ||
    record.rights[input.page]?.edit !== true
  )
    throw new AppError(
      "FORBIDDEN",
      "This Ethics page cannot be finalized.",
      403,
    );
  const allowed = pages.parse(
    await lockApi.finalizablePages({
      objectType: "ETHICS",
      objectId: participant.id,
    }),
  );
  if (!allowed.items.some((row) => row.page_name.toLowerCase() === input.page))
    throw new AppError(
      "FORBIDDEN",
      "This Ethics page cannot be finalized.",
      403,
    );
  const current = lock.parse(
    await lockApi.lockStatus({
      recordId: participant.id,
      pageId,
      module: "ETHICS",
    }),
  );
  await lockApi.setLock({
    body: {
      proposal_id: Number(participant.id),
      created_by: session.token,
      status: input.finalize ? "FINALIZE" : "UNLOCK",
      page_id: pageId,
      id: current.lock_module_id ?? null,
      module_name: "ETHICS",
    },
  });
  return { finalized: input.finalize };
}
