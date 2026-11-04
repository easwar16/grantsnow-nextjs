"use client";
import type { MentionPerson } from "@/lib/mentions";
import type {
  AuditEvent,
  AuditView,
  CommentsView,
  ObjectPanelProps,
} from "@/features/record/objects/panel-types";
import type { Choice, DelegatedPage } from "@/features/record/objects/types";
import type { MultiSelectOption } from "@/components/ui/multi-select";
import { appStore } from "@/lib/store/app-store";
import { del, post, put } from "../http";
import { endpoint } from "../hooks";

/** A record page's shared panels: the record and the page, never identity or scope (the server has the session). */
export type PanelRecord = Pick<
  ObjectPanelProps,
  "objectType" | "objectId" | "page" | "sec"
>;
const panel = (p: PanelRecord) => ({
  type: p.objectType,
  id: p.objectId,
  page: p.page,
  ...(p.sec ? { sec: p.sec } : {}),
});
/** The page's comment thread. */
export const comments = endpoint<PanelRecord, CommentsView>((p) => ({
  path: "/objects/comments",
  query: panel(p),
}));
/** The @mention feed: reference data, as legacy loads it once per session. */
export const mentionPeople = endpoint<PanelRecord, MentionPerson[]>(
  (p) => ({ path: "/objects/comments/people", query: panel(p) }),
  { ttl: 10 * 60_000 },
);
export const addComment = (p: PanelRecord, html: string) =>
  post("/objects/comments", { comments: html }, panel(p));
export const updateComment = (p: PanelRecord, id: number, html: string) =>
  put(`/objects/comments/${id}`, { comments: html }, panel(p));
export const deleteComment = (p: PanelRecord, id: number) =>
  del(`/objects/comments/${id}`, panel(p));

/** The page's audit trail for one event tab (`ALL` reads every event). */
export const audit = endpoint<PanelRecord & { event: AuditEvent }, AuditView>(
  (p) => ({ path: "/objects/audit", query: { ...panel(p), event: p.event } }),
);

/** Which record a History or Delegation panel belongs to: the host module and its record id, never identity. */
export interface ObjectHost {
  host: string;
  record: string;
}
const host = (h: ObjectHost) => ({ host: h.host, record: h.record });
/** The statuses Add Status may set now; read when the dialog opens. */
export const nextStatuses = endpoint<ObjectHost, { statuses: Choice[] }>(
  (h) => ({ path: "/objects/history", query: host(h) }),
);
export const addStatus = (
  h: ObjectHost,
  body: { status: string; comments: string; responseDate?: string },
) => post("/objects/history", body, host(h));

/** The Add Delegation picker's people: reference data, held as VBCS holds its app-level person lists. */
export const delegationPeople = endpoint<ObjectHost, MultiSelectOption[]>(
  (h) => ({ path: "/objects/delegations/people", query: host(h) }),
  { ttl: 5 * 60_000 },
);
/** The picker's people for a dialog about to open: held data at once, otherwise one shared request. */
export function loadDelegationPeople(h: ObjectHost) {
  const store = appStore(),
    ep = delegationPeople;
  return store
    ? store.load<MultiSelectOption[]>(ep.key(h), () => ep.load(h), {
        ttl: ep.ttl,
      })
    : ep.load(h);
}
type Access = Pick<DelegatedPage, "read" | "edit" | "delete">;
export const submitDelegation = (
  h: ObjectHost,
  body: {
    users: string[];
    start: string;
    end: string;
    pages: string[];
  } & Access,
) => post("/objects/delegations", body, host(h));
export const setDelegationAccess = (
  h: ObjectHost,
  id: string,
  type: keyof Access,
  value: boolean,
) => post<Access>(`/objects/delegations/${id}`, { type, value }, host(h));
/** Removes one delegated page. */
export const removeDelegatedPage = (h: ObjectHost, id: string) =>
  del(`/objects/delegations/${id}`, host(h));
/** Removes a delegate and every page delegated to them. */
export const removeDelegate = (h: ObjectHost, person: string) =>
  del("/objects/delegations", { ...host(h), person });
