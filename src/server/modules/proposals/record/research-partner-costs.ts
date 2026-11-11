import "server-only";
import moment from "moment";
import { z } from "zod";
import { AppError } from "@/lib/errors";
import { recordIdentity } from "@/features/modules/proposals/record";
import { lookups, proposals } from "@/server/oracle/api";
import { proposalPage } from "../record";

const headersResponse = z.object({
  items: z.array(
    z.object({
      id: z.coerce.number().int().positive().nullish(),
      prop_collab_rltn_id: z.coerce.number().int().positive(),
      collaborator_name: z.string(),
      total_cost: z.coerce.number().nonnegative().nullish(),
    }),
  ),
});
const linesResponse = z.object({
  items: z.array(
    z.object({
      id: z.coerce.number().int().positive(),
      prop_collab_rltn_id: z.coerce.number().int().positive(),
      cost_category_item_lkp_code: z.string(),
      cost_category_item: z.string().nullish(),
      cost_category_type: z.string().nullish(),
      cost_category_type_desc: z.string().nullish(),
      item_description: z.string().nullish(),
      cost: z.coerce.number().nonnegative().nullish(),
      start_date: z.string(),
      end_date: z.string(),
    }),
  ),
});
const summaryResponse = z.object({
  proposal_id: z.coerce.number().int().positive(),
  proposal_status: z.string(),
  proposal_start_date: z.string(),
  proposal_end_date: z.string(),
});
const normalizeDate = (value: string) => {
  const date = moment(
    /^\d{4}-\d{2}-\d{2}/.test(value) ? value.slice(0, 10) : value,
    ["YYYY-MM-DD", "DD-MMM-YYYY", "DD-MM-YYYY", "MM-DD-YYYY"],
    true,
  );
  if (!date.isValid())
    throw new AppError("CONTRACT", "Oracle returned an invalid Proposal date.");
  return date.format("YYYY-MM-DD");
};

async function savePartnerTotals(
  headers: { id: number | null; relationId: number }[],
  lines: { relationId: number; cost: number; id: number }[],
  changed: { relationId: number; cost: number; id: number | null },
) {
  const totals = headers.map((header) => ({
    id: header.id,
    prop_collab_rltn_id: header.relationId,
    total_cost:
      lines
        .filter(
          (line) =>
            line.relationId === header.relationId && line.id !== changed.id,
        )
        .reduce((sum, line) => sum + line.cost, 0) +
      (changed.relationId === header.relationId ? changed.cost : 0),
  }));
  await proposals.saveResearchPartnerHeaders({ rows: totals });
}

async function source(type: string, id: string) {
  const identity = recordIdentity.parse({ type, id });
  const context = await proposalPage(
    identity.type,
    identity.id,
    "proposals-budget-research-partner",
  );
  const [headersRaw, linesRaw, rawSummary] = await Promise.all([
    proposals.researchPartnerHeaders({ proposalId: id }),
    proposals.researchPartnerLines({ proposalId: id }),
    proposals.summary({ id }),
  ]);
  const headers = headersResponse.parse(headersRaw).items.map((row) => ({
    id: row.id ?? null,
    relationId: row.prop_collab_rltn_id,
    name: row.collaborator_name,
    total: row.total_cost ?? 0,
  }));
  const lines = linesResponse.parse(linesRaw).items.map((row) => ({
    id: row.id,
    relationId: row.prop_collab_rltn_id,
    itemCode: row.cost_category_item_lkp_code,
    item: row.cost_category_item ?? row.cost_category_item_lkp_code,
    category: row.cost_category_type_desc ?? row.cost_category_type ?? "",
    description: row.item_description ?? "",
    cost: row.cost ?? 0,
    startDate: normalizeDate(row.start_date),
    endDate: normalizeDate(row.end_date),
  }));
  const summary = summaryResponse.parse(rawSummary);
  if (
    String(summary.proposal_id) !== id ||
    lines.some(
      (line) =>
        !headers.some((header) => header.relationId === line.relationId),
    )
  )
    throw new AppError(
      "CONTRACT",
      "Oracle returned Research Partner costs outside this Proposal.",
    );
  const pageId = context.pageIds.get("proposals-budget-research-partner");
  const editable =
    summary.proposal_status === "DRFT" &&
    pageId != null &&
    !context.summary.lockedPageIds.includes(pageId);
  return {
    context,
    headers,
    lines,
    summary,
    canEdit: editable && context.rights.edit,
    canDelete: editable && context.rights.delete,
  };
}

export async function proposalResearchPartnerCosts(type: string, id: string) {
  const data = await source(type, id);
  const categoryRaw = data.canEdit
    ? await lookups.codes({ types: "COST_CATEGORY_TYPES" })
    : null;
  const categories = categoryRaw
    ? z
        .object({
          items: z.array(
            z.object({
              lookup_type_code: z.string(),
              lookup_code: z.string(),
              lookup_code_descr: z.string(),
            }),
          ),
        })
        .parse(categoryRaw)
        .items.filter((row) => row.lookup_type_code === "COST_CATEGORY_TYPES")
        .map((row) => ({
          value: row.lookup_code,
          label: row.lookup_code_descr,
        }))
    : [];
  return {
    headers: data.headers,
    lines: data.lines,
    canEdit: data.canEdit,
    canDelete: data.canDelete,
    categories,
    bundle: data.context.bundle,
  };
}

export async function researchPartnerCostItems(
  type: string,
  id: string,
  category: string,
) {
  const data = await source(type, id);
  if (!data.canEdit)
    throw new AppError(
      "FORBIDDEN",
      "Research Partner costs cannot be edited.",
      403,
    );
  const categoryRaw = z
    .object({
      items: z.array(
        z.object({ lookup_type_code: z.string(), lookup_code: z.string() }),
      ),
    })
    .parse(await lookups.codes({ types: "COST_CATEGORY_TYPES" }));
  if (
    !categoryRaw.items.some(
      (row) =>
        row.lookup_type_code === "COST_CATEGORY_TYPES" &&
        row.lookup_code === category,
    )
  )
    throw new AppError("BAD_REQUEST", "Select a valid cost category.", 400);
  const raw = await proposals.costItems({ category });
  return z
    .object({
      items: z.array(
        z.object({
          cost_item_lkp_code: z.string(),
          cost_item_desc: z.string(),
          cost_category_type_lkp_code: z.string().nullish(),
        }),
      ),
    })
    .parse(raw)
    .items.filter(
      (row) =>
        !row.cost_category_type_lkp_code ||
        row.cost_category_type_lkp_code === category,
    )
    .map((row) => ({
      value: row.cost_item_lkp_code,
      label: row.cost_item_desc,
    }));
}

const editInput = z
  .object({
    id: z.number().int().positive(),
    startDate: z.iso.date(),
    endDate: z.iso.date(),
    description: z.string().max(500),
    cost: z.number().nonnegative(),
  })
  .strict();
const addInput = z
  .object({
    relationId: z.number().int().positive(),
    category: z.string().min(1).max(100),
    itemCode: z.string().min(1).max(100),
    description: z.string().max(500),
    cost: z.number().nonnegative(),
    startDate: z.iso.date(),
    endDate: z.iso.date(),
  })
  .strict();

export async function addResearchPartnerCost(
  type: string,
  id: string,
  input: unknown,
) {
  const body = addInput.parse(input);
  const data = await source(type, id);
  if (!data.canEdit)
    throw new AppError(
      "FORBIDDEN",
      "Research Partner costs cannot be edited.",
      403,
    );
  if (!data.headers.some((row) => row.relationId === body.relationId))
    throw new AppError(
      "FORBIDDEN",
      "Research Partner is outside this Proposal.",
      403,
    );
  const items = await researchPartnerCostItems(type, id, body.category);
  if (!items.some((item) => item.value === body.itemCode))
    throw new AppError("BAD_REQUEST", "Select a valid cost item.", 400);
  const first = normalizeDate(data.summary.proposal_start_date);
  const last = normalizeDate(data.summary.proposal_end_date);
  if (
    body.startDate < first ||
    body.endDate > last ||
    body.endDate < body.startDate
  )
    throw new AppError(
      "BAD_REQUEST",
      "Cost dates must be within the Proposal period.",
      400,
    );
  await proposals.saveResearchPartnerLines({
    rows: [
      {
        id: null,
        prop_collab_rltn_id: body.relationId,
        cost_category_item_lkp_code: body.itemCode,
        item_description: body.description,
        cost: body.cost,
        start_date: body.startDate,
        end_date: body.endDate,
      },
    ],
  });
  await savePartnerTotals(data.headers, data.lines, {
    id: null,
    relationId: body.relationId,
    cost: body.cost,
  });
  return { saved: true };
}

export async function saveResearchPartnerCost(
  type: string,
  id: string,
  input: unknown,
) {
  const body = editInput.parse(input);
  const data = await source(type, id);
  if (!data.canEdit)
    throw new AppError(
      "FORBIDDEN",
      "Research Partner costs cannot be edited.",
      403,
    );
  const line = data.lines.find((row) => row.id === body.id);
  if (!line)
    throw new AppError(
      "FORBIDDEN",
      "Research Partner cost is outside this Proposal.",
      403,
    );
  const first = normalizeDate(data.summary.proposal_start_date);
  const last = normalizeDate(data.summary.proposal_end_date);
  if (
    body.startDate < first ||
    body.endDate > last ||
    body.endDate < body.startDate
  )
    throw new AppError(
      "BAD_REQUEST",
      "Cost dates must be within the Proposal period.",
      400,
    );
  await proposals.saveResearchPartnerLines({
    rows: [
      {
        id: line.id,
        prop_collab_rltn_id: line.relationId,
        cost_category_item_lkp_code: line.itemCode,
        item_description: body.description,
        cost: body.cost,
        start_date: body.startDate,
        end_date: body.endDate,
      },
    ],
  });
  await savePartnerTotals(data.headers, data.lines, {
    id: line.id,
    relationId: line.relationId,
    cost: body.cost,
  });
  return { saved: true };
}

export async function removeResearchPartnerCost(
  type: string,
  id: string,
  lineId: number,
) {
  if (!Number.isSafeInteger(lineId) || lineId <= 0)
    throw new AppError("BAD_REQUEST", "Invalid Research Partner cost.", 400);
  const data = await source(type, id);
  if (!data.canDelete)
    throw new AppError(
      "FORBIDDEN",
      "Research Partner costs cannot be deleted.",
      403,
    );
  if (!data.lines.some((line) => line.id === lineId))
    throw new AppError(
      "FORBIDDEN",
      "Research Partner cost is outside this Proposal.",
      403,
    );
  await proposals.deleteResearchPartnerLine({ lineId });
  return { deleted: true };
}
