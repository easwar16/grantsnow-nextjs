import "server-only";
import { z } from "zod";
export function fixtureMode(
  env: Record<string, string | undefined> = process.env,
) {
  if (
    env.FIXTURE_MODE === "true" &&
    (env.NODE_ENV === "production" || env.APP_ENV !== "development")
  )
    throw new Error(
      "Fixture mode is permitted only in development, never production.",
    );
  return env.FIXTURE_MODE === "true";
}
export function browserSessionMode(
  env: Record<string, string | undefined> = process.env,
) {
  if (env.DEV_BROWSER_SESSION !== "true") return false;
  if (
    env.NODE_ENV === "production" ||
    env.APP_ENV !== "development" ||
    env.FIXTURE_MODE === "true"
  )
    throw new Error(
      "Browser session mode is permitted only in non-fixture local development.",
    );
  const origin = new URL(env.APP_ORIGIN || "https://invalid.example");
  if (!["localhost", "127.0.0.1"].includes(origin.hostname))
    throw new Error(
      "Browser session mode requires a loopback application origin.",
    );
  return true;
}
function required(name: string) {
  const value = process.env[name];
  if (!value || value.startsWith("REPLACE_"))
    throw new Error(`Missing configuration: ${name}`);
  return value;
}
export function appOrigin() {
  const url = new URL(required("APP_ORIGIN"));
  if (
    url.pathname !== "/" ||
    url.search ||
    url.hash ||
    url.username ||
    url.password
  )
    throw new Error("APP_ORIGIN must be an origin.");
  if (
    url.protocol !== "https:" &&
    !(
      process.env.NODE_ENV !== "production" &&
      ["127.0.0.1", "localhost"].includes(url.hostname) &&
      url.protocol === "http:"
    )
  )
    throw new Error("APP_ORIGIN requires HTTPS outside local development.");
  return url.origin;
}
export function sessionPassword() {
  return z.string().min(32).parse(required("SESSION_PASSWORD"));
}
export function oidcSettings() {
  if (process.env.IDCS_COMPATIBILITY_CONFIRMED !== "true")
    throw new Error("IDCS tenant compatibility has not been confirmed.");
  const issuer = new URL(required("IDCS_ISSUER"));
  const discoveryUrl = new URL(required("IDCS_DISCOVERY_URL"));
  for (const url of [issuer, discoveryUrl])
    if (
      url.protocol !== "https:" ||
      url.username ||
      url.password ||
      url.search ||
      url.hash
    )
      throw new Error(
        "IDCS issuer and discovery require HTTPS without URL credentials, query or fragment.",
      );
  const clientAuthMethod = z
    .enum(["client_secret_basic", "client_secret_post"])
    .parse(required("IDCS_CLIENT_AUTH_METHOD"));
  const scopes = required("IDCS_SCOPES");
  if (!scopes.split(/\s+/).includes("openid"))
    throw new Error("openid scope is required.");
  return {
    issuer,
    discoveryUrl,
    endpointOrigin: discoveryUrl.origin,
    clientAuthMethod,
    clientId: required("IDCS_CLIENT_ID"),
    clientSecret: required("IDCS_CLIENT_SECRET"),
    scopes,
    usernameClaim: required("IDCS_USERNAME_CLAIM"),
  };
}
export function oracleSettings() {
  const browserSession = browserSessionMode();
  if (!browserSession && process.env.ORDS_TRUST_CONFIRMED !== "true")
    throw new Error("Independent Oracle service trust has not been confirmed.");
  const base = new URL(required("ORDS_BASE_URL")),
    apps = new URL(required("ORDS_APPS_URL"));
  for (const u of [base, apps])
    if (
      u.protocol !== "https:" ||
      !u.pathname.endsWith("/") ||
      u.username ||
      u.password ||
      u.search ||
      u.hash
    )
      throw new Error(
        "Oracle roots require HTTPS, trailing / and no URL credentials.",
      );
  if (browserSession) {
    if (
      !base.pathname.endsWith("/ords/dev_base/") ||
      !apps.pathname.endsWith("/ords/dev/")
    )
      throw new Error(
        "Browser session mode only permits the existing DEV ORDS schemas.",
      );
    return { base, apps, authorization: undefined };
  }
  const mode = required("ORDS_AUTH_MODE");
  let authorization: string;
  if (mode === "basic")
    authorization = `Basic ${Buffer.from(`${required("ORDS_SERVICE_USERNAME")}:${required("ORDS_SERVICE_PASSWORD")}`).toString("base64")}`;
  else if (mode === "bearer")
    authorization = `Bearer ${required("ORDS_SERVICE_BEARER")}`;
  else
    throw new Error(
      "Unsupported Oracle authentication mechanism; obtain an approved adapter.",
    );
  return { base, apps, authorization };
}
export function validateRuntime() {
  z.enum(["development", "staging", "production"]).parse(required("APP_ENV"));
  fixtureMode();
  browserSessionMode();
  appOrigin();
  sessionPassword();
  if (!fixtureMode()) {
    if (!browserSessionMode()) oidcSettings();
    oracleSettings();
  }
}
