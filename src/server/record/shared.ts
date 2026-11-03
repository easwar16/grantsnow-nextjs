import "server-only";
import { z, ZodError } from "zod";
import { AppError } from "@/lib/errors";

/** A record id in a URL: a positive integer of at most 15 digits. */
export const recordId = z.string().regex(/^[1-9]\d{0,14}$/);
const text = z.string().nullish();
const pageId = z
  .union([z.number(), z.string().regex(/^\d+$/)])
  .nullish()
  .transform((v) => (v === null || v === undefined ? null : Number(v)));
/** getSecurityUser_roles rows for one record (legacy loadObjectRoles). */
export const recordRoleRows = z.object({
  items: z.array(
    z.object({
      page_id: pageId,
      page_name: z.string(),
      read_access: text.transform((v) => v ?? null),
      edit_access: text,
      delete_access: text,
    }),
  ),
});
/** A secondary read that degrades the page instead of failing it; a dead session still signs out. */
export async function orNull<T>(read: Promise<T>): Promise<T | null> {
  try {
    return await read;
  } catch (e) {
    if (e instanceof AppError && e.status === 401) throw e;
    if (e instanceof AppError || e instanceof ZodError) return null;
    throw e;
  }
}
