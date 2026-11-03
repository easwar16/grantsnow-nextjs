import "server-only";
/**
 * App-wide server-only values, by category (owner, 2026-10-29). Values the browser also uses are in `@/lib/constants`;
 * a value used by one file stays beside it.
 */
export const serverConstants = {
  /** How long a backend call may take before it is abandoned. */
  timeouts: {
    /** Every Oracle call, retry included, and a whole paged list (owner's maximum, 10 minutes). */
    oracle: 10 * 60_000,
    /** Every OIC call (file storage, integrations); the owner's maximum, 10 minutes. */
    oic: 10 * 60_000,
    /** The chatbot service. */
    chatbot: 60_000,
    /** Settings and chart-preference saves give up after this, as before. */
    save: 15_000,
    /** The identity provider's discovery and token calls. */
    identity: 15_000,
  },
  /** How long the server holds a read (per session, by operation and parameters). */
  ttl: {
    /** Labels, global variables and settings: configuration changed by admins. */
    config: 5 * 60_000,
    /** Lookups and org units, held for the session as the live app holds them (owner, 2026-10-29). Keyed by session,
     * so a new sign-in reads them fresh; a failure is never held. */
    session: 12 * 3600_000,
    /** Roles and grants, and a record's own data during a visit: kept short so a change elsewhere shows quickly. */
    access: 60_000,
    /** Home's slow figures (KPIs, queues, charts): fresh for 3 minutes, then served while a refresh runs. */
    figures: 3 * 60_000,
    /** How long past `figures` a held figure may still be shown while it refreshes. */
    figuresStale: 10 * 60_000,
    /** One session validation per token for this long (D24). */
    validation: 60_000,
    /** Development DNS answers. */
    devDns: 60_000,
  },
  /** Reading a paged backend list in full. */
  paging: {
    rowsPerPage: 500,
    maxPages: 20,
  },
  /** The server's read cache: a bounded LRU by count and by answer size. */
  cache: {
    maxEntries: 2000,
    maxBytes: 64 * 1024 * 1024,
  },
  /** The Oracle connection pool. */
  pool: {
    keepAliveMs: 30_000,
    keepAliveMaxMs: 60_000,
  },
  /** Sessions. */
  session: {
    /** A pasted or captured DEV token is leased for an hour at most. */
    devLeaseMs: 60 * 60_000,
  },
} as const;
