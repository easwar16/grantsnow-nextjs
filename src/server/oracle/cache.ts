import "server-only";
import { createHash } from "node:crypto";
import { LRUCache } from "lru-cache";

/**
 * The one server cache: short-lived and per session. The Oracle client holds reads here by operation and parameters
 * (see client.ts); `memo` is also used directly for values derived from several reads. Concurrent callers share one
 * in-flight request, a failure is never reused, and entries expire after `ttlMs`, so a change made elsewhere shows
 * within that window. Keys always include the session (hashed), so nothing personal is shared between users.
 */
type Entry = {
  stale: number;
  at: number;
  fresh: number;
  value: Promise<unknown>;
  refreshing?: boolean;
};
// A bounded LRU: the least recently used entries go first, and each entry expires at its own TTL (plus stale window).
// On globalThis: route handlers (writes) and pages (reads) can load this module as separate instances, and a write
// must clear what the pages hold.
const store = ((
  globalThis as { __gnOracleCache?: LRUCache<string, Entry> }
).__gnOracleCache ??= new LRUCache<string, Entry>({ max: 2000 }));

/** One key per session and purpose; the token itself is never kept. */
export function memoKey(
  name: string,
  token: string,
  ...parts: (string | number)[]
) {
  const session = createHash("sha256").update(token).digest("hex").slice(0, 32);
  return [name, session, ...parts].join("|");
}

/**
 * The held answer for `key`, or `load()`'s. With `staleMs`, an entry older than `ttlMs` but within the stale window is
 * answered at once while one background read refreshes it (stale-while-revalidate); it is never served past the window.
 */
export function memo<T>(
  key: string,
  ttlMs: number,
  load: () => Promise<T>,
  { staleMs = 0 }: { staleMs?: number } = {},
): Promise<T> {
  const now = Date.now(),
    held = store.get(key),
    // Freshness and the stale window are judged here, on one clock; the LRU's own TTL only reclaims memory.
    hit = held && now - held.at < held.fresh + held.stale ? held : undefined;
  if (hit && now - hit.at < hit.fresh) return hit.value as Promise<T>;
  if (hit && staleMs) {
    if (!hit.refreshing) {
      hit.refreshing = true;
      const next = load();
      next.then(
        () =>
          store.set(
            key,
            { at: Date.now(), fresh: ttlMs, stale: staleMs, value: next },
            { ttl: ttlMs + staleMs },
          ),
        // A failed refresh keeps the held answer until its window ends; the next caller tries again.
        () => (hit.refreshing = false),
      );
    }
    return hit.value as Promise<T>;
  }
  const value = load();
  store.set(
    key,
    { at: now, fresh: ttlMs, stale: staleMs, value },
    { ttl: ttlMs + staleMs },
  );
  value.catch(() => {
    if (store.peek(key)?.value === value) store.delete(key);
  });
  return value;
}

/** Reads now, whatever is held, and holds the fresh answer for the next caller (a failure keeps nothing). */
export function refresh<T>(
  key: string,
  ttlMs: number,
  load: () => Promise<T>,
  staleMs = 0,
): Promise<T> {
  store.delete(key);
  return memo(key, ttlMs, load, { staleMs });
}

/** Drops entries whose key starts with `prefix` (e.g. after a write that changes that data, or on sign-out). */
export function forget(prefix: string) {
  // Collected first: the LRU's iterator is not safe to delete from as it goes.
  for (const k of [...store.keys()].filter((k) => k.startsWith(prefix)))
    store.delete(k);
}

/** The key prefix of one operation's held reads for a session: what a write clears. */
export const operationKey = (operation: string, token: string) =>
  memoKey(`oracle:${operation}`, token) + "|";
/** Drops every held read of `operation` for this session (all records, modules and pages). */
export function forgetOperation(operation: string, token: string) {
  forget(operationKey(operation, token));
}

/** TTLs by how often the data can change underneath us. */
export const TTL = {
  /** Labels, lookups, global variables: configuration changed by admins. */
  config: 5 * 60_000,
  /** Roles and grants, and a record's own data during a visit: kept short so a change elsewhere shows quickly. */
  access: 60_000,
  /** Home's slow figures (KPIs, queues, charts): fresh for 3 minutes, then served while a refresh runs. */
  figures: 3 * 60_000,
  /** How long past `figures` a held figure may still be shown while it refreshes. */
  figuresStale: 10 * 60_000,
} as const;
