import { AppError } from "./errors";
import { placeholderModules } from "./unavailable-modules";
import { awardTabs } from "@/shared/awards/award-record";
export function safeReturn(value: unknown) {
  if (typeof value !== "string" || /[\\\r\n]/.test(value)) return "/home";
  try {
    const url = new URL(value, "https://local.invalid");
    if (
      !value.startsWith("/") ||
      url.origin !== "https://local.invalid" ||
      !(
        [
          "/home",
          "/proposals",
          "/contracts",
          "/contracts/new",
          "/awards",
          "/opportunities",
          "/opportunities/eoi",
          "/opportunities/analytics",
        ].includes(url.pathname) ||
        placeholderModules.some((m) => url.pathname === `/modules/${m.id}`) ||
        /^\/opportunities\/eoi\/[1-9]\d{0,14}\/(summary|application|attachments|approvals|delegation|history|dynamic-form-[1-5])$/.test(
          url.pathname,
        ) ||
        // A new application (Apply) and More Info's detail page.
        /^\/opportunities\/eoi\/new\/[1-9]\d{0,14}\/(summary|application)$/.test(
          url.pathname,
        ) ||
        /^\/opportunities\/[1-9]\d{0,14}$/.test(url.pathname) ||
        new RegExp(`^/awards/[1-9]\\d{0,14}/(${awardTabs.join("|")})$`).test(
          url.pathname,
        ) ||
        /^\/proposals\/(PROPOSAL|OUTLINE_PROPOSAL|SUB_PROPOSAL|EXTENSION_PROPOSAL)\/[1-9]\d{0,14}$/.test(
          url.pathname,
        ) ||
        /^\/contracts\/[1-9]\d{0,14}(?:\/(?:workflow|history|delegation|signers))?$/.test(
          url.pathname,
        )
      )
    )
      return "/home";
    return url.pathname + url.search;
  } catch {
    return "/home";
  }
}
/** A configured image address (legacy `APPLICATION_LOGO_URL`): https, or a path on this origin; anything else is dropped. */
export function safeImageUrl(value: unknown) {
  if (typeof value !== "string" || value.trim() === "") return undefined;
  if (/^\/(?![/\\])/.test(value)) return value;
  try {
    return new URL(value).protocol === "https:" ? value : undefined;
  } catch {
    return undefined;
  }
}
/** A backend link (opportunity page, sponsor site, logo): http(s) with no credentials, else dropped. */
export function safeUrl(value: string | null | undefined) {
  if (!value) return undefined;
  try {
    const url = new URL(value);
    return ["https:", "http:"].includes(url.protocol) &&
      !url.username &&
      !url.password
      ? url.href
      : undefined;
  } catch {
    return undefined;
  }
}
export function trustedUsername(
  claims: Record<string, unknown>,
  claim: string,
) {
  const value = claims[claim];
  if (
    typeof claims.sub !== "string" ||
    !claims.sub ||
    typeof value !== "string" ||
    !value.trim() ||
    value.length > 254 ||
    /[\r\n\x00-\x1f]/.test(value)
  )
    throw new AppError(
      "UNAUTHENTICATED",
      "The verified identity has no approved GrantsNow username.",
      401,
    );
  return value;
}
export function sameOrigin(request: Request, origin: string) {
  if (request.headers.get("origin") !== origin)
    throw new AppError("FORBIDDEN", "Cross-origin session action denied.", 403);
}
