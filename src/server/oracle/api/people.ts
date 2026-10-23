import "server-only";
import { z } from "zod";
import { read } from "../client";
import { TTL } from "../cache";

const text = z.string().nullish();
const rows = z.object({
  items: z.array(
    z.object({
      person_id: z.coerce.number().int().positive(),
      full_name: text,
      org_unit_name: text,
      email_address: text,
      employee_number: text,
    }),
  ),
});
export type PersonRow = z.infer<typeof rows>["items"][number];
/**
 * Everyone (legacy getPreAwardGetPersonListAllADP), held per session as reference data. The backend pages it (25
 * rows, `hasMore`); legacy kept only the first page, so it is read whole here.
 */
export const all = read<void, PersonRow[]>({
  op: "getPre_awardGetPersonListAll",
  pages: "all",
  ttl: TTL.config,
  parse: (b) => rows.parse(b).items,
});
/**
 * The people of one organisation (legacy getPersonList, `p_org_id` the organisation chosen, not the session's), read
 * whole and held as reference data. The body comes back as read: each caller applies its own row schema.
 */
export const inOrg = read<{ orgId?: string }>({
  op: "getPre_awardGetPersonList",
  headers: (p) => ({ p_org_id: p.orgId }),
  pages: "all",
  ttl: TTL.config,
});
