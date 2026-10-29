import { constants } from "@/lib/constants";
/** D37: extend this long before the backend expiry. */
/**
 * Milliseconds until the next extension, or null to schedule nothing: no usable expiry, an expiry already
 * passed, or one that did not move past the previous expiry (an unchanged reply must not loop).
 */
export function renewDelay(
  expiresAt: unknown,
  now: number,
  previous?: number,
): number | null {
  if (typeof expiresAt !== "number" || !Number.isFinite(expiresAt)) return null;
  if (expiresAt <= now) return null;
  if (previous !== undefined && expiresAt <= previous) return null;
  return Math.max(0, expiresAt - constants.timing.sessionRenewLeadMs - now);
}
