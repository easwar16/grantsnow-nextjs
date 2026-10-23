import "server-only";
import { read } from "../client";
import { TTL } from "../cache";

/** An object's attribute fields (getObjectAttributes); the body comes back as read for the panel's own mapping. */
export const fields = read<{ objectType: string; objectId: string }>({
  op: "getSharedGetObjectAttributes",
  ttl: TTL.config,
  headers: (p) => ({ p_obj_type: p.objectType, p_obj_id: p.objectId }),
});
