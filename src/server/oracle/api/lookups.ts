import "server-only";
import { read } from "../client";
import { TTL } from "../cache";

/**
 * Lookup and reference lists the app never writes. Those the live app holds for the session (lookups, object dates,
 * org units) keep a TTL; the rest are read when asked. Several screens read the same list with different row rules,
 * so each returns the body as read and the caller applies its own schema.
 */
/** Lookup codes of one or more types (`lookupTypeCode`, comma-separated as legacy sends it). */
export const codes = read<{ types: string }>({
  op: "getPre_awardGetLookupTypesCodes",
  query: (p) => ({ lookupTypeCode: p.types }),
  ttl: TTL.config,
});
/** The date columns an object type can sort by (getObjectDates). */
export const objectDates = read<{ objectType: string }>({
  op: "getSharedGetObjectDates",
  headers: (p) => ({ p_obj_type: p.objectType }),
  ttl: TTL.config,
});
/** A person's org units with their depth (legacy fetchOrgUnitsData). */
export const orgUnits = read<{ personId: string }>({
  op: "getPre_awardGetLkpOrgUnitType",
  headers: (p) => ({ person_id: p.personId }),
  ttl: TTL.config,
});
/** Every sponsor (GetSponsorList). */
export const sponsors = read({
  op: "GetSponsorList",
  ttl: TTL.config,
});
/** Notification recipients of one kind: `ROLE` or `GROUP` (getGroupsAndRoles). */
export const groupsAndRoles = read<{ shareTo: string }>({
  op: "getNotificationsGetGroupsAndRoles",
  ttl: TTL.config,
  headers: (p) => ({ p_share_to: p.shareTo }),
});
