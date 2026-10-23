import "server-only";
import { read, write } from "../client";
import { TTL } from "../cache";

/**
 * AOI / EOI applications (dynamic-form requests of type OPPORTUNITIES-EOI): the list, one request, its finalize
 * state and locks, and the two writes (insertRequest, insertModuleLock). Bodies come back as read; the record service
 * applies its schemas and contract checks. The record's page rights are `roles.record`.
 */
/** One page of allRequests; `query` is the page, clause and sort exactly as the list's query builder makes them. */
export const list = read<{ module: string; query: Record<string, string> }>({
  op: "getDynamicFormsAllRequests",
  headers: (p) => ({ p_module_name: p.module }),
  query: (p) => p.query,
});
/** One request (getRequestDetails). */
export const details = read<{ requestId: string }>({
  op: "getDynamicFormsGetRequestDetails",
  ttl: TTL.access,
  headers: (p) => ({ request_id: p.requestId }),
});
/** The record's pages that can be finalized. */
export const finalizablePages = read<{ objectType: string; objectId: string }>({
  op: "getSharedFinalizablePages",
  ttl: TTL.access,
  headers: (p) => ({ p_obj_type: p.objectType, p_obj_id: p.objectId }),
});
/** The record's finalized page locks (`prop_id` is the request id). */
export const lockedModules = read<{ module: string; recordId: string }>({
  op: "getProposalGetLockedModules",
  ttl: TTL.access,
  headers: (p) => ({ module_name: p.module }),
  query: (p) => ({ prop_id: p.recordId }),
});
/** One page's lock (`lock_level` is the page id). */
export const lockStatus = read<{
  recordId: string;
  pageId: number;
  module: string;
}>({
  op: "getProposalGetLockStatus",
  headers: (p) => ({
    prop_id: p.recordId,
    lock_level: p.pageId,
    module_name: p.module,
  }),
});
/** WRITES: finalizes or unlocks a page; `body` is the lock row built by the record's rules. */
export const setLock = write<{ body: unknown }>({
  op: "postProposalInsertModuleLock",
  identity: ["legal_id", "org_id"],
  body: (p) => p.body,
  invalidates: ["getProposalGetLockStatus", "getProposalGetLockedModules"],
});
/** WRITES: creates a request for the referenced object (insertRequest, a GET that inserts). */
export const insertRequest = write<{
  refObjectId: number;
  refObjectType: string;
  requestType: string;
}>({
  op: "getDynamicFormsInsertRequest",
  headers: (p) => ({
    P_REF_OBJECT_ID: p.refObjectId,
    P_REF_OBJECT_TYPE: p.refObjectType,
    P_REQUEST_TYPE: p.requestType,
  }),
  invalidates: ["getDynamicFormsAllRequests"],
});
