import "server-only";
import { z } from "zod";
import { AppError } from "@/lib/errors";
import { proposals, reports } from "@/server/oracle/api";
import { resources } from "@/server/platform/configuration/resources";
import { serverFunctions } from "@/server/functions";
import { formattingConfiguration } from "@/server/platform/configuration/formatting";
import type { RecordIdentity } from "@/features/modules/proposals/record";
import { proposalPage } from "./record";
import { sumCost } from "./budget";

const amount = z.union([z.string(), z.number()]).nullish();
const pricingResponse = z.object({
  items: z.array(
    z.object({
      proposal_id: z.coerce.number().int().positive(),
      proposal_number: z.string().nullish(),
      collab_id: z.coerce.number().int().positive().nullish(),
      collab_name: z.string().nullish(),
      costing_header_id: z.coerce.number().int().positive().nullish(),
      costing_line_id: z.coerce.number().int().positive().nullish(),
      funding_section_header_lkp_code: z.string().nullish(),
      funding_section_header: z.string().nullish(),
      cost_category_lkp_code: z.string().nullish(),
      cost_category: z.string().nullish(),
      cost_category_item_lkp_code: z.string().nullish(),
      cost_category_item: z.string().nullish(),
      staff_name: z.string().nullish(),
      institution_cost: amount,
      funder_cost: amount,
      fec_cost: amount,
      unindex_cost: amount,
      cost_to_funder: amount,
      funder_percent: amount,
      funder_percent_unindexed: amount,
      price_rule_id: z.string().nullish(),
      indexed_pricing: z.string().nullish(),
      party_name: z.string().nullish(),
      funder_details: z
        .array(
          z.object({
            funder_id: z.coerce.number().int().positive().nullish(),
            funder_name: z.string(),
            funder_contribution: amount,
            cost_to_funder: amount,
            funder_priority: z.coerce.number().nullish(),
          }),
        )
        .nullish(),
    }),
  ),
});

function pricingRowsInScope(
  rows: { proposal_id: number; proposal_number?: string | null }[],
  proposalId: string,
  relatedNumbers: readonly string[],
) {
  const related = new Set(relatedNumbers.filter(Boolean));
  const relatedIds = new Set(
    rows
      .filter((row) => related.has(row.proposal_number ?? ""))
      .map((row) => row.proposal_id),
  );
  if (
    rows.some(
      (row) =>
        String(row.proposal_id) !== proposalId &&
        !relatedIds.has(row.proposal_id),
    )
  )
    throw new AppError(
      "FORBIDDEN",
      "Funder Rules are outside this Proposal scope.",
      403,
    );
}

export function mapPricingLines(
  raw: unknown,
  proposalId: string,
  relatedNumbers: readonly string[] = [],
) {
  const parsed = pricingResponse.safeParse(raw);
  if (!parsed.success)
    throw new AppError("CONTRACT", "Oracle returned invalid Funder Rules.");
  pricingRowsInScope(parsed.data.items, proposalId, relatedNumbers);
  return parsed.data.items
    .filter((row) => row.funding_section_header_lkp_code && row.costing_line_id)
    .map((row) => ({
      id: row.costing_line_id!,
      headerId: row.costing_header_id ?? null,
      proposalId: row.proposal_id,
      proposalNumber: row.proposal_number ?? "",
      collaboratorId: row.collab_id ?? null,
      collaboratorName: row.collab_name ?? "",
      sectionCode: row.funding_section_header_lkp_code!,
      section:
        row.funding_section_header ?? row.funding_section_header_lkp_code!,
      categoryCode: row.cost_category_lkp_code ?? "",
      category: row.cost_category ?? row.cost_category_lkp_code ?? "",
      itemCode: row.cost_category_item_lkp_code ?? null,
      item: row.cost_category_item ?? "",
      name: row.staff_name ?? row.cost_category_item ?? "",
      indexed: row.fec_cost ?? 0,
      unindexed: row.unindex_cost ?? 0,
      eligible: row.cost_to_funder ?? 0,
      funder: row.funder_cost ?? 0,
      institution: row.institution_cost ?? 0,
      funderPercent: row.funder_percent ?? 0,
      funderPercentUnindexed: row.funder_percent_unindexed ?? 0,
      priceRule: row.price_rule_id ?? null,
      indexedPricing: row.indexed_pricing ?? null,
      funderName: row.party_name ?? "",
      funders: (row.funder_details ?? []).map((funder) => ({
        id: funder.funder_id ?? null,
        name: funder.funder_name,
        contribution: funder.funder_contribution ?? 0,
        eligible: funder.cost_to_funder ?? row.cost_to_funder ?? 0,
      })),
    }));
}
export type PricingLine = ReturnType<typeof mapPricingLines>[number] & {
  canEdit: boolean;
};

/** VBCS aggregates leaf funder details across the whole Proposal. */
export function mapGlobalFunders(
  raw: unknown,
  proposalId: string,
  relatedNumbers: readonly string[] = [],
) {
  const parsed = pricingResponse.safeParse(raw);
  if (!parsed.success)
    throw new AppError("CONTRACT", "Oracle returned invalid Funder Rules.");
  pricingRowsInScope(parsed.data.items, proposalId, relatedNumbers);
  const rows = parsed.data.items.filter(
    (row) => row.funding_section_header_lkp_code,
  );
  const indexed = sumCost(rows.map((row) => row.fec_cost));
  const unindexed = sumCost(rows.map((row) => row.unindex_cost));
  const funders = new Map<
    number,
    {
      id: number;
      name: string;
      priority: number;
      contributions: (string | number | null | undefined)[];
      eligibles: (string | number | null | undefined)[];
    }
  >();
  for (const row of rows) {
    for (const funder of row.funder_details ?? []) {
      if (funder.funder_id == null) continue;
      const entry = funders.get(funder.funder_id) ?? {
        id: funder.funder_id,
        name: funder.funder_name,
        priority: funder.funder_priority ?? 999,
        contributions: [],
        eligibles: [],
      };
      if (entry.name !== funder.funder_name)
        throw new AppError(
          "CONTRACT",
          "Funder identity changed across pricing lines.",
        );
      entry.contributions.push(funder.funder_contribution);
      entry.eligibles.push(
        funder.cost_to_funder ??
          (row.cost_to_funder != null &&
          !Number.isFinite(Number(row.cost_to_funder))
            ? row.cost_to_funder
            : null),
      );
      funders.set(entry.id, entry);
    }
  }
  return [...funders.values()]
    .sort((a, b) => a.priority - b.priority || a.id - b.id)
    .map((funder) => {
      const contribution = sumCost(funder.contributions);
      const eligible = funder.eligibles.every((value) => value == null)
        ? "—"
        : sumCost(funder.eligibles);
      const percent = ratio(contribution, indexed);
      const unindexedContribution =
        Number.isFinite(Number(percent)) && Number.isFinite(Number(unindexed))
          ? Number(percent) * Number(unindexed)
          : String(percent);
      return {
        id: funder.id,
        name: funder.name,
        contribution,
        eligible,
        percent,
        unindexedContribution,
        unindexedPercent: ratio(contribution, unindexed),
      };
    });
}

function ratio(numerator: string | number, denominator: string | number) {
  const n = Number(numerator);
  const d = Number(denominator);
  if (!Number.isFinite(n)) return String(numerator);
  if (!Number.isFinite(d)) return String(denominator);
  return d === 0 ? 0 : n / d;
}

export function mapPricing(
  raw: unknown,
  proposalId: string,
  relatedNumbers: readonly string[] = [],
) {
  const parsed = pricingResponse.safeParse(raw);
  if (!parsed.success)
    throw new AppError("CONTRACT", "Oracle returned invalid Funder Rules.");
  pricingRowsInScope(parsed.data.items, proposalId, relatedNumbers);
  const rows = parsed.data.items.filter(
    (row) => row.funding_section_header_lkp_code,
  );
  const sum = (
    key:
      | "institution_cost"
      | "funder_cost"
      | "fec_cost"
      | "unindex_cost"
      | "cost_to_funder",
  ) => sumCost(rows.map((row) => row[key]));
  const institution = sum("institution_cost");
  const funder = sum("funder_cost");
  const indexed = sum("fec_cost");
  const unindexed = sum("unindex_cost");
  const eligible = sum("cost_to_funder");
  const maskedUnindexedPercent = rows
    .map((row) => row.funder_percent_unindexed)
    .find((value) => value != null && !Number.isFinite(Number(value)));
  return {
    institution,
    institutionPercent: ratio(institution, indexed),
    funder,
    funderPercent: ratio(funder, indexed),
    unindexedFunderPercent:
      maskedUnindexedPercent == null
        ? ratio(funder, unindexed)
        : String(maskedUnindexedPercent),
    indexed,
    unindexed,
    eligible,
  };
}

export async function proposalPricing(
  type: RecordIdentity["type"],
  id: string,
) {
  const [context, configured, rb] = await Promise.all([
    proposalPage(type, id, "proposals-pricing"),
    formattingConfiguration(),
    resources(),
  ]);
  if (!configured.currency)
    throw new AppError(
      "CONTRACT",
      "The default pricing currency is unavailable.",
    );
  const [raw, ratesRaw] = await Promise.all([
    proposals.pricingDetails({ proposalId: id }),
    reports.currencyRates({
      currency: configured.currency,
      proposalId: id,
      versionId: context.summary.budgetVersionId ?? undefined,
    }),
  ]);
  const rates = z
    .object({
      rates: z.record(z.string(), z.union([z.number(), z.string()])),
      currencies: z.array(
        z.object({
          currrency_code: z.string(),
          currency_value: z.string(),
        }),
      ),
    })
    .parse(ratesRaw);
  const currencies = rates.currencies
    .map((row) => ({
      code: row.currrency_code,
      label: row.currency_value,
      rate: Number(rates.rates[row.currrency_code]),
    }))
    .filter((row) => Number.isFinite(row.rate) && row.rate > 0);
  if (!currencies.some((row) => row.code === configured.currency))
    throw new AppError("CONTRACT", "The default pricing rate is unavailable.");
  const relatedNumbers = (context.summary.subproposals ?? [])
    .filter((row) => !row.excludePricing)
    .map((row) => row.proposalNumber);
  const globalFunders = mapGlobalFunders(raw, id, relatedNumbers);
  return {
    ...mapPricing(raw, id, relatedNumbers),
    hasCollaborators: pricingResponse
      .parse(raw)
      .items.some((row) => row.collab_id != null),
    globalFunders,
    lines: mapPricingLines(raw, id, relatedNumbers).map((line) => ({
      ...line,
      canEdit:
        context.rights.edit &&
        context.summary.statusCode === "DRFT" &&
        !context.summary.lockedPageIds.includes(
          context.pageIds.get("proposals-pricing") ?? -1,
        ) &&
        (line.categoryCode === "STAFF"
          ? context.access.get("prop-staff-sensitive-data")?.read === true
          : context.access.get("prop-non-staff-sensitive-data")?.read ===
            true) &&
        line.funders.some((funder) => funder.id != null),
    })),
    bundle: context.bundle,
    canReset:
      context.rights.edit &&
      context.summary.statusCode === "DRFT" &&
      !context.summary.lockedPageIds.includes(
        context.pageIds.get("proposals-pricing") ?? -1,
      ) &&
      mapPricingLines(raw, id, relatedNumbers).length > 0,
    canEditGlobal:
      context.rights.edit &&
      context.summary.statusCode === "DRFT" &&
      !context.summary.lockedPageIds.includes(
        context.pageIds.get("proposals-pricing") ?? -1,
      ) &&
      context.access.get("prop-staff-sensitive-data")?.read === true &&
      context.access.get("prop-non-staff-sensitive-data")?.read === true &&
      serverFunctions.resources.resourceVisible(
        rb,
        context.bundle,
        "button-labels",
        "edit-global-values",
      ) &&
      globalFunders.length > 0,
    reference: context.summary.reference,
    defaultCurrency: configured.currency,
    currencies,
  };
}

async function defaultPricingFor(type: RecordIdentity["type"], id: string) {
  const context = await proposalPage(type, id, "proposals-pricing");
  const pageId = context.pageIds.get("proposals-pricing");
  if (
    !context.rights.edit ||
    context.summary.statusCode !== "DRFT" ||
    (pageId != null && context.summary.lockedPageIds.includes(pageId))
  )
    throw new AppError("FORBIDDEN", "Funder Rules cannot be reset.", 403);
  const summary = z
    .object({
      proposal_id: z.coerce.number().int().positive(),
      proposal_type: z.string(),
      sponsors: z
        .array(
          z.object({
            sponsor_party_id: z.coerce.number().int().positive(),
            sponsor_priority: z.union([z.number(), z.string()]).nullish(),
            sponsor_type_flag_lkp_code: z.string().nullish(),
          }),
        )
        .nullish(),
    })
    .parse(await proposals.summary({ id }));
  if (String(summary.proposal_id) !== id || summary.proposal_type !== type)
    throw new AppError("FORBIDDEN", "The Proposal identity changed.", 403);
  const sponsor = [...(summary.sponsors ?? [])].sort(
    (a, b) =>
      Number(a.sponsor_priority ?? 999) - Number(b.sponsor_priority ?? 999),
  )[0];
  if (!sponsor)
    throw new AppError("CONTRACT", "The primary funder is unavailable.");
  const raw = await proposals.defaultPricing({
    proposalId: id,
    sponsorPartyId: sponsor.sponsor_party_id,
  });
  const parsed = pricingResponse.safeParse(raw);
  if (!parsed.success || parsed.data.items.length === 0)
    throw new AppError(
      "CONTRACT",
      "Oracle returned invalid default Funder Rules.",
    );
  if (parsed.data.items.some((row) => String(row.proposal_id) !== id))
    throw new AppError(
      "FORBIDDEN",
      "Default pricing is outside this Proposal.",
      403,
    );
  return { raw, rows: parsed.data.items, context };
}

/** VBCS previews default pricing before the user chooses Save or Cancel. */
export async function previewPricingReset(
  type: RecordIdentity["type"],
  id: string,
) {
  const { raw } = await defaultPricingFor(type, id);
  return {
    totals: mapPricing(raw, id),
    lines: mapPricingLines(raw, id).map((line) => ({
      ...line,
      canEdit: false,
    })),
  };
}

export async function savePricingReset(
  type: RecordIdentity["type"],
  id: string,
) {
  // VBCS Reset/Save uses the Funder Rules page edit, status, and lock gates
  // enforced by defaultPricingFor. The two sensitive-data reads gate the
  // separate Global Funder Values action. The signed-in DEV user can reset and
  // save P_6741 in VBCS while the non-staff edit action is unavailable.
  const { rows } = await defaultPricingFor(type, id);
  const writable = rows.filter(
    (row) => row.funding_section_header_lkp_code && row.costing_line_id,
  );
  if (writable.length === 0)
    throw new AppError("CONTRACT", "Default pricing has no cost lines.");
  const current = mapPricingLines(
    await proposals.pricingDetails({ proposalId: id }),
    id,
  );
  // Oracle's default calculation can recategorize an existing line, so scope
  // by its stable line/header, funding section, and collaborator identifiers.
  const currentById = new Map(current.map((line) => [line.id, line]));
  if (
    currentById.size !== current.length ||
    new Set(writable.map((row) => row.costing_line_id)).size !==
      writable.length ||
    writable.some((row) => {
      const line = currentById.get(row.costing_line_id!);
      return (
        !line ||
        line.headerId !== (row.costing_header_id ?? null) ||
        line.sectionCode !== row.funding_section_header_lkp_code ||
        line.collaboratorId !== (row.collab_id ?? null)
      );
    })
  )
    throw new AppError("FORBIDDEN", "Default pricing lines changed.", 403);
  const number = (value: string | number | null | undefined) => {
    if (value == null) return 0;
    const parsed = Number(value);
    if (!Number.isFinite(parsed))
      throw new AppError(
        "FORBIDDEN",
        "Masked default pricing cannot be saved.",
        403,
      );
    return parsed;
  };
  await proposals.savePricingLines({
    rows: writable.map((row) => ({
      FEC_COST: number(row.fec_cost),
      FUNDER_CONTRI: number(row.funder_cost),
      FUNDER_PCT: number(row.funder_percent),
      COST_CATEGORY_TYPE: row.cost_category_lkp_code,
      COST_ITEM_ID: row.cost_category_item_lkp_code,
      INSTITUTE_CONTRI: number(row.institution_cost),
      FUNDING_HEADER: row.funding_section_header_lkp_code,
      HEADER_ID: row.costing_header_id,
      LINE_ID: row.costing_line_id,
      NAME_OF_ITEM: row.staff_name,
      PRICE_RULE_CODE: row.price_rule_id,
      COLLAB_ID: row.collab_id ?? null,
    })),
  });
  const updated = await proposals.pricingDetails({ proposalId: id });
  mapPricing(updated, id);
  return { saved: true };
}

const funderEdit = z
  .object({
    lineId: z.number().int().positive(),
    scope: z
      .enum([
        "line",
        "category",
        "section",
        "combined-category",
        "combined-section",
      ])
      .optional(),
    funderId: z.number().int().positive(),
    contribution: z.number().finite().nonnegative(),
    ruleApplied: z.enum(["INDEXED", "UNINDEXED"]),
  })
  .strict();

export async function savePricingFunder(
  type: RecordIdentity["type"],
  id: string,
  input: unknown,
) {
  const body = funderEdit.parse(input);
  const context = await proposalPage(type, id, "proposals-pricing");
  const pageId = context.pageIds.get("proposals-pricing");
  if (
    !context.rights.edit ||
    context.summary.statusCode !== "DRFT" ||
    (pageId != null && context.summary.lockedPageIds.includes(pageId))
  )
    throw new AppError("FORBIDDEN", "Funder Rules cannot be edited.", 403);
  const relatedNumbers = (context.summary.subproposals ?? [])
    .filter((row) => !row.excludePricing)
    .map((row) => row.proposalNumber);
  const raw = await proposals.pricingDetails({ proposalId: id });
  const lines = mapPricingLines(raw, id, relatedNumbers);
  const line = lines.find((row) => row.id === body.lineId);
  if (!line)
    throw new AppError(
      "FORBIDDEN",
      "Pricing line is outside this Proposal.",
      403,
    );
  if (!line.funders.some((funder) => funder.id === body.funderId))
    throw new AppError(
      "FORBIDDEN",
      "Funder is outside this Pricing line.",
      403,
    );
  const scope = body.scope ?? "line";
  const combined = scope.startsWith("combined-");
  if (
    combined &&
    pricingResponse.parse(raw).items.some((row) => row.collab_id != null)
  )
    throw new AppError(
      "FORBIDDEN",
      "Combined pricing with research partners cannot be edited.",
      403,
    );
  const scoped = lines.filter((row) =>
    scope === "line"
      ? row.id === line.id
      : (combined || row.proposalId === line.proposalId) &&
        (combined || row.collaboratorId === line.collaboratorId) &&
        row.sectionCode === line.sectionCode &&
        (scope.endsWith("section") || row.categoryCode === line.categoryCode),
  );
  if (
    scoped.length === 0 ||
    scoped.some((row) => {
      const sensitivePage =
        row.categoryCode === "STAFF"
          ? "prop-staff-sensitive-data"
          : "prop-non-staff-sensitive-data";
      return (
        context.access.get(sensitivePage)?.read !== true ||
        !row.funders.some((funder) => funder.id === body.funderId)
      );
    })
  )
    throw new AppError(
      "FORBIDDEN",
      "Pricing group or funder access has not been granted.",
      403,
    );
  const indexed = scoped.reduce((sum, row) => sum + Number(row.indexed), 0);
  const eligible = scoped.reduce((sum, row) => sum + Number(row.eligible), 0);
  const institution = scoped.reduce(
    (sum, row) => sum + Number(row.institution),
    0,
  );
  if (
    !Number.isFinite(indexed) ||
    !Number.isFinite(eligible) ||
    !Number.isFinite(institution)
  )
    throw new AppError("FORBIDDEN", "Masked pricing cannot be edited.", 403);
  await proposals.savePricingLines({
    funderId: body.funderId,
    rows: [
      {
        OBJECT_TYPE: scope === "line" ? "COSTING_LINE_ID" : "PROPOSAL_ID",
        OBJECT_ID:
          scope === "line" ? line.id : combined ? Number(id) : line.proposalId,
        FILTER_BY: scope.endsWith("section")
          ? "FUNDING_SECTION_HEADER_LKP_CODE"
          : scope.endsWith("category")
            ? "COST_CATEGORY"
            : null,
        FILTER_VALUE: scope.endsWith("section")
          ? line.sectionCode
          : scope.endsWith("category")
            ? line.category
            : null,
        FUNDING_SECTION: scope.endsWith("category") ? line.sectionCode : null,
        RULE_APPLIED_ON: body.ruleApplied,
        COLLAB_ID: combined ? null : line.collaboratorId,
        FEC_COST: indexed,
        ELIGIBLE_COST: eligible,
        FUNDER_CONTRI: body.contribution,
        FUNDER_PCT: indexed === 0 ? 0 : (body.contribution / indexed) * 100,
        INSTITUTE_CONTRI: institution,
        INSTITUTE_PCT: indexed === 0 ? 0 : (institution / indexed) * 100,
        SPONSOR_ID: body.funderId,
      },
    ],
  });
  mapPricing(
    await proposals.pricingDetails({ proposalId: id }),
    id,
    relatedNumbers,
  );
  return { saved: true };
}

const globalFunderEdit = z
  .object({
    funderId: z.number().int().positive(),
    contribution: z.number().finite().nonnegative(),
    ruleApplied: z.enum(["", "UNINDEXED"]),
  })
  .strict();

/** The VBCS global dialog edits one sponsor across every Proposal cost line. */
export async function saveGlobalPricingFunder(
  type: RecordIdentity["type"],
  id: string,
  input: unknown,
) {
  const body = globalFunderEdit.parse(input);
  const [context, rb] = await Promise.all([
    proposalPage(type, id, "proposals-pricing"),
    resources(),
  ]);
  const pageId = context.pageIds.get("proposals-pricing");
  if (
    !context.rights.edit ||
    context.summary.statusCode !== "DRFT" ||
    (pageId != null && context.summary.lockedPageIds.includes(pageId)) ||
    context.access.get("prop-staff-sensitive-data")?.read !== true ||
    context.access.get("prop-non-staff-sensitive-data")?.read !== true ||
    !serverFunctions.resources.resourceVisible(
      rb,
      context.bundle,
      "button-labels",
      "edit-global-values",
    )
  )
    throw new AppError(
      "FORBIDDEN",
      "Global Funder Values cannot be edited.",
      403,
    );
  const raw = await proposals.pricingDetails({ proposalId: id });
  const relatedNumbers = (context.summary.subproposals ?? [])
    .filter((row) => !row.excludePricing)
    .map((row) => row.proposalNumber);
  const funders = mapGlobalFunders(raw, id, relatedNumbers);
  const funder = funders.find((row) => row.id === body.funderId);
  if (!funder)
    throw new AppError("FORBIDDEN", "Funder is outside this Proposal.", 403);
  const totals = mapPricing(raw, id, relatedNumbers);
  const indexed = Number(totals.indexed);
  const eligible = Number(totals.eligible);
  const institution = Number(totals.institution);
  if (
    !Number.isFinite(indexed) ||
    !Number.isFinite(eligible) ||
    !Number.isFinite(institution) ||
    !Number.isFinite(Number(funder.contribution))
  )
    throw new AppError("FORBIDDEN", "Masked pricing cannot be edited.", 403);
  await proposals.savePricingLines({
    funderId: body.funderId,
    rows: [
      {
        OBJECT_TYPE: "PROPOSAL_ID",
        OBJECT_ID: Number(id),
        FILTER_BY: null,
        FILTER_VALUE: null,
        FUNDING_SECTION: null,
        RULE_APPLIED_ON: body.ruleApplied,
        COLLAB_ID: null,
        FEC_COST: indexed,
        ELIGIBLE_COST: eligible,
        FUNDER_CONTRI: body.contribution,
        FUNDER_PCT: indexed === 0 ? 0 : (body.contribution / indexed) * 100,
        INSTITUTE_CONTRI: institution,
        INSTITUTE_PCT: indexed === 0 ? 0 : (institution / indexed) * 100,
        SPONSOR_ID: body.funderId,
      },
    ],
  });
  const updated = await proposals.pricingDetails({ proposalId: id });
  mapPricing(updated, id, relatedNumbers);
  return {
    saved: true,
    funders: mapGlobalFunders(updated, id, relatedNumbers),
  };
}
