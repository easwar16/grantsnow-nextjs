import "server-only";
import { createHash } from "node:crypto";

/**
 * Short-lived, per-session memo for reference data that Oracle answers slowly and this app never writes (labels,
 * global variables, lookups, roles, org lists). Concurrent callers share one in-flight request, a failure is never
 * reused, and entries expire after `ttlMs`, so a change made elsewhere shows within that window. Keys always include
 * the session (hashed), so nothing personal is shared between users. React `cache()` still dedupes within a request;
 * this spans requests.
 */
const MAX_ENTRIES = 2000;
const store = new Map<
  string,
  { at: number; ttl: number; value: Promise<unknown> }
>();

/** One key per session and purpose; the token itself is never kept. */
export function memoKey(
  name: string,
  token: string,
  ...parts: (string | number)[]
) {
  const session = createHash("sha256").update(token).digest("hex").slice(0, 32);
  return [name, session, ...parts].join("|");
}

export function memo<T>(
  key: string,
  ttlMs: number,
  load: () => Promise<T>,
): Promise<T> {
  const now = Date.now(),
    hit = store.get(key);
  if (hit && now - hit.at < hit.ttl) return hit.value as Promise<T>;
  if (store.size >= MAX_ENTRIES)
    for (const [k, v] of store) if (now - v.at >= v.ttl) store.delete(k);
  const value = load();
  store.set(key, { at: now, ttl: ttlMs, value });
  value.catch(() => {
    if (store.get(key)?.value === value) store.delete(key);
  });
  return value;
}

/** Drops entries whose key starts with `prefix` (e.g. after a write that changes that data, or on sign-out). */
export function forget(prefix: string) {
  for (const k of store.keys()) if (k.startsWith(prefix)) store.delete(k);
}

/** TTLs by how often the data can change underneath us. */
export const TTL = {
  /** Labels, lookups, global variables: configuration changed by admins. */
  config: 5 * 60_000,
  /** Roles and grants: kept short so a revoked grant stops working quickly. */
  access: 60_000,
} as const;
