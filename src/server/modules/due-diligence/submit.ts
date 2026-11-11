import "server-only";
import { z } from "zod";
import { AppError } from "@/lib/errors";
import { authenticate } from "@/server/identity/session/service";
import { approvalActor } from "@/server/record/approvals/actor";
import { approvals, eoi } from "@/server/oracle/api";
import { globalVariables } from "@/server/platform/configuration/formatting";
import { dueDiligenceRecord, type DueDiligenceRecord } from "./record";

const request = z.object({ id: z.string().regex(/^[1-9]\d{0,14}$/), access: z.string(), respondent: z.string() }).strict();
const finalizable = z.object({ items: z.array(z.object({ page_name: z.string() })) });
const locked = z.object({ items: z.array(z.object({ page_id: z.coerce.number().int().positive() })) });

export async function dueDiligenceAutoSubmitAvailable(record: DueDiligenceRecord, respondentId: string) {
  if (!record.tabs.includes("duediligence-responses") || record.hasRework !== "N") return false;
  const { session, user } = await authenticate();
  const respondent = record.respondents.find((row) => row.id === respondentId);
  if (!respondent || respondent.statusCode !== "DRFT" ||
      (record.access !== "DDA_ACCESS" && respondent.personId !== String(user.personId))) return false;
  const vars = await globalVariables(session.token);
  if (!vars.some((row) => row.var_key === "DUE_DILIGENCE_AUTO_SUBMIT" && row.var_value === "Y")) return false;
  const [pages, locks] = await Promise.all([
    eoi.finalizablePages({ objectType: "DUE_DILIGENCE", objectId: respondent.id }),
    eoi.lockedModules({ module: "DUE_DILIGENCE", recordId: respondent.id }),
  ]);
  const required = finalizable.parse(pages).items.map((row) => record.rights[row.page_name.toLowerCase()]?.pageId);
  const done = new Set(locked.parse(locks).items.map((row) => row.page_id));
  return required.length > 0 && required.every((pageId) => pageId !== null && pageId !== undefined && done.has(pageId));
}

export async function autoSubmitDueDiligence(raw: unknown) {
  const input = request.parse(raw);
  const [record, { session, user }] = await Promise.all([dueDiligenceRecord(input.id, input.access), authenticate()]);
  if (!await dueDiligenceAutoSubmitAvailable(record, input.respondent))
    throw new AppError("FORBIDDEN", "Due Diligence submission is unavailable.", 403);
  const actor = await approvalActor(session, user);
  if (!actor) throw new AppError("FORBIDDEN", "The approval actor is unavailable.", 403);
  await approvals.generate({ docNum: input.respondent, docType: "DUE_DILIGENCE", actionBy: actor });
  await approvals.act({ body: {
    action_by: actor, action_done: "Submitted", criteria_type: "Ethics",
    doc_num: input.respondent, doc_type: "DUE_DILIGENCE",
  } });
  return { submitted: true };
}
