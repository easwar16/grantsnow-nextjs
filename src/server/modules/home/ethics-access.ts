import "server-only";
import { z } from "zod";
import { home } from "@/server/oracle/api";
import { requireModule } from "@/server/platform/permissions";
import { homeAccess } from "./service";
const body = z.object({
  hasAccess: z.union([z.boolean(), z.string()]).nullish(),
});
/** GN-Angular `ethicsAccess$`: true, "true" or "Y" grant; anything else denies. */
export function grantsEthicsAccess(raw: unknown) {
  const parsed = body.parse(raw);
  return (
    parsed.hasAccess === true ||
    parsed.hasAccess === "true" ||
    parsed.hasAccess === "Y"
  );
}
/** Whether this user may open Ethics rows (legacy `/dynamicForms/checkApplApprAccess`), asked once per token. */
export async function ethicsAccess() {
  const { user, session } = await homeAccess();
  requireModule(user, "ETHICS");
  // Held per session; a failed check is not held, so the next click asks Oracle again.
  return grantsEthicsAccess(
    await home.ethicsAccess(undefined, { token: session.token }),
  );
}
