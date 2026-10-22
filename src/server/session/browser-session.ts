import "server-only";
import { readFile, stat } from "node:fs/promises";
import { resolve } from "node:path";
import { z } from "zod";
import {
  browserSessionMode,
  oracleSettings,
} from "@/server/configuration/environment";
import { oracle } from "@/server/api/transport";
import { mapValidatedIdentity } from "./contracts";
import { AppError } from "@/lib/errors";
const schema = z.object({
  token: z.string().min(1).max(1600),
  capturedAt: z.string().datetime(),
  expiresAt: z.number().finite(),
  baseUrl: z.string().url(),
  appsUrl: z.string().url(),
});
export const DEV_SESSION_LEASE_MS = 60 * 60 * 1000;
export async function capturedBrowserSession() {
  if (!browserSessionMode())
    throw new AppError("FORBIDDEN", "Browser session mode is disabled.", 403);
  const path = resolve(
    /* turbopackIgnore: true */
    process.env.DEV_BROWSER_SESSION_FILE || ".dev-session/session.json",
  );
  let raw;
  try {
    const info = await stat(/* turbopackIgnore: true */ path);
    if (
      info.mode & 0o077 ||
      info.size > 8192 ||
      !info.isFile() ||
      (typeof process.getuid === "function" && info.uid !== process.getuid())
    )
      throw new Error("Invalid session file protection.");
    raw = schema.parse(
      JSON.parse(await readFile(/* turbopackIgnore: true */ path, "utf8")),
    );
  } catch {
    throw new AppError(
      "UNAUTHENTICATED",
      "Capture a DEV browser session into the protected local session file.",
      401,
    );
  }
  const config = oracleSettings();
  if (raw.baseUrl !== config.base.href || raw.appsUrl !== config.apps.href)
    throw new AppError(
      "FORBIDDEN",
      "Captured session destinations differ from approved DEV destinations.",
      403,
    );
  if (raw.expiresAt <= Date.now())
    throw new AppError(
      "EXPIRED",
      "The captured DEV session has expired. Refresh it from Playwright.",
      401,
    );
  return validated(raw.token, raw.expiresAt);
}
/** A token pasted on the login page: the raw token or the VBCS `token` cookie (URL-encoded `{token, expiry_datetime}`). */
export async function pastedBrowserSession(input: string) {
  if (!browserSessionMode())
    throw new AppError("FORBIDDEN", "Browser session mode is disabled.", 403);
  const pasted = parsePastedToken(input);
  if (!pasted)
    throw new AppError(
      "UNAUTHENTICATED",
      "Paste a GrantsNow session token.",
      401,
    );
  // Validate decides whether the token lives; a cookie expiry only bounds the session when it is still ahead.
  const expiry = Date.parse(pasted.expiry ?? "");
  return validated(
    pasted.token,
    expiry > Date.now() ? expiry : Date.now() + 8 * 3600000,
  );
}
export function parsePastedToken(input: string) {
  const raw = input.trim();
  if (raw === "") return null;
  let text = raw;
  try {
    text = decodeURIComponent(raw);
  } catch {
    // Not URL-encoded.
  }
  if (!text.startsWith("{"))
    return /^[\x21-\x7e]{1,1600}$/.test(text)
      ? { token: text, expiry: null }
      : null;
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    return null;
  }
  const cookie = z
    .object({
      token: z.string().min(1).max(1600),
      expiry_datetime: z.string().nullish(),
    })
    .safeParse(json);
  return cookie.success
    ? { token: cookie.data.token, expiry: cookie.data.expiry_datetime || null }
    : null;
}
async function validated(token: string, backendExpiresAt: number) {
  const b = mapValidatedIdentity(await oracle("getSessionValidate", { token }));
  if (b.token !== token)
    throw new AppError(
      "EXPIRED",
      "The DEV token has changed. Copy the current session token again.",
      401,
    );
  return {
    token,
    expiresAt: Math.min(backendExpiresAt, Date.now() + DEV_SESSION_LEASE_MS),
    backendExpiresAt,
    user: b.user,
  };
}
