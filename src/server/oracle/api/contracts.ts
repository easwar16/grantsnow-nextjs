import "server-only";
import { read } from "../client";
import type { Operation } from "../connection";
import { AppError } from "@/lib/errors";

type Value = string | number | boolean | null | undefined;
type Fields = Record<string, Value>;
const operations = [
  "getSecurityUser_roles",
  "getGetAllContracts",
  "getContractsContract_id",
  "getContractsGetContractVersions",
  "getApproval_setupApproval_stages",
  "getApproval_setupApproval_stages_graph",
  "getApproval_setupGet_stage_users",
  "getContractsSignerDetails",
  "getProposalDelegationsProposal_id",
  "getSharedObjectStatus",
  "getPre_awardGetApprovalHistory",
  "getProposalComments",
  "getSharedGetObjectAudits2",
  "getSharedGetObjectDates",
  "getPre_awardGetLookupTypesCodes",
  "getContractsGetRelationType",
  "getProposalEthical_dynFormsP_ref_module",
  "getPre_awardGetPersonListAll",
  "getContractsGetContractTemplateName",
  "getContractsGetRelationItem",
] as const satisfies readonly Operation[];
type ContractOperation = (typeof operations)[number];

/** Existing Contract ORDS reads while their service moves to the named API definitions. */
export function contractRead(
  op: ContractOperation,
  headers: Fields,
  query?: URLSearchParams,
  signal?: AbortSignal,
  path?: Record<string, string>,
) {
  if (!(operations as readonly string[]).includes(op))
    throw new AppError("BAD_REQUEST", "Unapproved Contract read.", 400);
  const params = {
    headers: Object.fromEntries(
      Object.entries(headers).filter(([name]) => name !== "token"),
    ),
    query: Object.fromEntries(query ?? []),
    path: path ?? {},
  };
  return read<typeof params>({
    op,
    headers: (p) => p.headers,
    query: (p) => p.query,
    path: (p) => p.path,
  })(params, { signal });
}
