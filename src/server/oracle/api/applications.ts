import "server-only";
import { read, write } from "../client";

/**
 * Dynamic-form applications (application setups): Ethics (`ETHICS`) and Due Diligence (`DUE_DILIGENCE`) are the same
 * backend calls for different object types, and records list their linked applications by type.
 */
type Kind = { objectType: string };
/** One page of applications for a permitted access tab (legacy ethics / due-diligence start pages). */
export const list = read<
  Kind & { accessType: string; query: Record<string, string> }
>({
  op: "getDynamicFormsApplicationList",
  headers: (p) => ({
    access_type: p.accessType,
    object_type: p.objectType,
    ref_module: p.objectType,
  }),
  query: (p) => p.query,
});
/** The setup header and stakeholder data (legacy fetchEthicsSetupChain / fetchDueDiligenceSetupChain). */
export const setup = read<{ id: string }>({
  op: "getDynamicFormsApplicationSetup",
  query: (p) => ({ setup_flow_id: p.id }),
});
/** The setup's saved versions (ApplSetupVersionList2), for the version selector. */
export const versions = read<{ id: string }>({
  op: "getDynamicFormsApplSetupVersionList2",
  headers: (p) => ({ setup_flow_id: p.id }),
});
/** One saved version of the setup. */
export const setupVersion = read<{ id: string; version: number }>({
  op: "getDynamicFormsApplicationSetupVersion",
  headers: (p) => ({ setup_flow_id: p.id, version: p.version }),
});
/** The people who can review or supervise an application (getApplicationApprover). */
export const approvers = read<void>({
  op: "getDynamicFormsGetApplicationApprover",
});
/**
 * The recycle bin of one application type. Legacy Ethics sends no `p_obj_type` (the backend's default) and Due
 * Diligence sends DUE_DILIGENCE; DEV answers nothing for an explicit ETHICS.
 */
export const deleted = read<{ objectType?: string }>({
  op: "getDynamicFormsGetDeletedApplicationList",
  headers: (p) => (p.objectType ? { p_obj_type: p.objectType } : {}),
});
/** WRITES: restores a deleted application (a GET that changes data). */
export const restore = write<{ id: string }>({
  op: "getDynamicFormsRestoreApplicationSetup_flow_id",
  path: (p) => ({ setup_flow_id: p.id }),
  invalidates: [
    "getDynamicFormsApplicationList",
    "getDynamicFormsGetDeletedApplicationList",
  ],
});
/** WRITES: creates or saves an application setup. */
export const save = write<{ body: Record<string, unknown> }>({
  op: "postDynamicFormsApplicationSetup",
  body: (p) => p.body,
  invalidates: ["getDynamicFormsApplicationList"],
});
/** The listing's clone options for one application type. */
export const copyOptions = read<Kind>({
  op: "getProposalCopyApplicationObjList",
  headers: (p) => ({ obj_type: p.objectType }),
});
/** WRITES: copies the selected parts of an application. */
export const copy = write<
  Kind & {
    id: string;
    access: string;
    objects: { object_name: string; object_val: true }[];
  }
>({
  op: "postDynamicFormsCopyApplication",
  headers: (p) => ({
    p_setup_flow_id: p.id,
    object_type: p.objectType,
    access_type: p.access,
  }),
  body: (p) => ({
    setup_flow_id: Number(p.id),
    object_type: p.objectType,
    access_type: p.access,
    objects: p.objects,
  }),
  invalidates: ["getDynamicFormsApplicationList"],
});
/** WRITES: moves an application to the recycle bin. */
export const remove = write<{ id: string }>({
  op: "deleteDynamicFormsApplicationSetup",
  query: (p) => ({ setup_flow_id: p.id }),
  invalidates: [
    "getDynamicFormsApplicationList",
    "getDynamicFormsGetDeletedApplicationList",
  ],
});
/** The applications of one type linked to a record (getApplicationList: a proposal's, an award's due diligence). */
export const linked = read<Kind & { refId: string }>({
  op: "getProposalGetApplicationList",
  headers: (p) => ({ p_obj_type: p.objectType, p_obj_ref_id: p.refId }),
});
/** WRITES: removes one reference from a setup (General Overview / Responses unlink). */
export const unlinkReference = write<{
  id: string;
  relationId: string;
  page: string;
}>({
  op: "deleteDynamicFormsReferenceObject",
  headers: (p) => ({
    setup_flow_id: p.id,
    reln_id: p.relationId,
    page_name: p.page,
  }),
  invalidates: ["getDynamicFormsApplicationSetup", "getSharedObjectLinked2"],
});
