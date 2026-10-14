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
  const b = mapValidatedIdentity(
    await oracle("getSessionValidate", { token: raw.token }),
  );
  if (b.token !== raw.token)
    throw new AppError(
      "EXPIRED",
      "The DEV token has changed. Capture the current browser session again.",
      401,
    );
  return {
    token: raw.token,
    expiresAt: Math.min(raw.expiresAt, Date.now() + DEV_SESSION_LEASE_MS),
    backendExpiresAt: raw.expiresAt,
    user: b.user,
  };
}
