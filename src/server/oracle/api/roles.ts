import "server-only";
import { read } from "../client";
import { TTL } from "../cache";

/**
 * The user's page rights on one record (legacy user_roles), shared by every record host and panel. Held as briefly as
 * other grants; the body comes back as read, because each caller applies its own row rules.
 */
export const record = read<{ objectType: string; objectId: string }>({
  op: "getSecurityUser_roles",
  headers: (p) => ({ p_obj_id: p.objectId, p_obj_type: p.objectType }),
  ttl: TTL.access,
});
