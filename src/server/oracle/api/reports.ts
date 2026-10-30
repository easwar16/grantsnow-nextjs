import "server-only";
import { read, writeFile } from "../client";

/** VBCS Print menu for one Proposal. */
export const forObject = read<{ id: string }>({
  op: "getReportsGetObjectRef",
  headers: (p) => ({ p_object_id: p.id, p_object_type: "PROPOSAL" }),
});

/** VBCS Print currency choices and current version rates. */
export const currencyRates = read<{
  currency: string;
  proposalId: string;
  versionId?: number;
}>({
  op: "getSharedGetCurrencyRate",
  headers: (p) => ({
    currency_code: p.currency,
    mode: "INCOME",
    proposal_id: p.proposalId,
    version_id: p.versionId,
  }),
});

/** VBCS Viability Checks: customer report keyed by Budget, proposal and version. */
export const viability = read<{ proposalId: string; versionId: number }>({
  op: "getSharedGetCustomerReport2",
  headers: (p) => ({
    p_report_code: "proposals-budget",
    p_param1: p.proposalId,
    p_param2: p.versionId,
  }),
});

/** The report payload is constructed by the Proposal service from session and validated choices. */
export const generate = writeFile<{ body: unknown }>({
  op: "generateReport",
  body: (p) => p.body,
});
