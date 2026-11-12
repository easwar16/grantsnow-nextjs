import "server-only";
import { read, write } from "../client";
import { serverConstants } from "@/server/constants";

/**
 * AOI / EOI applications (dynamic-form requests of type OPPORTUNITIES-EOI): the list, one request and its insert /
 * upsert. Bodies come back as read; the record service applies its schemas and contract checks. The record's page
 * rights are `roles.record`; its finalize state and locks are `locks`.
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
  ttl: serverConstants.ttl.access,
  headers: (p) => ({ request_id: p.requestId }),
});
/**
 * WRITES: creates a request for the referenced object, or updates it with `requestId`, with its `attribute_N` values
 * (insertRequest, an upsert since legacy 9284).
 */
export const insertRequest = write<{
  requestId: number | null;
  refObjectId: number;
  refObjectType: string;
  requestType: string;
  attributes: Record<string, string | number | null>;
}>({
  op: "postDynamicFormsInsertRequest",
  body: (p) => ({
    request_id: p.requestId,
    ref_object_id: p.refObjectId,
    ref_object_type: p.refObjectType,
    request_type: p.requestType,
    ...p.attributes,
  }),
  invalidates: [
    "getDynamicFormsAllRequests",
    "getDynamicFormsGetRequestDetails",
  ],
});
