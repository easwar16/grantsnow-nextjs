import "server-only";
import { fixtureMode } from "@/server/platform/configuration/environment";
/**
 * DEVELOPMENT FIXTURE ONLY: the EOI create and finalize writes in fixture mode, where writes never reach Oracle.
 * Create always yields request 1005; only that record has a finalizable page (Application, page 2), so the other
 * fixture records keep their Workflow tab.
 */
export const FIXTURE_CREATED_ID = 1005;
const FINALIZABLE_PAGE = { id: 2, name: "OPPORTUNITIES-EOI-APPLICATION" };
// On globalThis: the lock is written by a route handler and read by the record layout, which Next can load as separate module instances.
const store = ((
  globalThis as {
    __gnFixtureLocks?: { locks: Map<string, number>; next: number };
  }
).__gnFixtureLocks ??= {
  locks: new Map(),
  next: 700,
});
const locks = store.locks;
function guard() {
  if (!fixtureMode())
    throw new Error(
      "Fixture EOI writes cannot run outside explicit development mode.",
    );
}
const key = (requestId: unknown, pageId: unknown) =>
  `${Number(requestId)}:${Number(pageId)}`;
export function fixtureInsertRequest() {
  guard();
  return { request_id: FIXTURE_CREATED_ID };
}
export function fixtureFinalizablePages(requestId: unknown) {
  guard();
  return {
    items:
      Number(requestId) === FIXTURE_CREATED_ID
        ? [{ page_name: FINALIZABLE_PAGE.name }]
        : [],
  };
}
export function fixtureLockStatus(requestId: unknown, pageId: unknown) {
  guard();
  const id = locks.get(key(requestId, pageId));
  return id === undefined
    ? { status: "UNLOCK", lock_module_id: null }
    : { status: "FINALIZE", lock_module_id: id };
}
export function fixtureLockedModules(requestId: unknown) {
  guard();
  const prefix = `${Number(requestId)}:`;
  return {
    items: [...locks]
      .filter(([k]) => k.startsWith(prefix))
      .map(([k, id]) => ({ id, page_id: Number(k.slice(prefix.length)) })),
  };
}
/** insertModuleLock: FINALIZE records a lock on the page, UNLOCK removes it. */
export function fixtureModuleLock(body: Record<string, unknown>) {
  guard();
  const k = key(body.proposal_id, body.page_id);
  if (body.status === "FINALIZE") locks.set(k, ++store.next);
  else locks.delete(k);
  return {};
}
