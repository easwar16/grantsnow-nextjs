import "server-only";
import { oracle } from "@/server/api/transport";
import type { Operation } from "@/server/api/transport";
import { forget, memo, memoKey } from "./memo";

/**
 * An Oracle read held per session, as the VBCS app holds its app-level data (GrantsNow KB: the shell's startup
 * chains and 9326's caches). The key is the operation, the session and every other header, so two records or
 * modules never share an answer. Use it for data read in more than one place or held app-wide by VBCS, and pair it
 * with `forgetRead` after any write that changes it.
 */
export function cachedRead(
  operation: Operation,
  headers: Record<string, string> & { token: string },
  ttlMs: number,
) {
  const { token, ...rest } = headers;
  const parts = Object.keys(rest)
    .sort()
    .map((k) => `${k}=${rest[k]}`);
  return memo(memoKey(`read:${operation}`, token, ...parts), ttlMs, () =>
    oracle(operation, headers),
  );
}

/** Drops every held answer of `operation` for this session (all records and modules). */
export function forgetRead(operation: Operation, token: string) {
  forget(memoKey(`read:${operation}`, token));
}
