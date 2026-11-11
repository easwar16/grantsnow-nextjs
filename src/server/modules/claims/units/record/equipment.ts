import "server-only";
import { z } from "zod";
import { claims } from "@/server/oracle/api";
import { resources } from "@/server/platform/configuration/resources";
import { AppError } from "@/lib/errors";
import type { UnitEquipmentView } from "@/features/modules/claims/units/listing/types";
import { label, numberish, optionalText } from "../listing";
import { unitRecordRead, type UnitRecordContext } from "../record";
import { appFundsOf, items } from "./goals";

const text = (v: unknown) => (v === null || v === undefined ? "" : String(v));
const amount = (v: unknown) =>
  v === null || v === undefined || v === "" || !Number.isFinite(Number(v))
    ? null
    : Number(v);
const equipmentRow = z.object({
  equipment_id: numberish,
  item_description: optionalText,
  purchase_date: optionalText,
  purchase_price: numberish,
  serial_number: optionalText,
  location: optionalText,
  condition: optionalText,
  review_comments: optionalText,
  funding_sources: z
    .array(z.object({ app_fund_id: numberish, fund_name: optionalText }))
    .nullish(),
});
/** Legacy: Add, Edit and Delete with `activity-equipment` edit; no status gate. */
const canEdit = (context: UnitRecordContext) =>
  context.access.roles.get("activity-equipment")?.edit === true;
const listOf = async (context: UnitRecordContext) =>
  items(
    equipmentRow,
    await claims.equipments({
      appId: Number(context.id),
      orgId: context.user.organizationId,
    }),
  );

/** Furniture & Equipment (legacy furnitureEquipmentSection, read when it opens): the items, the funds, the gate. */
export async function equipmentView(id: string): Promise<UnitEquipmentView> {
  const context = await unitRecordRead(id, "activities");
  const [rows, list, funds] = await Promise.all([
    resources(),
    listOf(context),
    appFundsOf(context),
  ]);
  const t = (group: string, key: string, fallback: string) =>
    label(rows, group, key, fallback);
  return {
    canEdit: canEdit(context),
    funds: funds.map((f) => ({
      value: text(f.app_fund_id),
      label: f.full_fund_display ?? f.fund_name ?? "",
    })),
    rows: list.map((e) => ({
      key: text(e.equipment_id),
      description: text(e.item_description),
      date: text(e.purchase_date).slice(0, 10),
      price: amount(e.purchase_price),
      serial: text(e.serial_number),
      location: text(e.location),
      condition: text(e.condition),
      comments: text(e.review_comments),
      funds: (e.funding_sources ?? []).map((f) => text(f.app_fund_id)),
      fundNames: (e.funding_sources ?? []).map((f) => text(f.fund_name)),
    })),
    total: list.reduce((s, e) => s + (amount(e.purchase_price) ?? 0), 0),
    headers: Object.fromEntries(
      (
        [
          ["item-description", "Item Description"],
          ["purchase-date", "Purchase Date"],
          ["purchase-price", "Purchase Price"],
          ["serial-number", "Serial Number"],
          ["eqp-location", "Location"],
          ["eqp-condition", "Condition"],
          ["funding-sources", "Funding Sources"],
        ] as const
      ).map(([k, fallback]) => [k, t("table-headers", k, fallback)]),
    ),
    labels: Object.fromEntries(
      (
        [
          ["equipment-description", "Item Description"],
          ["equipment-purchase-date", "Purchase Date"],
          ["equipment-purchase-price", "Purchase Price"],
          ["equipment-serial-number", "Serial Number"],
          ["equipment-location", "Location"],
          ["equipment-condition", "Condition"],
          ["equipment-funding-sources", "Funding Sources"],
          ["equipment-comments", "Comments"],
        ] as const
      ).map(([k, fallback]) => [k, t("labels", k, fallback)]),
    ),
    texts: {
      heading: t("labels", "furniture-equipment", "Furniture & Equipment"),
      add: t("button-labels", "add-equipment", "Add Equipment"),
      title: t("dialog-titles", "equipment-details", "Equipment Details"),
      submit: t("button-labels", "submit", "Submit"),
      edit: t("button-labels", "edit", "Edit"),
      delete: t("button-labels", "delete", "Delete"),
      total: t("labels", "total", "Total"),
      empty: t("helper-texts", "no-data", "No data to display."),
      required: "Please fill all the required fields!",
    },
  };
}

const saveInput = z
  .object({
    equipment: z.coerce.number().int().positive().optional(),
    description: z.string().trim().min(1).max(240),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    price: z.coerce.number().finite().nonnegative(),
    serial: z.string().trim().min(1).max(100),
    location: z.string().trim().min(1).max(240),
    condition: z.string().trim().min(1).max(240),
    comments: z.string().max(4000),
    funds: z.array(z.string().regex(/^\d{1,15}$/)).max(50),
  })
  .strict();
/**
 * WRITES: adds or saves an item (legacy saveEquipment: postEquipment / putEquipment). Every required field, an
 * existing item of this application, and funding sources that are the application's funds.
 */
export async function saveEquipment(id: string, raw: unknown) {
  const parsed = saveInput.safeParse(raw);
  if (!parsed.success)
    throw new AppError(
      "BAD_REQUEST",
      "Please fill all the required fields!",
      400,
    );
  const input = parsed.data;
  const context = await unitRecordRead(id, "activities");
  if (!canEdit(context))
    throw new AppError(
      "FORBIDDEN",
      "You do not have access to change equipment.",
      403,
    );
  const [list, funds] = await Promise.all([
    listOf(context),
    appFundsOf(context),
  ]);
  if (
    input.equipment !== undefined &&
    !list.some((e) => Number(e.equipment_id) === input.equipment)
  )
    throw new AppError(
      "FORBIDDEN",
      "This item is not on the application.",
      403,
    );
  if (input.funds.some((f) => !funds.some((x) => text(x.app_fund_id) === f)))
    throw new AppError(
      "FORBIDDEN",
      "This fund is not on the application.",
      403,
    );
  // Legacy's body: the item's fields, the application, and the funding sources as fund ids.
  const body = {
    ...(input.equipment ? { equipment_id: input.equipment } : {}),
    app_id: Number(context.id),
    item_description: input.description,
    purchase_date: input.date,
    purchase_price: input.price,
    serial_number: input.serial,
    location: input.location,
    condition: input.condition,
    review_comments: input.comments || null,
    funding_sources: input.funds.map(Number),
  };
  if (input.equipment)
    await claims.updateEquipment({ equipmentId: input.equipment, body });
  else await claims.createEquipment({ appId: Number(context.id), body });
  return { saved: true as const };
}

/** WRITES: removes an item of this application (legacy deleteEquipment). */
export async function deleteEquipment(id: string, raw: unknown) {
  const parsed = z
    .object({ equipment: z.coerce.number().int().positive() })
    .strict()
    .safeParse(raw);
  if (!parsed.success)
    throw new AppError("BAD_REQUEST", "Invalid equipment.", 400);
  const context = await unitRecordRead(id, "activities");
  if (!canEdit(context))
    throw new AppError(
      "FORBIDDEN",
      "You do not have access to change equipment.",
      403,
    );
  if (
    !(await listOf(context)).some(
      (e) => Number(e.equipment_id) === parsed.data.equipment,
    )
  )
    throw new AppError(
      "FORBIDDEN",
      "This item is not on the application.",
      403,
    );
  await claims.deleteEquipment({ equipmentId: parsed.data.equipment });
  return { deleted: true as const };
}
