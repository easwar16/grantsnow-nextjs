import "server-only";
import { z } from "zod";
import { AppError } from "@/lib/errors";
import { dueDiligence } from "@/server/oracle/api";
import { dueDiligenceListView } from "./listing";
import { dueDiligenceRecord } from "./record";

const copyRows = z.object({
  items: z.array(z.object({
    r: z.string().min(1),
    d: z.string().nullish(),
    default_value: z.boolean().nullish(),
  })),
});
const body = z.object({
  id: z.string().regex(/^[1-9]\d{0,14}$/),
  access: z.enum(["DDA_ACCESS", "RESPONDENT_ACCESS"]),
  objects: z.array(z.string().min(1)).max(100),
}).strict();
const target = z.object({
  id: z.string().regex(/^[1-9]\d{0,14}$/),
  access: z.enum(["DDA_ACCESS", "RESPONDENT_ACCESS"]),
}).strict();

async function allowed(raw: unknown, action: "clone" | "delete") {
  const input = (action === "clone" ? body : target).parse(raw);
  const view = await dueDiligenceListView();
  if (!view.actions.clone || (action === "delete" && !view.actions.delete))
    throw new AppError("FORBIDDEN", "Due Diligence action access has not been granted.", 403);
  const record = await dueDiligenceRecord(input.id, input.access);
  if (action === "delete" && record.statusCode !== "DRFT")
    throw new AppError("FORBIDDEN", "Only Draft Due Diligence applications can be deleted.", 403);
  return { input, record };
}

export async function dueDiligenceCloneOptions(id: string, access: string) {
  await allowed({ id, access, objects: [] }, "clone");
  const rows = copyRows.parse(await dueDiligence.copyOptions()).items;
  return rows.map((row) => ({
    value: row.r,
    label: row.d || row.r,
    selected: row.default_value === true,
  }));
}
export async function cloneDueDiligence(raw: unknown) {
  const { input } = await allowed(raw, "clone");
  const selected = body.parse(input);
  const available = copyRows.parse(await dueDiligence.copyOptions()).items;
  const names = new Set(available.map((row) => row.r));
  if (selected.objects.some((name) => !names.has(name)))
    throw new AppError("BAD_REQUEST", "Invalid Due Diligence clone selection.", 400);
  await dueDiligence.copy({
    id: selected.id,
    access: selected.access,
    objects: [...new Set(selected.objects)].map((object_name) => ({
      object_name,
      object_val: true,
    })),
  });
  return { cloned: true };
}
export async function deleteDueDiligence(raw: unknown) {
  const { input } = await allowed(raw, "delete");
  const selected = target.parse(input);
  await dueDiligence.remove({ id: selected.id });
  return { deleted: true };
}
