/**
 * App-wide values the browser and the server both use, by category (owner, 2026-10-29). A value used by one file stays
 * beside it; server-only values (Oracle, OIC, cache) are in `@/server/constants`.
 */
export const constants = {
  /** How long the browser waits before it acts on its own. */
  timing: {
    /** A toast dismisses itself after this long unless it persists. */
    toastDismissMs: 5000,
    /** No input for this long opens the idle dialog. */
    idleMs: 30 * 60_000,
    /** Home's announcements advance to the next one after this long. */
    announcementAdvanceMs: 5000,
    /** The session renews this long before it expires. */
    sessionRenewLeadMs: 60_000,
  },
  /** Listing page sizes (each module's legacy page size) and when the next page loads. */
  paging: {
    awards: 10,
    /** The original's fetch size for allRequests (opportunity.service.ts EOI_PAGE_SIZE). */
    eoi: 10,
    opportunities: 25,
    /** Claims listings: oj-list-view's default fetch size (legacy paging transform sends offset / limit). */
    claims: 25,
    /** How many of a year's funds the Summary's visibility check reads (one fund-inquiry page). */
    claimsScan: 500,
    /** Within this many pixels of a list's end, its next page loads (legacy loadMoreOnScroll). */
    loadMorePx: 80,
    /** Home's queues load their next page within this many pixels of the end (legacy). */
    homeLoadMorePx: 48,
  },
  /** How long the browser store treats a held read as fresh before a revisit refreshes it. */
  ttl: {
    /** Reference lists a dialog or panel shares (people, approval groups, Add Stage choices, dropdown options). */
    reference: 5 * 60_000,
    /** Lookups and org units, held for the session as the live app holds them (owner, 2026-10-29). */
    session: 12 * 3600_000,
    /** A dialog's setup read, re-read soon so it opens on current data. */
    setup: 30_000,
    /** Listing pages a revisit shows at once while they refresh. */
    list: 5 * 60_000,
  },
  /** Cookies the app sets. */
  cookies: {
    /** The viewer's IANA time zone, set by the shell, so the server can count calendar days on the viewer's day. */
    timeZone: "gn-tz",
  },
  /** Charts. */
  charts: {
    /** Redwood --oj-palette-dvt-rgb-1…12, in series order. */
    palette: [
      "#245d63",
      "#d7790f",
      "#31a09c",
      "#4e4137",
      "#699e61",
      "#b47282",
      "#83401e",
      "#9e7fcc",
      "#a88e00",
      "#58316e",
      "#5999b5",
      "#317a45",
    ],
  },
  /** Caps on what a control offers. */
  limits: {
    /** People offered to an @mention at most. */
    mentions: 1000,
  },
} as const;
