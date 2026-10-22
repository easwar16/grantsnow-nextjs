import "server-only";
import { createHash } from "node:crypto";
import { z } from "zod";
import { oracle } from "@/server/api/transport";
import { requireModule } from "@/server/permissions/policy";
import { homeAccess } from "./service";
// Legacy asks once per session; the answer is kept per token for the token's working life, never across users.
const ACCESS_TTL_MS = 8 * 60 * 60_000;
const answers = new Map<string, { at: number; allowed: Promise<boolean> }>();
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
export async function ethicsAccess(now = Date.now()) {
  const { user, session } = await homeAccess();
  requireModule(user, "ETHICS");
  const key = createHash("sha256").update(session.token).digest("hex");
  for (const [k, v] of answers)
    if (now - v.at > ACCESS_TTL_MS) answers.delete(k);
  const hit = answers.get(key);
  if (hit) return hit.allowed;
  const allowed = oracle("getDynamicFormsCheckApplApprAccess", {
    token: session.token,
  }).then(grantsEthicsAccess);
  answers.set(key, { at: now, allowed });
  // A failed check is not remembered: the next click asks Oracle again.
  allowed.catch(() => answers.delete(key));
  return allowed;
}
