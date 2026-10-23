import "server-only";
import { z } from "zod";
import { fxRates, proposals, roles } from "@/server/oracle/api";
import { authenticate } from "@/server/identity/session/service";
import {
  finalizedOf,
  objectAccessOf,
  requireModule,
} from "@/server/platform/permissions";
import {
  label,
  resources,
  resourceVisible,
} from "@/server/platform/configuration/resources";
import { proposalBundle } from "@/server/modules/proposals/record";
import { early } from "@/server/platform/async";
import { AppError } from "@/lib/errors";
import {
  FX_MODES,
  withEdits,
  type FxEdit,
  type FxMode,
  type FxRate,
  type FxText,
  type FxView,
} from "@/features/record/fx-rates/model";
const recordId = z.string().regex(/^[1-9]\d{0,14}$/);
export const fxTarget = z
  .object({
    type: z.enum([
      "PROPOSAL",
      "OUTLINE_PROPOSAL",
      "SUB_PROPOSAL",
      "EXTENSION_PROPOSAL",
    ]),
    id: recordId,
    versionId: recordId,
    mode: z.enum(FX_MODES),
  })
  .strict();
export type FxTarget = z.infer<typeof fxTarget>;
/** Legacy host `editable`: only these proposal types change their rates (proposals-info-start-page.html:1155). */
const EDITABLE_TYPES = ["PROPOSAL", "OUTLINE_PROPOSAL", "EXTENSION_PROPOSAL"];
/** The host tab whose finalize locks the rates (legacy objectType came from the current flow). */
const PAGE_OF: Record<FxMode, string> = {
  PURCHASE: "proposals-budget",
  INCOME: "proposals-pricing",
};
const TEXTS: Record<
  Exclude<FxText, "reset" | "edited">,
  [string, string, string]
> = {
  title: ["dialog-titles", "fx-rates", "FX Rates"],
  currency: ["table-headers", "fx-currency", "Currency"],
  cost: ["table-headers", "fx-cost-rate", "Cost Rate"],
  price: ["table-headers", "fx-price-rate", "Price Rate"],
  save: ["button-labels", "save", "Save"],
  noData: ["helper-texts", "no-data", "No data to display."],
};
const rate = z.coerce.number().finite().nullish().catch(null);
const rateRow = z.object({
  proposal_fx_rate_id: z.coerce.number().int().nullish().catch(null),
  currency_code: z.string().min(1),
  currency_name: z.string().nullish(),
  costing_fx_rate: rate,
  pricing_fx_rate: rate,
  default_costing_fx_rate: rate,
  default_pricing_fx_rate: rate,
  rate_status: z.string().nullish(),
});
const ratesSchema = z.object({
  can_edit: z.string().nullish(),
  is_active_version: z.string().nullish(),
  proposal_id: z.coerce.number().nullish(),
  fx_rates: z.array(rateRow).nullish(),
});
const proposalSchema = z.object({
  proposal_id: z.coerce.number(),
  proposal_type: z.string(),
  proposal_status: z.string().nullish(),
  locked_modules: z
    .array(z.object({ id: z.coerce.number(), page_id: z.coerce.number() }))
    .nullish()
    .catch(null),
});
const roleSchema = z.object({
  items: z.array(
    z.object({
      page_id: z.coerce.number().int().nullish().catch(null),
      page_name: z.string(),
      read_access: z
        .string()
        .nullish()
        .transform((v) => v ?? null),
      edit_access: z.string().nullish(),
      delete_access: z.string().nullish(),
    }),
  ),
});
const toRate = (r: z.infer<typeof rateRow>): FxRate => ({
  rateId: r.proposal_fx_rate_id ?? null,
  currency: r.currency_code,
  name: r.currency_name ?? r.currency_code,
  cost: r.costing_fx_rate ?? null,
  price: r.pricing_fx_rate ?? null,
  defaultCost: r.default_costing_fx_rate ?? null,
  defaultPrice: r.default_pricing_fx_rate ?? null,
  status: r.rate_status ?? "",
});
/** The save body's row: legacy fxRatesType's keys, nothing else (an explicit pick, never the view model). */
export const toPayloadRow = (r: FxRate) => ({
  proposal_fx_rate_id: r.rateId,
  currency_code: r.currency,
  currency_name: r.name,
  costing_fx_rate: r.cost,
  pricing_fx_rate: r.price,
  default_costing_fx_rate: r.defaultCost,
  default_pricing_fx_rate: r.defaultPrice,
  rate_status: r.status,
});
const denied = (message = "You do not have access to FX rates.") =>
  new AppError("FORBIDDEN", message, 403);
/**
 * Reads the record's rates with every gate decided here, failing closed: PROPOSALS module, `proposal-fx-rates` read
 * (edit to change), the type's `button-labels.fx-rates` visible, and for editing the legacy button and fragment
 * gates together: editable type, Draft, host tab not finalized, active version and the backend's `can_edit`.
 */
async function readRates(t: FxTarget) {
  const { user } = await authenticate();
  requireModule(user, "PROPOSALS");
  // Read together; the role check still decides first, and nothing is returned before every check passes.
  const ratesRead = early(
      fxRates.rates({ proposalId: t.id, versionId: t.versionId }),
    ),
    proposalRead = early(proposals.summary({ id: t.id })),
    labels = early(resources());
  const access = objectAccessOf(
    roleSchema.parse(await roles.record({ objectType: t.type, objectId: t.id }))
      .items,
  );
  const page = access.roles.get("proposal-fx-rates");
  if (!page?.read) throw denied();
  const rows = await labels,
    bundle = proposalBundle(rows, t.type);
  if (!resourceVisible(rows, bundle, "button-labels", "fx-rates"))
    throw denied("FX rates are not enabled for this proposal type.");
  const proposal = proposalSchema.safeParse(await proposalRead);
  if (
    !proposal.success ||
    String(proposal.data.proposal_id) !== t.id ||
    proposal.data.proposal_type !== t.type
  )
    throw new AppError("CONTRACT", "Oracle returned a different proposal.");
  const body = ratesSchema.safeParse(await ratesRead);
  if (
    !body.success ||
    (body.data.proposal_id !== null &&
      body.data.proposal_id !== undefined &&
      String(body.data.proposal_id) !== t.id)
  )
    throw new AppError("CONTRACT", "Oracle returned invalid FX rates.");
  const tab = access.pages.find((p) => p.name === PAGE_OF[t.mode]);
  const finalized =
    tab === undefined ||
    finalizedOf(access.pages, proposal.data.locked_modules ?? []).has(tab.name);
  const editable =
    page.edit &&
    EDITABLE_TYPES.includes(t.type) &&
    proposal.data.proposal_status === "DRFT" &&
    !finalized &&
    body.data.is_active_version === "Y" &&
    body.data.can_edit === "Y";
  return {
    view: {
      rates: (body.data.fx_rates ?? []).map(toRate),
      editable,
      mode: t.mode,
      texts: {
        ...(Object.fromEntries(
          Object.entries(TEXTS).map(([k, [group, key, fallback]]) => [
            k,
            label(rows, bundle, group, key, fallback),
          ]),
        ) as Record<keyof typeof TEXTS, string>),
        // Legacy has no RB keys for these: an icon-only reset and a literal "Edited" title on the marker.
        reset: "Reset",
        edited: "Edited",
      },
    } satisfies FxView,
  };
}
export function fxQuery(q: URLSearchParams): FxTarget {
  const parsed = fxTarget.safeParse(Object.fromEntries(q));
  if (!parsed.success)
    throw new AppError("BAD_REQUEST", "Invalid FX rates request.", 400);
  return parsed.data;
}
/** GET: the record version's FX rates for the host tab's mode. */
export async function loadFxRates(t: FxTarget): Promise<FxView> {
  return (await readRates(t)).view;
}
const saveInput = z
  .object({
    target: fxTarget,
    edits: z
      .array(
        z
          .object({
            currency: z.string().min(1).max(10),
            reset: z.boolean(),
            rate: z.number().finite().optional(),
          })
          .strict(),
      )
      .max(500),
  })
  .strict();
/**
 * POST: WRITES the version's rates (`postProposalFxRates`, `mode` = the host tab's), built from the rows read here with
 * the browser's edits applied, then re-reads them as legacy saveFXRates does. The host refreshes its own rates after.
 */
export async function saveFxRates(raw: unknown): Promise<FxView> {
  const parsed = saveInput.safeParse(raw);
  if (!parsed.success)
    throw new AppError("BAD_REQUEST", "Invalid FX rates request.", 400);
  const { target, edits } = parsed.data;
  const { view } = await readRates(target);
  if (!view.editable) throw denied("These FX rates cannot be changed.");
  const known = new Set(view.rates.map((r) => r.currency)),
    byCurrency: Record<string, FxEdit> = {};
  for (const e of edits) {
    if (!known.has(e.currency) || byCurrency[e.currency])
      throw new AppError("BAD_REQUEST", "Invalid FX rates request.", 400);
    byCurrency[e.currency] = e;
  }
  await fxRates.save({
    proposalId: target.id,
    versionId: target.versionId,
    mode: target.mode,
    body: {
      fx_rates: withEdits(view.rates, byCurrency, target.mode).map(
        toPayloadRow,
      ),
    },
  });
  return loadFxRates(target);
}
