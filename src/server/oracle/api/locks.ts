import "server-only";
import { read, write } from "../client";
import { serverConstants } from "@/server/constants";
import { recordStateReads } from "./record-state";

/**
 * Page finalize locks, shared by every record that finalizes pages (proposals, awards, contracts, EOIs): which pages
 * can be finalized, which are, one page's lock, and the write that finalizes or unlocks a page.
 */
/** The record's pages that can be finalized. */
export const finalizablePages = read<{ objectType: string; objectId: string }>({
  op: "getSharedFinalizablePages",
  ttl: serverConstants.ttl.access,
  headers: (p) => ({ p_obj_type: p.objectType, p_obj_id: p.objectId }),
});
/** The record's finalized page locks (`prop_id` is the record id). */
export const lockedModules = read<{ module: string; recordId: string }>({
  op: "getProposalGetLockedModules",
  ttl: serverConstants.ttl.access,
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
/**
 * WRITES: finalizes or unlocks a page; `body` is the lock row built by the record's rules. The record's roles and state
 * are read again after it, as legacy refreshPages does: the backend grants a page (an EOI's Workflow) once its pages
 * are final, and an award's finalized pages come from its details.
 */
export const setLock = write<{ body: unknown }>({
  op: "postProposalInsertModuleLock",
  identity: ["legal_id", "org_id"],
  body: (p) => p.body,
  invalidates: [
    "getProposalGetLockStatus",
    "getProposalGetLockedModules",
    ...recordStateReads,
  ],
});
