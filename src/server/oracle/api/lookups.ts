import "server-only";
import { read } from "../client";
import { serverConstants } from "@/server/constants";

/**
 * Lookup and reference lists the app never writes. The live app holds them for the session, and so does this app
 * (`serverConstants.ttl.session`). Several screens read the same list with different row rules,
 * so each returns the body as read and the caller applies its own schema.
 */
/** Lookup codes of one or more types (`lookupTypeCode`, comma-separated as legacy sends it). */
export const codes = read<{ types: string }>({
  op: "getPre_awardGetLookupTypesCodes",
  query: (p) => ({ lookupTypeCode: p.types }),
  ttl: serverConstants.ttl.session,
});
/** The date columns an object type can sort by (getObjectDates). */
export const objectDates = read<{ objectType: string }>({
  op: "getSharedGetObjectDates",
  headers: (p) => ({ p_obj_type: p.objectType }),
  ttl: serverConstants.ttl.session,
});
/**
 * Org units with their depth (legacy fetchOrgUnitsData): a person's (`person_id`), a module's (`p_obj_type`, e.g.
 * AWARD), or with neither the global list.
 */
export const orgUnits = read<{ personId?: string; module?: string }>({
  op: "getPre_awardGetLkpOrgUnitType",
  headers: (p) =>
    p.personId ? { person_id: p.personId } : { p_obj_type: p.module },
  ttl: serverConstants.ttl.session,
});
/** Every sponsor (GetSponsorList). */
export const sponsors = read({
  op: "GetSponsorList",
  ttl: serverConstants.ttl.session,
});
/** Notification recipients of one kind: `ROLE` or `GROUP` (getGroupsAndRoles). */
export const groupsAndRoles = read<{ shareTo: string }>({
  op: "getNotificationsGetGroupsAndRoles",
  ttl: serverConstants.ttl.session,
  headers: (p) => ({ p_share_to: p.shareTo }),
});
