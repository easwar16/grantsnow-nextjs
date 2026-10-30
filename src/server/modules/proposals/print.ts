import "server-only";
import { serverFunctions } from "@/server/functions";
import { z } from "zod";
import { AppError } from "@/lib/errors";
import { reports } from "@/server/oracle/api";
import { formattingConfiguration } from "@/server/platform/configuration/formatting";
import { proposalPage } from "./record";

const report = z.object({
  page_name: z.string().min(1),
  page_desc: z.string().min(1),
  output_file_name: z.string().nullish(),
  show_item: z.string().nullish(),
});
const list = z.object({ items: z.array(report) });
const rates = z.object({
  rates: z.record(z.string(), z.union([z.number(), z.string()])),
  currencies: z.array(
    z.object({
      currrency_code: z.string(),
      currency_value: z.string(),
      currency_symbol: z.string().nullish(),
    }),
  ),
});
const identity = z.object({
  type: z.enum([
    "PROPOSAL",
    "OUTLINE_PROPOSAL",
    "SUB_PROPOSAL",
    "EXTENSION_PROPOSAL",
  ]),
  id: z.string().regex(/^[1-9]\d{0,14}$/),
});

async function available(type: string, id: string) {
  const record = identity.parse({ type, id });
  const context = await proposalPage(
    record.type,
    record.id,
    "proposals-summary",
  );
  if (context.access.get("proposals-print-button")?.read !== true)
    throw new AppError("FORBIDDEN", "Print access has not been granted.", 403);
  const configured = await formattingConfiguration();
  if (!configured.currency)
    throw new AppError(
      "CONTRACT",
      "The default report currency is unavailable.",
    );
  const [rawReports, rawRates] = await Promise.all([
    reports.forObject({ id: record.id }),
    reports.currencyRates({
      currency: configured.currency,
      proposalId: record.id,
      versionId: context.summary.budgetVersionId ?? undefined,
    }),
  ]);
  return {
    context,
    reportRows: list.parse(rawReports).items,
    currencyData: rates.parse(rawRates),
    defaultCurrency: configured.currency,
  };
}

export async function proposalPrintOptions(type: string, id: string) {
  const { reportRows, currencyData, defaultCurrency } = await available(
    type,
    id,
  );
  return {
    reports: reportRows.map((row) => ({
      code: row.page_name,
      label: row.page_desc,
      enabled: row.show_item !== "N",
    })),
    currencies: currencyData.currencies.map((row) => ({
      code: row.currrency_code,
      label: row.currency_value,
      rate: String(currencyData.rates[row.currrency_code] ?? ""),
    })),
    defaultCurrency,
  };
}

export async function printProposal(type: string, id: string, raw: unknown) {
  const { code, currency } = z
    .object({ code: z.string(), currency: z.string() })
    .strict()
    .parse(raw);
  const { context, reportRows, currencyData } = await available(type, id);
  const selected = reportRows.find(
    (row) => row.page_name === code && row.show_item !== "N",
  );
  const chosenCurrency = currencyData.currencies.find(
    (row) => row.currrency_code === currency,
  );
  const rate = Number(currencyData.rates[currency]);
  if (!selected || !chosenCurrency || !Number.isFinite(rate) || rate <= 0)
    throw new AppError(
      "BAD_REQUEST",
      "Choose an available report and currency.",
      400,
    );
  const number = Number(id);
  const orgId = Number(context.user.organizationId);
  if (!Number.isSafeInteger(number) || !Number.isSafeInteger(orgId))
    throw new AppError("CONTRACT", "The report identity is unavailable.");
  return reports.generate({
    // Legacy PrintMenuActionChain sends selectedValue[0], the page name; the pair made report_code null.
    body: serverFunctions.reports.reportPayload(selected.page_name, {
      object_type: context.identity.type,
      object_id: number,
      proposal_id: number,
      curr_code: currency,
      curr_symbol: chosenCurrency.currency_symbol ?? "",
      conv_rate: rate,
      org_id: orgId,
    }),
  });
}
