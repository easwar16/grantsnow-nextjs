import "server-only";
import { read, write } from "../client";

import { oracleContext } from "../context";
import { serverConstants } from "@/server/constants";

/**
 * A record's dynamic forms (dynForms) and their answers (dynFormResponse). Bodies come back as read: the form service
 * maps them to its allowlisted display model. Record data, so nothing is held past the request.
 */
type Slot = { objectId: string; objectType: string; slot: string };
/** The definitions for a slot; `p_id` / `p_obj_id` are the record, empty for a new application (as the original). */
export const forms = read<Slot>({
  op: "getProposalEthical_dynFormsP_ref_module",
  ttl: serverConstants.ttl.config,
  headers: (p) => ({
    p_id: p.objectId,
    p_obj_id: p.objectId,
    p_obj_type: p.objectType,
    p_ref_module: p.slot,
  }),
});
/** The saved answers; this operation takes the session token only as `P_TOKEN`. */
export const answers = read<{ objectId: string; slot: string }>({
  op: "getProposalEthicaldynFormResponse",
  tokenHeader: "P_TOKEN",
  headers: (p) => ({ P_REF_OBJ_ID: p.objectId, P_REF_MODULE: p.slot }),
});
type Save = { formId: number; objectId: string; slot: string; body: unknown };
const response = write<Save & { sessionToken: string }>({
  op: "postDynamicFormsDynFormResponse",
  headers: (p) => ({
    P_TOKEN: p.sessionToken,
    P_FORM_ID: p.formId,
    P_OBJECT_ID: p.objectId,
    P_OBJECT_TYPE: p.slot,
  }),
  body: (p) => p.body,
});
/** WRITES: the answers; the contract sends `token` and repeats it as `P_TOKEN`, taken from the session here. */
export const save = async (p: Save) =>
  response({ ...p, sessionToken: (await oracleContext()).token });
