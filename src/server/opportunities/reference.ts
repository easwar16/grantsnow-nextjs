import "server-only";
import { memo, memoKey, TTL } from "@/server/cache/memo";
import { oracle } from "@/server/api/transport";

/**
 * A reference read this app never writes (lookups, sponsors, people, org units, filter options), shared across the
 * session's requests for `TTL.config`. The key carries the operation, every other header and the query, so two
 * different answers never share an entry; record data, listings and anything the app writes never come here.
 */
export function referenceRead(
  operation: Parameters<typeof oracle>[0],
  headers: { token: string } & Record<string, string>,
  query?: URLSearchParams,
) {
  const { token, ...rest } = headers;
  return memo(
    memoKey(
      `opportunities:${operation}`,
      token,
      JSON.stringify(Object.entries(rest).sort()),
      query?.toString() ?? "",
    ),
    TTL.config,
    () => oracle(operation, headers, query),
  );
}
