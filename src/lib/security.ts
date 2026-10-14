import { AppError } from "./errors";
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
          "/opportunities",
          "/opportunities/eoi",
          "/opportunities/analytics",
          "/opportunities/register",
        ].includes(url.pathname) ||
        /^\/opportunities\/eoi\/[1-9]\d{0,14}\/(summary|application|attachments|approvals|delegation|history|dynamic-form-[1-5])$/.test(
          url.pathname,
        ) ||
        /^\/proposals\/(PROPOSAL|OUTLINE_PROPOSAL|SUB_PROPOSAL|EXTENSION_PROPOSAL)\/[1-9]\d{0,14}$/.test(
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
