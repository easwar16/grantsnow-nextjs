import "server-only";
import { AppError } from "@/lib/errors";
import {
  assertWritesEnabled,
  fixtureMode,
} from "@/server/platform/configuration/environment";
/**
 * Object Storage through OIC (UPLOAD_OBJECT / GET_OBJECT / DELETE_OBJECT), the VBCS `ics` connection (GN-Angular D43).
 * Basic credentials live only in server env (OIC_BASE_URL, GN_OIC_USER, GN_OIC_PASSWORD); the session token never
 * goes to OIC. Uploads and deletes are writes: gated by WRITES_ENABLED (D27). Callers build `location` on the server.
 */
export const FLOWS = "ic/api/integration/v1/flows/rest";
// OIC calls take ~10 s on DEV; bounded at a minute.
export const TIMEOUT_MS = 60_000;
// Fixture mode keeps objects in memory so the file flow can be exercised without OIC.
const fixtureStore = new Map<string, { bytes: Uint8Array; type: string }>();
/** OIC base URL and basic credentials from server env; refuses when either is missing or unsafe. */
export function oicSettings() {
  const base = process.env.OIC_BASE_URL,
    user = process.env.GN_OIC_USER,
    password = process.env.GN_OIC_PASSWORD;
  if (!base || !user || !password)
    throw new AppError(
      "UPSTREAM",
      "File storage is not connected in this environment.",
      503,
    );
  const url = new URL(base);
  if (url.protocol !== "https:" || url.username || url.password)
    throw new AppError("UPSTREAM", "File storage is misconfigured.", 503);
  return {
    url,
    auth: `Basic ${Buffer.from(`${user}:${password}`).toString("base64")}`,
  };
}
/** True when the relay can reach OIC (or fixtures stand in for it). */
export function oicConnected() {
  if (fixtureMode()) return true;
  try {
    oicSettings();
    return true;
  } catch {
    return false;
  }
}
function checkLocation(location: string) {
  if (
    location.length === 0 ||
    location.length > 1024 ||
    location.startsWith("/") ||
    location.split("/").some((part) => part === "" || part === "..") ||
    /[\u0000-\u001f]/.test(location)
  )
    throw new AppError("BAD_REQUEST", "Invalid file location.", 400);
  return location;
}
/** Header-safe name: percent-encodes non-Latin-1 only, so Latin-1 names stay byte-identical (owner decision, storageSafeName). */
export function storageSafeName(location: string) {
  return [...location]
    .map((c) => (c.charCodeAt(0) > 0xff ? encodeURIComponent(c) : c))
    .join("");
}
async function call(
  flow: "UPLOAD_OBJECT" | "GET_OBJECT" | "DELETE_OBJECT",
  method: "PUT" | "GET" | "DELETE",
  location: string,
  verb: "stored" | "downloaded" | "deleted",
  body?: Uint8Array,
) {
  const { url, auth } = oicSettings();
  let response: Response;
  try {
    response = await fetch(new URL(`${FLOWS}/${flow}/1.0/objectstorage`, url), {
      method,
      headers: {
        Authorization: auth,
        file_name: storageSafeName(location),
        // OIC answers 415 to anything but octet-stream on upload (verified 2026-10-15).
        ...(body ? { "Content-Type": "application/octet-stream" } : {}),
      },
      ...(body ? { body: body as BodyInit } : {}),
      cache: "no-store",
      redirect: "error",
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch {
    throw new AppError(
      "UPSTREAM",
      `The file couldn't be ${verb} (file storage did not answer).`,
    );
  }
  if (!response.ok)
    throw new AppError(
      "UPSTREAM",
      `The file couldn't be ${verb} (file storage answered ${response.status}).`,
    );
  return response;
}
export async function oicUpload(location: string, bytes: Uint8Array) {
  checkLocation(location);
  if (fixtureMode()) {
    fixtureStore.set(location, {
      bytes,
      type: "application/octet-stream",
    });
    return;
  }
  assertWritesEnabled();
  await call("UPLOAD_OBJECT", "PUT", location, "stored", bytes);
}
// On globalThis: route handlers can load this module as separate instances.
const storing = ((globalThis as { __gnStoring?: Set<string> }).__gnStoring ??=
  new Set());
/**
 * Runs `store` (check the name is free, upload, record) holding `location`: a second upload to the same object while it
 * runs is refused, since the object path is the file name and it would overwrite the first one's bytes.
 * shortcut: held per server process; several app instances need a shared lock (or unique object names).
 */
export async function exclusiveLocation<T>(
  location: string,
  store: () => Promise<T>,
) {
  if (storing.has(location))
    throw new AppError(
      "BAD_REQUEST",
      "A file with this name is already being uploaded",
      409,
    );
  storing.add(location);
  try {
    return await store();
  } finally {
    storing.delete(location);
  }
}
export async function oicDownload(location: string) {
  checkLocation(location);
  if (fixtureMode()) {
    const hit = fixtureStore.get(location);
    if (!hit)
      throw new AppError(
        "UPSTREAM",
        "The file couldn't be downloaded (file storage answered 404).",
      );
    return { bytes: hit.bytes, contentType: hit.type };
  }
  const response = await call("GET_OBJECT", "GET", location, "downloaded");
  const contentType =
    response.headers.get("content-type") ?? "application/octet-stream";
  // An HTML reply is an OIC error page, not the file.
  if (/text\/html/i.test(contentType))
    throw new AppError(
      "UPSTREAM",
      "The file couldn't be downloaded (file storage answered with a page, not the file).",
    );
  return {
    bytes: new Uint8Array(await response.arrayBuffer()),
    contentType,
  };
}
export async function oicDelete(location: string) {
  checkLocation(location);
  if (fixtureMode()) {
    fixtureStore.delete(location);
    return;
  }
  assertWritesEnabled();
  await call("DELETE_OBJECT", "DELETE", location, "deleted");
}
