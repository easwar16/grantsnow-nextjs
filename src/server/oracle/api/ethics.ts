import "server-only";
import { read, write } from "../client";

/** Legacy ethics-start-page: a page of applications for one permitted access tab. */
export const applications = read<{
  accessType: string;
  query: Record<string, string>;
}>({
  op: "getDynamicFormsApplicationList",
  headers: (p) => ({ access_type: p.accessType, object_type: "ETHICS", ref_module: "ETHICS" }),
  query: (p) => p.query,
});

/** Legacy fetchEthicsSetupChain: the setup header and stakeholder data. */
export const setup = read<{ id: string }>({
  op: "getDynamicFormsApplicationSetup",
  query: (p) => ({ setup_flow_id: p.id }),
});
export const versions = read<{ id: string }>({
  op: "getDynamicFormsApplSetupVersionList2",
  headers: (p) => ({ setup_flow_id: p.id }),
});
export const setupVersion = read<{ id: string; version: number }>({
  op: "getDynamicFormsApplicationSetupVersion",
  headers: (p) => ({ setup_flow_id: p.id, version: p.version }),
});
export const reviewers = read<void>({
  op: "getDynamicFormsGetApplicationApprover",
});
export const deleted = read<void>({
  op: "getDynamicFormsGetDeletedApplicationList",
  headers: () => ({ p_obj_type: "ETHICS" }),
});
export const restore = write<{ id: string }>({
  op: "getDynamicFormsRestoreApplicationSetup_flow_id",
  path: (p) => ({ setup_flow_id: p.id }),
  invalidates: [
    "getDynamicFormsApplicationList",
    "getDynamicFormsGetDeletedApplicationList",
  ],
});
/** Legacy dynamic-form fragment loads a definition tagged by Ethics form type. */
export const form = read<{ formType: string }>({
  op: "getProposalEthical_dynFormsP_ref_module",
  headers: (p) => ({
    p_id: "",
    p_obj_id: "",
    p_obj_type: "ETHICS",
    p_ref_module: "ETHICS",
    p_tag_type: "ETHICS_TYPE",
    p_tag_value: p.formType,
  }),
});
export const save = write<{ body: Record<string, unknown> }>({
  op: "postDynamicFormsApplicationSetup",
  body: (p) => p.body,
  invalidates: ["getDynamicFormsApplicationList"],
});
/** Source listing Clone dialog options and its explicit selected-object payload. */
export const copyOptions = read<void>({
  op: "getProposalCopyApplicationObjList",
  headers: () => ({ obj_type: "ETHICS" }),
});
export const copy = write<{
  id: string;
  access: string;
  objects: { object_name: string; object_val: true }[];
}>({
  op: "postDynamicFormsCopyApplication",
  headers: (p) => ({ p_setup_flow_id: p.id, object_type: "ETHICS", access_type: p.access }),
  body: (p) => ({ setup_flow_id: Number(p.id), object_type: "ETHICS", access_type: p.access, objects: p.objects }),
  invalidates: ["getDynamicFormsApplicationList"],
});
export const remove = write<{ id: string }>({
  op: "deleteDynamicFormsApplicationSetup",
  query: (p) => ({ setup_flow_id: p.id }),
  invalidates: ["getDynamicFormsApplicationList", "getDynamicFormsGetDeletedApplicationList"],
});
/** VBCS General Overview/Responses unlink only the chosen relationship. */
export const unlinkReference = write<{ id: string; relationId: string; page: string }>({
  op: "deleteDynamicFormsReferenceObject",
  headers: (p) => ({ setup_flow_id: p.id, reln_id: p.relationId, page_name: p.page }),
  invalidates: ["getDynamicFormsApplicationSetup", "getSharedObjectLinked2"],
});
