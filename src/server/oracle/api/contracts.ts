import "server-only";
import { read } from "../client";

/** Contracts (legacy contracts flow); bodies come back as read and the services apply their schemas. */
/**
 * One page of contracts (getAllContracts): the listing's status and level as headers, or the contracts linked to a
 * record (`reference`); the page, clause and sort as the caller builds them.
 */
export const list = read<{
  status?: string;
  level?: string;
  reference?: string;
  query: Record<string, string>;
}>({
  op: "getGetAllContracts",
  headers: (p) => ({
    ...(p.status === undefined ? {} : { p_status: p.status }),
    ...(p.level === undefined ? {} : { p_level: p.level }),
    ...(p.reference === undefined ? {} : { p_object_ref_id: p.reference }),
  }),
  // Legacy also sends the filterCriterion object_ref_id $eq, which transforms.js turns into this clause; DEV
  // ignores the header alone and answers unlinked contracts.
  query: (p) => ({
    ...p.query,
    ...(p.reference === undefined
      ? {}
      : {
          p_where_clause: `("object_ref_id"='${p.reference.replace(/'/g, "''")}')`,
        }),
  }),
});
/** One contract's header row. */
export const byId = read<{ id: string }>({
  op: "getContractsContract_id",
  path: (p) => ({ contract_id: p.id }),
});
/** The contract's document versions (legacy Contract Version selector). */
export const versions = read<{ id: string }>({
  op: "getContractsGetContractVersions",
  headers: (p) => ({ contract_id: p.id }),
});
/** The contract's DocuSign signers. */
export const signers = read<{ id: string }>({
  op: "getContractsSignerDetails",
  headers: (p) => ({ contract_id: p.id }),
});
/** The object types a contract can relate to (getRelationType). */
export const relationTypes = read<void>({ op: "getContractsGetRelationType" });
/**
 * Records of one type a record can relate to (getRelationItem), optionally within an org unit or in one status (the
 * proposals an award can be made from: PROPOSAL in status AWARD).
 */
export const relationItems = read<{
  objectType: string;
  orgId?: string;
  status?: string;
}>({
  op: "getContractsGetRelationItem",
  headers: (p) => ({
    object_type: p.objectType,
    ...(p.orgId ? { org_unit_id: p.orgId } : {}),
    ...(p.status ? { object_status: p.status } : {}),
  }),
});
/** Standard templates for a type and level; with `templateId`, that template. */
export const templates = read<{
  type: string;
  level: string;
  templateId?: string;
}>({
  op: "getContractsGetContractTemplateName",
  headers: (p) => ({
    contract_type: p.type,
    contract_level: p.level,
    ...(p.templateId ? { template_id: p.templateId } : {}),
  }),
});
/** The template placeholder tags (getPlaceholderTags): legacy calls it without the token header. */
export const placeholderTags = read<void>({
  op: "getGetPlaceholderTags",
  tokenHeader: false,
});
