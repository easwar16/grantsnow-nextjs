import "server-only";
import { z } from "zod";
import { claims, lookups } from "@/server/oracle/api";
import { resources } from "@/server/platform/configuration/resources";
import { AppError } from "@/lib/errors";
import { serverFunctions } from "@/server/functions";
import type { UnitAllocationsView } from "@/features/modules/claims/units/types";
import { BUNDLE, label, numberish, optionalText } from "../listing";
import { unitRecordRead, type UnitRecordContext } from "../record";
import { statusConfig, type StatusConfig } from "./status";

/** Legacy's Allocations button gate: the edit right, and the fund's status editable as a fund or an amendment. */
export { statusConfig, type StatusConfig } from "./status";
export const canAllocate = (
  context: UnitRecordContext,
  config: StatusConfig,
  fundStatus: string | null | undefined,
) =>
  context.access.roles.get("unit-fund-allocations")?.edit === true &&
  config.CLAIM_FUNDS !== undefined &&
  config.CLAIM_FUNDS_AMENDMENT !== undefined &&
  !!fundStatus &&
  (config.CLAIM_FUNDS[fundStatus] === true ||
    config.CLAIM_FUNDS_AMENDMENT[fundStatus] === true);

const fundRow = z.object({
  app_fund_id: numberish,
  fund_status_code: optionalText,
});
/** Legacy fundAllocationType: the columns an allocation has, and so what its writes may send. */
const allocationRow = z.object({
  alloc_id: numberish,
  alloc_type_code: optionalText,
  alloc_status_code: optionalText,
  alloc_date: optionalText,
  amount: numberish,
  app_id: numberish,
  fund_type_id: numberish,
  org_id: numberish,
  created_by: numberish,
  creation_date: optionalText,
  last_updated_by: numberish,
  last_update_date: optionalText,
});
type AllocationRow = z.infer<typeof allocationRow>;
const lookupRow = z.object({
  lookup_type_code: optionalText,
  lookup_code: z.union([z.string(), z.number()]).nullish(),
  lookup_code_value: optionalText,
});
const text = (v: string | number | null | undefined) =>
  v === null || v === undefined ? "" : String(v);

/** The application's fund, refused when it is not one of this application's funds. */
async function fundOf(context: UnitRecordContext, appFundId: number) {
  const funds = z.object({ items: z.array(fundRow) }).parse(
    await claims.appFundSummary({
      appId: Number(context.id),
      orgId: context.user.organizationId,
    }),
  ).items;
  const fund = funds.find((f) => Number(f.app_fund_id) === appFundId);
  if (!fund)
    throw new AppError(
      "FORBIDDEN",
      "This fund is not on the application.",
      403,
    );
  return fund;
}
const fundId = (raw: unknown) => {
  const parsed = z.coerce.number().int().positive().safeParse(raw);
  if (!parsed.success) throw new AppError("BAD_REQUEST", "Invalid fund.", 400);
  return parsed.data;
};
const allocationsOf = async (context: UnitRecordContext, appFundId: number) =>
  z.object({ items: z.array(allocationRow) }).parse(
    await claims.fundAllocations({
      appFundId,
      orgId: context.user.organizationId,
    }),
  ).items;

/** The Fund Allocation dialog (legacy openAllocations → loadAllocations, loadLookups' two allocation lookups). */
export async function allocationsView(
  id: string,
  rawFund: unknown,
): Promise<UnitAllocationsView> {
  const appFundId = fundId(rawFund);
  const context = await unitRecordRead(id, "summary");
  const rowsRead = resources();
  const [rows, , list, codes] = await Promise.all([
    rowsRead,
    fundOf(context, appFundId),
    allocationsOf(context, appFundId),
    lookups
      .codes({ types: "FPCG_ALLOC_STATUS,FPCG_ALLOC_TYPE" })
      .then((b) => z.object({ items: z.array(lookupRow) }).parse(b).items),
  ]);
  const options = (type: string) =>
    codes
      .filter((c) => c.lookup_type_code === type)
      .map((c) => ({
        value: text(c.lookup_code),
        label: c.lookup_code_value ?? "",
      }));
  const header = (key: string, fallback: string) => ({
    label: label(rows, "table-headers", key, fallback),
    help: serverFunctions.resources.resourceDescription(
      rows,
      BUNDLE,
      "table-headers",
      key,
    ),
  });
  return {
    title: label(rows, "dialog-titles", "fund-allocation", "Fund Allocation"),
    headers: {
      type: header("allocation-type", "Allocation Type"),
      status: header("allocation-status", "Allocation Status"),
      date: header("allocation-date", "Allocation Date"),
      amount: header("allocation-amount", "Allocation Amount"),
    },
    labels: {
      type: label(rows, "labels", "allocation-type", "Allocation Type"),
      date: label(rows, "labels", "allocation-date", "Allocation Date"),
      amount: label(rows, "labels", "allocation-amount", "Allocation Amount"),
    },
    texts: {
      addNew: label(rows, "button-labels", "add-new", "Add New"),
      add: label(rows, "button-labels", "add", "Add"),
      cancel: label(rows, "button-labels", "cancel", "Cancel"),
      // Legacy saveAllocation's literal toasts.
      created: "Allocation created successfully!",
      updated: "Allocation updated successfully!",
      negative: "Allocation amount cannot be negative.",
    },
    types: options("FPCG_ALLOC_TYPE"),
    statuses: options("FPCG_ALLOC_STATUS"),
    rows: list.map((r, i) => ({
      key: text(r.alloc_id) || String(i),
      type: r.alloc_type_code ?? "",
      status: r.alloc_status_code ?? "",
      date: r.alloc_date ?? "",
      amount:
        r.amount === null || r.amount === undefined || r.amount === ""
          ? null
          : Number(r.amount),
    })),
    // Legacy's empty state is the literal "No Data".
    empty: "No Data",
  };
}

const DAY = /^\d{4}-\d{2}-\d{2}$/;
const saveInput = z
  .object({
    fund: z.coerce.number().int().positive(),
    allocId: z.coerce.number().int().positive().optional(),
    type: z.string().max(100),
    date: z.union([z.literal(""), z.string().regex(DAY)]),
    amount: z.union([z.literal(""), z.coerce.number().finite()]),
  })
  .strict();
const deleteInput = z
  .object({
    fund: z.coerce.number().int().positive(),
    allocId: z.coerce.number().int().positive(),
  })
  .strict();

/** The write gate: the fund is this application's, and its Allocations button would be enabled. */
async function writable(id: string, appFundId: number) {
  const context = await unitRecordRead(id, "summary");
  const [fund, config] = await Promise.all([
    fundOf(context, appFundId),
    statusConfig(),
  ]);
  if (!canAllocate(context, config, fund.fund_status_code))
    throw new AppError(
      "FORBIDDEN",
      "You do not have access to change these allocations.",
      403,
    );
  return context;
}
/** The allocation being changed, refused when it is not one of this fund's. */
async function allocationOf(
  context: UnitRecordContext,
  appFundId: number,
  allocId: number,
): Promise<AllocationRow> {
  const row = (await allocationsOf(context, appFundId)).find(
    (r) => Number(r.alloc_id) === allocId,
  );
  if (!row)
    throw new AppError("FORBIDDEN", "This allocation is not on the fund.", 403);
  return row;
}

/**
 * WRITES: legacy saveAllocation. A new allocation posts its type, date and amount; an existing one puts the row as
 * read with those three replaced (legacy posts its whole fundAllocationType). A negative amount is refused, as legacy.
 */
export async function saveAllocation(id: string, raw: unknown) {
  const parsed = saveInput.safeParse(raw);
  if (!parsed.success)
    throw new AppError("BAD_REQUEST", "Invalid allocation.", 400);
  const { fund, allocId, type, date, amount } = parsed.data;
  if (amount !== "" && amount < 0)
    throw new AppError(
      "BAD_REQUEST",
      "Allocation amount cannot be negative.",
      400,
    );
  const context = await writable(id, fund);
  const fields = {
    alloc_type_code: type === "" ? null : type,
    alloc_date: date === "" ? null : date,
    amount: amount === "" ? null : amount,
  };
  if (allocId === undefined) {
    await claims.createAllocation({ appFundId: fund, body: fields });
    return { saved: "created" as const };
  }
  const row = await allocationOf(context, fund, allocId);
  // An unchanged date keeps its stored value.
  const body = {
    ...row,
    ...fields,
    alloc_date:
      date !== "" && text(row.alloc_date).slice(0, 10) === date
        ? row.alloc_date
        : fields.alloc_date,
  };
  await claims.updateAllocation({ allocId, body });
  return { saved: "updated" as const };
}
/** WRITES: legacy deleteAllocation. */
export async function deleteAllocation(id: string, raw: unknown) {
  const parsed = deleteInput.safeParse(raw);
  if (!parsed.success)
    throw new AppError("BAD_REQUEST", "Invalid allocation.", 400);
  const context = await writable(id, parsed.data.fund);
  await allocationOf(context, parsed.data.fund, parsed.data.allocId);
  await claims.deleteAllocation({ allocId: parsed.data.allocId });
  return { deleted: true as const };
}
