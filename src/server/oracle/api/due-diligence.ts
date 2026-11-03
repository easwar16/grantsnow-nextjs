import "server-only";
import { read, write } from "../client";

/** Legacy due-diligence-start-page: a page of applications for one permitted access tab. */
export const applications = read<{
  accessType: string;
  query: Record<string, string>;
}>({
  op: "getDynamicFormsApplicationList",
  headers: (p) => ({
    access_type: p.accessType,
    object_type: "DUE_DILIGENCE",
    ref_module: "DUE_DILIGENCE",
  }),
  query: (p) => p.query,
});

/** Legacy fetchDueDiligenceSetupChain: the setup header and stakeholder data. */
export const setup = read<{ id: string }>({
  op: "getDynamicFormsApplicationSetup",
  query: (p) => ({ setup_flow_id: p.id }),
});
export const supervisors = read<void>({
  op: "getDynamicFormsGetApplicationApprover",
});
export const deleted = read<void>({
  op: "getDynamicFormsGetDeletedApplicationList",
  headers: () => ({ p_obj_type: "DUE_DILIGENCE" }),
});
export const restore = write<{ id: string }>({
  op: "getDynamicFormsRestoreApplicationSetup_flow_id",
  path: (p) => ({ setup_flow_id: p.id }),
  invalidates: [
    "getDynamicFormsApplicationList",
    "getDynamicFormsGetDeletedApplicationList",
  ],
});
/** Legacy dynamic-form fragment loads a definition tagged by Due Diligence form type. */
export const form = read<{ formType: string }>({
  op: "getProposalEthical_dynFormsP_ref_module",
  headers: (p) => ({
    p_id: "",
    p_obj_id: "",
    p_obj_type: "DUE_DILIGENCE",
    p_ref_module: "DUE_DILIGENCE",
    p_tag_type: "DUE_DILIGENCE_TYPE",
    p_tag_value: p.formType,
  }),
});
export const save = write<{ body: Record<string, unknown> }>({
  op: "postDynamicFormsApplicationSetup",
  body: (p) => p.body,
  invalidates: ["getDynamicFormsApplicationList"],
});
