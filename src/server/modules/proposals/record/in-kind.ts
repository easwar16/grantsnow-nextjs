import "server-only";
import { z } from "zod";
import { AppError } from "@/lib/errors";
import { recordIdentity } from "@/features/modules/proposals/record";
import { lookups, proposals } from "@/server/oracle/api";
import { proposalPage } from "../record";

const sponsorResponse = z.object({
  INKIND_CONTRIBUTION: z.array(
    z.object({
      SPONSOR_PARTY_ID: z.coerce.number().int().positive(),
      INKIND_CONTRIBUTOR: z.string(),
      INKIND_AMOUNT: z.coerce.number().nonnegative().nullish(),
    }),
  ),
});
const lineResponse = z.object({
  items: z.array(
    z.object({
      id: z.coerce.number().int().positive(),
      proposal_period_version_id: z.coerce.number().int().positive(),
      costing_line_id: z.coerce.number().int().positive().nullish(),
      sponsor_party_id: z.coerce.number().int().positive(),
      inkind_amt: z.coerce.number().nonnegative().nullish(),
      item_description: z.string().nullish(),
      type_of_inkind: z.string().nullish(),
      description: z.string().nullish(),
    }),
  ),
});
const costItemsResponse = z.object({
  items: z.array(
    z.object({
      cost_item_lkp_code: z.string(),
      cost_item_desc: z.string(),
      costing_line_id: z.coerce.number().int().positive().nullish(),
    }),
  ),
});
const typesResponse = z.object({
  items: z.array(
    z.object({
      lookup_type_code: z.string(),
      lookup_code_value: z.string(),
      lookup_code_descr: z.string(),
    }),
  ),
});

async function source(type: string, id: string) {
  const identity = recordIdentity.parse({ type, id });
  const context = await proposalPage(
    identity.type,
    identity.id,
    "proposals-inkind-contribution",
  );
  const [sponsorsRaw, linesRaw, itemsRaw, typesRaw] = await Promise.all([
    proposals.inKindSponsors({ proposalId: id }),
    proposals.inKindLines({ proposalId: id }),
    proposals.inKindCostItems({ proposalId: id }),
    lookups.codes({ types: "TYPE_OF_INKIND" }),
  ]);
  const costItems = costItemsResponse.parse(itemsRaw).items.map((item) => ({
    code: item.cost_item_lkp_code,
    name: item.cost_item_desc,
    costingLineId: item.costing_line_id ?? null,
  }));
  const types = typesResponse
    .parse(typesRaw)
    .items.filter((item) => item.lookup_type_code === "TYPE_OF_INKIND")
    .map((item) => ({
      value: item.lookup_code_value,
      label: item.lookup_code_descr,
    }));
  const sponsors = sponsorResponse
    .parse(sponsorsRaw)
    .INKIND_CONTRIBUTION.map((row) => ({
      id: row.SPONSOR_PARTY_ID,
      name: row.INKIND_CONTRIBUTOR,
      amount: row.INKIND_AMOUNT ?? 0,
    }));
  const lines = lineResponse.parse(linesRaw).items.map((row) => ({
    id: row.id,
    versionId: row.proposal_period_version_id,
    costingLineId: row.costing_line_id ?? null,
    sponsorId: row.sponsor_party_id,
    amount: row.inkind_amt ?? 0,
    item: row.item_description ?? "",
    type: row.type_of_inkind ?? "",
    description: row.description ?? "",
  }));
  if (
    lines.some(
      (line) => !sponsors.some((sponsor) => sponsor.id === line.sponsorId),
    )
  )
    throw new AppError(
      "CONTRACT",
      "Oracle returned an In-kind line without a matching sponsor.",
    );
  const pageId = context.pageIds.get("proposals-inkind-contribution");
  return {
    context,
    sponsors,
    lines,
    costItems,
    types,
    canEdit:
      context.rights.edit &&
      context.summary.statusCode === "DRFT" &&
      pageId != null &&
      !context.summary.lockedPageIds.includes(pageId),
    canDelete:
      context.rights.delete &&
      context.summary.statusCode === "DRFT" &&
      pageId != null &&
      !context.summary.lockedPageIds.includes(pageId),
  };
}

export async function proposalInKind(type: string, id: string) {
  const data = await source(type, id);
  return {
    sponsors: data.sponsors,
    lines: data.lines.filter(
      (line) => line.versionId === data.context.summary.budgetVersionId,
    ),
    costItems: data.costItems,
    types: data.types,
    canEdit: data.canEdit,
    canDelete: data.canDelete,
    bundle: data.context.bundle,
  };
}

const totalInput = z
  .object({
    sponsors: z
      .array(
        z
          .object({
            id: z.number().int().positive(),
            amount: z.number().nonnegative(),
          })
          .strict(),
      )
      .min(1),
  })
  .strict();
const lineInput = z
  .object({
    id: z.number().int().positive(),
    amount: z.number().nonnegative(),
  })
  .strict();
const newLineInput = z
  .object({
    sponsorId: z.number().int().positive(),
    costItemCode: z.string().max(100),
    type: z.string().max(200),
    description: z.string().max(2000),
    amount: z.number().nonnegative(),
  })
  .strict();

function requireEdit(data: Awaited<ReturnType<typeof source>>) {
  if (!data.canEdit || data.context.summary.budgetVersionId == null)
    throw new AppError(
      "FORBIDDEN",
      "In-kind Contribution cannot be edited.",
      403,
    );
  return data.context.summary.budgetVersionId;
}

export async function saveInKindTotals(
  type: string,
  id: string,
  input: unknown,
) {
  const body = totalInput.parse(input);
  const data = await source(type, id);
  const versionId = requireEdit(data);
  if (
    data.sponsors.length !== body.sponsors.length ||
    new Set(body.sponsors.map((row) => row.id)).size !== body.sponsors.length ||
    data.sponsors.some(
      (row) => !body.sponsors.some((item) => item.id === row.id),
    )
  )
    throw new AppError(
      "BAD_REQUEST",
      "In-kind sponsors changed. Reload this page.",
      400,
    );
  for (const sponsor of body.sponsors) {
    const lineSum = data.lines
      .filter(
        (line) => line.sponsorId === sponsor.id && line.versionId === versionId,
      )
      .reduce((sum, line) => sum + line.amount, 0);
    if (lineSum > sponsor.amount)
      throw new AppError(
        "BAD_REQUEST",
        "Contribution should not exceed the sponsor total.",
        400,
      );
  }
  await proposals.saveInKindSponsors({
    proposalId: id,
    rows: body.sponsors.map((row) => ({
      SPONSOR_PARTY_ID: row.id,
      INKIND_AMT: row.amount,
    })),
  });
  return { saved: true };
}

export async function saveInKindLine(type: string, id: string, input: unknown) {
  const body = lineInput.parse(input);
  const data = await source(type, id);
  const versionId = requireEdit(data);
  const original = data.lines.find(
    (line) => line.id === body.id && line.versionId === versionId,
  );
  if (!original)
    throw new AppError(
      "FORBIDDEN",
      "In-kind line is outside the active Proposal Budget.",
      403,
    );
  const sponsor = data.sponsors.find((row) => row.id === original.sponsorId)!;
  const otherTotal = data.lines
    .filter(
      (line) =>
        line.sponsorId === sponsor.id &&
        line.versionId === versionId &&
        line.id !== body.id,
    )
    .reduce((sum, line) => sum + line.amount, 0);
  if (otherTotal + body.amount > sponsor.amount)
    throw new AppError(
      "BAD_REQUEST",
      "Contribution should not exceed the sponsor total.",
      400,
    );
  await proposals.saveInKindLines({
    proposalId: id,
    rows: [
      {
        ID: original.id,
        COSTING_LINE_ID: original.costingLineId,
        SPONSOR_PARTY_ID: original.sponsorId,
        INKIND_AMT: body.amount,
        PROPOSAL_PERIOD_VERSION_ID: versionId,
        TYPE_OF_INKIND: original.type,
        DESCRIPTION: original.description,
      },
    ],
  });
  return { saved: true };
}

export async function addInKindLine(type: string, id: string, input: unknown) {
  const body = newLineInput.parse(input);
  const data = await source(type, id);
  const versionId = requireEdit(data);
  const sponsor = data.sponsors.find((row) => row.id === body.sponsorId);
  if (!sponsor)
    throw new AppError(
      "BAD_REQUEST",
      "In-kind sponsor changed. Reload this page.",
      400,
    );
  const item = data.costItems.find((row) => row.code === body.costItemCode);
  if (body.costItemCode && !item)
    throw new AppError(
      "BAD_REQUEST",
      "In-kind cost item changed. Reload this page.",
      400,
    );
  if (body.type && !data.types.some((row) => row.value === body.type))
    throw new AppError(
      "BAD_REQUEST",
      "In-kind type changed. Reload this page.",
      400,
    );
  if (!item && !body.type)
    throw new AppError(
      "BAD_REQUEST",
      "Select a cost item or In-kind type.",
      400,
    );
  const currentTotal = data.lines
    .filter(
      (row) => row.versionId === versionId && row.sponsorId === sponsor.id,
    )
    .reduce((sum, row) => sum + row.amount, 0);
  if (currentTotal + body.amount > sponsor.amount)
    throw new AppError(
      "BAD_REQUEST",
      "Contribution should not exceed the sponsor total.",
      400,
    );
  await proposals.saveInKindLines({
    proposalId: id,
    rows: [
      {
        ID: null,
        COSTING_LINE_ID: item?.costingLineId ?? null,
        SPONSOR_PARTY_ID: sponsor.id,
        INKIND_AMT: body.amount,
        PROPOSAL_PERIOD_VERSION_ID: versionId,
        TYPE_OF_INKIND: body.type,
        DESCRIPTION: body.description,
      },
    ],
  });
  return { saved: true };
}

export async function removeInKindLine(
  type: string,
  id: string,
  lineId: number,
) {
  if (!Number.isSafeInteger(lineId) || lineId <= 0)
    throw new AppError("BAD_REQUEST", "Invalid In-kind line.", 400);
  const data = await source(type, id);
  const versionId = requireEdit(data);
  if (!data.canDelete)
    throw new AppError(
      "FORBIDDEN",
      "In-kind Contribution cannot be deleted.",
      403,
    );
  if (
    !data.lines.some(
      (line) => line.id === lineId && line.versionId === versionId,
    )
  )
    throw new AppError(
      "FORBIDDEN",
      "In-kind line is outside the active Proposal Budget.",
      403,
    );
  await proposals.deleteInKindLine({ lineId });
  return { deleted: true };
}
