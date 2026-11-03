import "server-only";
/**
 * VBCS hard-codes these per profile (shell-page.js getApexURL / getSupportURL), so here they are environment
 * configuration. A missing or unsafe value hides the drawer entry. No session token ever goes in these URLs (D25).
 */
const configured = {
  reports: "APEX_REPORTS_URL",
  administration: "APEX_ADMINISTRATION_URL",
  "customer-support": "CUSTOMER_SUPPORT_URL",
} as const;
// The same for every profile in VBCS (navigationHandlerChain.js), so a constant rather than configuration.
const apiDocumentation =
  "https://app.swaggerhub.com/apis-docs/FusionPractices/PublicAPI/1.0.2/";
function safeExternal(value: string | undefined) {
  if (value === undefined || value === "") return undefined;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password
      ? url.href
      : undefined;
  } catch {
    return undefined;
  }
}
export function externalToolUrls(
  env: Record<string, string | undefined> = process.env,
): Record<string, string | undefined> {
  return {
    ...Object.fromEntries(
      Object.entries(configured).map(([id, name]) => [
        id,
        safeExternal(env[name]),
      ]),
    ),
    apidocs: apiDocumentation,
  };
}
