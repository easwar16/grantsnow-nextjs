import "server-only";
import { read, write } from "../client";
import { TTL } from "../cache";

type Body = Record<string, unknown>;
const record = (b: unknown) => b as Body;
const items = (b: unknown) =>
  ((b as Body).items || []) as Record<string, unknown>[];

/** A research-preference option list (legacy UserPreferenceLOV `lov_type`): its labels. */
export const preferenceOptions = read<{ lov: string }, string[]>({
  op: "getSharedUserPreferenceLOV",
  headers: (p) => ({ lov_type: p.lov }),
  ttl: TTL.config,
  parse: (b) =>
    items(b).flatMap((i) => (typeof i.label === "string" ? [i.label] : [])),
});
/** The user's own status and proxies, held for the profile. */
export const personStatus = read<void, Body>({
  op: "getSharedPersonStatus",
  ttl: TTL.config,
  parse: record,
});
/** The same status as Oracle holds it now, for the save that merges over it (never the held copy). */
export const storedPersonStatus = read<void, Body>({
  op: "getSharedPersonStatus",
  parse: record,
});
/** The five profile links (legacy getSharedDigitalPresence2); `pid` is the session's person. */
export const digitalPresence = read<{ personId: string }, Body>({
  op: "getSharedDigitalPresence",
  headers: (p) => ({ pid: p.personId }),
  parse: record,
});
/** WRITES: the profile links; legacy carries the token in the query string, here it goes as the header. */
export const saveDigitalPresence = write<Body>({
  op: "postSharedDigitalPresence",
  body: (p) => p,
});
/** The organisation's own themes (legacy getCustomTheme), as stored; the service maps the usable rows. */
export const customThemes = read<void, unknown>({
  op: "getSharedGetCustomTheme",
  ttl: TTL.config,
});
/** The profile's settings writes; each posts its whole body as built by the account service. */
const settings = (
  op:
    | "postSharedPersonStatus"
    | "postSharedUserPreference"
    | "postSharedDashboardPreferences",
) => write<{ body: unknown }>({ op, body: (p) => p.body });
/** WRITES: the user's status, out-of-office dates and proxies. */
export const savePersonStatus = settings("postSharedPersonStatus");
/** WRITES: the research preferences. */
export const saveUserPreference = settings("postSharedUserPreference");
/** WRITES: the dashboard preferences (theme, accessibility, infolets). */
export const saveDashboardPreferences = settings(
  "postSharedDashboardPreferences",
);
