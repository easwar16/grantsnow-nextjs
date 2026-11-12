import "server-only";
import { z } from "zod";
import { AppError } from "@/lib/errors";
import { authenticate } from "@/server/identity/session/service";
import { approvalActor } from "@/server/record/approvals/actor";
import { approvals, locks as lockApi } from "@/server/oracle/api";
import { globalVariables } from "@/server/platform/configuration/formatting";
import { ethicsRecord, ethicsStakeholder, type EthicsRecord } from "../record";
import { ethicsEditableStatus } from "./status";

const request = z
  .object({
    access: z.enum(["EA_ACCESS", "RESPONDENT_ACCESS"]),
    participant: z.string().regex(/^[1-9]\d{0,14}$/),
  })
  .strict();
const pages = z.object({ items: z.array(z.object({ page_name: z.string() })) });
const locked = z.object({
  items: z.array(z.object({ page_id: z.coerce.number().int().positive() })),
});

/** Legacy btnAutoSubmitToApprovals: all required Ethics pages must be locked before route generation. */
export async function ethicsAutoSubmitAvailable(
  record: EthicsRecord,
  participantId: string,
  personId: string,
) {
  if (
    !record.tabs.includes("ethics-responses") ||
    record.hasRework !== "N" ||
    (record.access !== "EA_ACCESS" && record.access !== "RESPONDENT_ACCESS")
  )
    return false;
  const participant = ethicsStakeholder(record, personId, participantId);
  if (
    !participant ||
    (record.access === "RESPONDENT_ACCESS" &&
      participant.personId !== personId) ||
    !(await ethicsEditableStatus(participant.statusCode).catch(() => false))
  )
    return false;
  const vars = await globalVariables().catch(() => []);
  if (
    !vars.some(
      (row) => row.var_key === "ETHICS_AUTO_SUBMIT" && row.var_value === "Y",
    )
  )
    return false;
  try {
    const [rawPages, rawLocked] = await Promise.all([
      lockApi.finalizablePages({
        objectType: "ETHICS",
        objectId: participant.id,
      }),
      lockApi.lockedModules({ recordId: participant.id, module: "ETHICS" }),
    ]);
    const required = pages.parse(rawPages).items;
    const lockedIds = new Set(
      locked.parse(rawLocked).items.map((row) => row.page_id),
    );
    return (
      required.length > 0 &&
      required.every((row) => {
        const pageId = record.pageIds[row.page_name.toLowerCase()];
        return pageId !== undefined && lockedIds.has(pageId);
      })
    );
  } catch {
    return false;
  }
}

export async function ethicsAutoSubmit(id: string, raw: unknown) {
  const input = request.parse(raw);
  const [record, { session, user }] = await Promise.all([
    ethicsRecord(id, input.access),
    authenticate(),
  ]);
  if (
    !(await ethicsAutoSubmitAvailable(record, input.participant, user.personId))
  )
    throw new AppError(
      "FORBIDDEN",
      "Ethics approval submission is unavailable.",
      403,
    );
  const actor = await approvalActor(session, user);
  if (!actor)
    throw new AppError("FORBIDDEN", "Approval identity is unavailable.", 403);
  await approvals.generate({
    docNum: input.participant,
    docType: "ETHICS",
    actionBy: actor,
  });
  await approvals.act({
    body: {
      action_by: actor,
      action_done: "Submitted",
      criteria_type: "Ethics",
      doc_num: input.participant,
      doc_type: "ETHICS",
    },
  });
  return { submitted: true };
}
