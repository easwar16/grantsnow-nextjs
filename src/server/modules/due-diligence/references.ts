import "server-only";
import { z } from "zod";
import { AppError } from "@/lib/errors";
import { contracts, dueDiligence } from "@/server/oracle/api";
import { dashboardRoles } from "@/server/platform/configuration/service";
import { serverFunctions } from "@/server/functions";
import { dueDiligenceRecord } from "./record";

const id = z.string().regex(/^[1-9]\d{0,14}$/);
const access = z.enum(["DDA_ACCESS", "RESPONDENT_ACCESS", "APPROVER_ACCESS"]);
const typeRows = z.object({ items: z.array(z.object({ object_type: z.string(), object_desc: z.string() })) });
const itemRows = z.object({ items: z.array(z.object({
  object_id: z.coerce.number().int().positive(), object_number: z.string().nullish(), object_title: z.string().nullish(),
})) });
const setup = z.object({ setup_flow_id: z.coerce.number().int().positive(), reference_objects: z.array(z.object({
  obj_ref_id: z.coerce.number().int().positive(), obj_ref_type: z.string(), reln_id: z.coerce.number().int().positive().nullish(),
})).default([]) });
const input = z.object({ id, access, type: z.string().min(1), objects: z.array(id).min(1).max(100) }).strict();

async function requireLink(recordId: string, view: z.infer<typeof access>) {
  const record = await dueDiligenceRecord(recordId, view);
  if (record.statusCode !== "COMPLETED" ||
      !serverFunctions.permissions.pageAccess(await dashboardRoles(), "due-diligence-link").read)
    throw new AppError("FORBIDDEN", "Due Diligence linking is unavailable.", 403);
  return record;
}
export async function dueDiligenceReferenceTypes(recordId: string, view: string) {
  await requireLink(id.parse(recordId), access.parse(view));
  return typeRows.parse(await contracts.relationTypes()).items.map((row) => ({ value: row.object_type, label: row.object_desc }));
}
export async function dueDiligenceReferenceItems(recordId: string, view: string, objectType: string) {
  const types = await dueDiligenceReferenceTypes(recordId, view);
  if (!types.some((row) => row.value === objectType)) throw new AppError("BAD_REQUEST", "Invalid reference type.", 400);
  return itemRows.parse(await contracts.relationItems({ objectType })).items.map((row) => ({
    value: String(row.object_id), label: row.object_title ?? row.object_number ?? String(row.object_id),
    detail: row.object_number ?? "",
  }));
}
export async function linkDueDiligenceReferences(raw: unknown) {
  const selected = input.parse(raw);
  const record = await requireLink(selected.id, selected.access);
  const choices = await dueDiligenceReferenceItems(selected.id, selected.access, selected.type);
  const allowed = new Set(choices.map((row) => row.value));
  if (selected.objects.some((objectId) => !allowed.has(objectId)))
    throw new AppError("BAD_REQUEST", "Invalid reference selection.", 400);
  const previous = setup.parse(await dueDiligence.setup({ id: record.id }));
  if (String(previous.setup_flow_id) !== record.id) throw new AppError("CONTRACT", "Oracle returned another Due Diligence setup.");
  const references = previous.reference_objects.map((row) => ({
    obj_ref_id: row.obj_ref_id, obj_ref_type: row.obj_ref_type, reln_id: row.reln_id ?? null,
  }));
  for (const objectId of new Set(selected.objects))
    if (!references.some((row) => row.obj_ref_id === Number(objectId) && row.obj_ref_type === selected.type))
      references.push({ obj_ref_id: Number(objectId), obj_ref_type: selected.type, reln_id: null });
  const result = z.object({ setup_flow_id: z.coerce.number().int().positive() }).parse(await dueDiligence.save({ body: {
    action_type: "LINK", setup_flow_id: Number(record.id), reference_objects: references,
  } }));
  if (String(result.setup_flow_id) !== record.id) throw new AppError("CONTRACT", "Oracle linked another Due Diligence setup.");
  return { linked: true };
}
