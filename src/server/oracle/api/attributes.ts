import "server-only";
import { read } from "../client";
import { serverConstants } from "@/server/constants";

/** An object's attribute fields (getObjectAttributes); the body comes back as read for the panel's own mapping. */
export const fields = read<{ objectType: string; objectId: string }>({
  op: "getSharedGetObjectAttributes",
  ttl: serverConstants.ttl.config,
  headers: (p) => ({ p_obj_type: p.objectType, p_obj_id: p.objectId }),
});
