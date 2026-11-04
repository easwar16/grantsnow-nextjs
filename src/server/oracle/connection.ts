import "server-only";
import operations from "./operations.json";
import {
  assertWritesEnabled,
  fixtureMode,
  oracleSettings,
  browserSessionMode,
} from "@/server/platform/configuration/environment";
import { AppError } from "@/lib/errors";
import { Agent, fetch as poolFetch, type Response } from "undici";
import { serverConstants } from "@/server/constants";
import { dropServiceToken, serviceToken } from "./service-token";
export type Operation = keyof typeof operations;
/**
 * One connection pool for Oracle. Node's default drops an idle connection after 4 s, so most clicks opened new ones,
 * and new connects from a local machine occasionally stall past the 10 s connect limit. Idle connections are kept
 * for 30 s (ORDS's own Keep-Alive hint still caps it), as the browser keeps its own. fetch comes from the same undici
 * so the pool matches it on any Node version.
 */
const pool = new Agent({
  keepAliveTimeout: serverConstants.pool.keepAliveMs,
  keepAliveMaxTimeout: serverConstants.pool.keepAliveMaxMs,
  // undici stops waiting for headers or body after 5 minutes by default; the call's own limit decides.
  headersTimeout: serverConstants.timeouts.oracle,
  bodyTimeout: serverConstants.timeouts.oracle,
});
/** A connect that timed out never reached Oracle, so a read may be sent again once; writes never are. */
const connectTimedOut = (e: unknown) =>
  e instanceof Error &&
  (e.cause as { code?: string } | undefined)?.code ===
    "UND_ERR_CONNECT_TIMEOUT";
export function resolveOperationPath(
  operation: Operation,
  params: Record<string, string> = {},
) {
  const op = operations[operation];
  if (!op)
    throw new AppError("BAD_REQUEST", "Unapproved Oracle operation.", 400);
  const keys = [...op.path.matchAll(/\{([a-z_]+)\}/g)].map((match) => match[1]);
  if (Object.keys(params).some((key) => !keys.includes(key)))
    throw new AppError("BAD_REQUEST", "Unapproved Oracle path parameter.", 400);
  return op.path.replace(/\{([a-z_]+)\}/g, (_, key: string) => {
    const value = params[key];
    if (!value || !/^[1-9]\d{0,14}$/.test(value))
      throw new AppError("BAD_REQUEST", "Invalid Oracle record identity.", 400);
    return value;
  });
}
const BUSINESS_FALLBACK =
  "Oracle could not complete this request. Contact your administrator if it persists.";
// ORDS answers an unknown or timed-out token with this text (sometimes `Context Not Set: N`), not a 401.
const DEAD_SESSION = /^\s*Context Not Set\b/i;
/** Backend error text: plain, single-line, trimmed and capped; empty when absent. */
function backendText(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  if (typeof value !== "string") return "";
  return value
    .replace(/[\x00-\x1f\x7f]+/g, " ")
    .trim()
    .slice(0, 500);
}
/** The failure an ORDS body reports (HTTP 200 included), or null for a success body. */
export function businessError(body: unknown): AppError | null {
  if (typeof body === "string")
    return DEAD_SESSION.test(body) ? expired() : null;
  if (!body || typeof body !== "object" || Array.isArray(body)) return null;
  const b = body as Record<string, unknown>;
  if (
    [b.ERROR_MSG, b.error_msg, b.error_description].some(
      (v) => typeof v === "string" && DEAD_SESSION.test(v),
    )
  )
    return expired();
  const code = backendText(b.error_code),
    description = backendText(b.error_description);
  const failed =
    b.response_msg === "ERROR" ||
    b.response_message === "ERROR" ||
    b.status === "ERROR" ||
    code !== "" ||
    description !== "" ||
    backendText(b.error_msg) !== "" ||
    backendText(b.ERROR_MSG) !== "";
  if (!failed) return null;
  // Owner rule: show `error_code : error_description` + `preventive_action` verbatim; nothing else from the body.
  const summary = [code, description].filter((t) => t !== "").join(" : ");
  return new AppError(
    "BUSINESS",
    summary || BUSINESS_FALLBACK,
    502,
    backendText(b.preventive_action) || undefined,
  );
}
function expired() {
  return new AppError(
    "EXPIRED",
    "Your GrantsNow session has expired. Sign in again.",
    401,
  );
}
export function assertBusiness(body: unknown) {
  const error = businessError(body);
  if (error) throw error;
  if (!body || typeof body !== "object")
    throw new AppError("CONTRACT", "Oracle returned an invalid response.");
  return body as Record<string, unknown>;
}
/** JSON when the body is JSON, otherwise the raw text (some dead-session replies are plain text). */
function parseBody(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}
/** Development only: which operation failed and how (status, business code, timeout); never the token or body. */
function devTrace(operation: Operation, detail: string) {
  if (process.env.APP_ENV === "development")
    console.warn(`[oracle] ${operation}: ${detail}`);
}
const writes = (operation: Operation) =>
  (operations[operation] as { write?: boolean }).write === true;
/** Reads only: an operation that writes (even a GET such as insertRequest) must go through `oracleWrite`. */
export async function oracle(
  operation: Operation,
  headers: Record<string, string> = {},
  query?: URLSearchParams,
  signal?: AbortSignal,
  pathParams?: Record<string, string>,
): Promise<unknown> {
  if (writes(operation))
    throw new AppError("BAD_REQUEST", "Unapproved Oracle read.", 400);
  return send(operation, headers, query, signal, pathParams);
}
/** Every backend write (D27): allowlisted as a write, off unless WRITES_ENABLED; fixtures simulate success. */
export async function oracleWrite(
  operation: Operation,
  headers: Record<string, string> = {},
  body?: unknown,
  signal?: AbortSignal,
  // deletePre_awardLinks takes its id as a query parameter.
  query?: URLSearchParams,
  // postProposalDelegationsDelegation_id takes its id in the path.
  pathParams?: Record<string, string>,
): Promise<unknown> {
  if (!writes(operation))
    throw new AppError("BAD_REQUEST", "Unapproved Oracle write.", 400);
  if (fixtureMode()) {
    // Fixtures decide which simulated writes answer a body; the connection names no operation.
    const { mockOracleWrite } = await import("@/test-support/transport");
    return mockOracleWrite(operation, headers, query, pathParams, body);
  }
  assertWritesEnabled();
  return send(operation, headers, query, signal, pathParams, body);
}
/** A report operation whose successful body is a file, using the same allowlist and write gate. */
export async function oracleFileWrite(
  operation: Operation,
  headers: Record<string, string>,
  body: unknown,
  signal?: AbortSignal,
): Promise<{ bytes: Uint8Array; mime: string; filename: string }> {
  if (operation !== "generateReport" || !writes(operation))
    throw new AppError("BAD_REQUEST", "Unapproved Oracle file operation.", 400);
  if (fixtureMode()) {
    const { mockOracleFile } = await import("@/test-support/transport");
    return mockOracleFile();
  }
  assertWritesEnabled();
  return send(
    operation,
    headers,
    undefined,
    signal,
    undefined,
    body,
    true,
  ) as Promise<{
    bytes: Uint8Array;
    mime: string;
    filename: string;
  }>;
}
async function send(
  operation: Operation,
  headers: Record<string, string>,
  query?: URLSearchParams,
  signal?: AbortSignal,
  pathParams?: Record<string, string>,
  body?: unknown,
  file = false,
): Promise<unknown> {
  if (browserSessionMode() && operation === "getSessionLogin")
    throw new AppError(
      "FORBIDDEN",
      "DEV browser sessions cannot bootstrap another username.",
      403,
    );
  const path = resolveOperationPath(operation, pathParams),
    op = operations[operation] as (typeof operations)[Operation] & {
      method?: string;
    };
  for (const key of Object.keys(headers))
    if (!(op.headers as readonly string[]).includes(key))
      throw new AppError("BAD_REQUEST", "Unapproved Oracle header.", 400);
  if (fixtureMode()) {
    const { mockOracle } = await import("@/test-support/transport");
    return assertBusiness(
      await mockOracle(operation, headers, query, pathParams),
    );
  }
  const config = oracleSettings();
  const root = op.service === "base" ? config.base : config.apps,
    client =
      "oauth" in config
        ? config.oauth?.[op.service === "base" ? "base" : "apps"]
        : undefined;
  const url = new URL(path.replace(/^\//, ""), root);
  if (query) url.search = query.toString();
  let response: Response;
  // DEV answers slowly (Awards org units ~52 s, KPI statistics up to 75 s); legacy sets no limit. Bounded at the
  // owner's maximum, 10 minutes (2026-10-29); each section streams, so a slow call never holds the page.
  const started = performance.now();
  try {
    const authorization = client
      ? `Bearer ${await serviceToken(root, client)}`
      : config.authorization;
    // One deadline for both attempts.
    const read = !writes(operation),
      deadline = signal
        ? AbortSignal.any([
            signal,
            AbortSignal.timeout(serverConstants.timeouts.oracle),
          ])
        : AbortSignal.timeout(serverConstants.timeouts.oracle),
      fetchOnce = () =>
        poolFetch(url, {
          method: op.method ?? "GET",
          ...(body === undefined ? {} : { body: JSON.stringify(body) }),
          headers: {
            ...headers,
            ...(body === undefined
              ? {}
              : { "Content-Type": "application/json" }),
            ...(authorization ? { Authorization: authorization } : {}),
            Accept: file
              ? "application/pdf, application/octet-stream, application/json"
              : "application/json",
          },
          cache: "no-store",
          redirect: "error",
          signal: deadline,
          dispatcher: pool,
        });
    try {
      response = await fetchOnce();
    } catch (e) {
      if (!read || !connectTimedOut(e)) throw e;
      devTrace(operation, "connect timed out; retrying the read once");
      response = await fetchOnce();
    }
  } catch (e) {
    devTrace(
      operation,
      e instanceof Error && e.name === "TimeoutError"
        ? `timed out after ${serverConstants.timeouts.oracle / 1000}s`
        : `network error ${e instanceof Error ? `${e.name} ${String((e.cause as { code?: string } | undefined)?.code ?? "")}` : ""}`,
    );
    // A write that reached Oracle may have committed, so a blind retry could save it twice.
    if (writes(operation) && !connectTimedOut(e))
      throw new AppError(
        "UPSTREAM",
        "Oracle did not answer. The change may have been saved; refresh before trying again.",
      );
    throw new AppError("UPSTREAM", "Oracle is unavailable. Please retry.");
  }
  // Slow calls name themselves in development, so latency is traced to Oracle or to our own waits.
  const took = Math.round(performance.now() - started);
  if (took > 1000) devTrace(operation, `${took} ms`);
  if (!response.ok) devTrace(operation, `HTTP ${response.status}`);
  if (response.status === 401) {
    if (client) dropServiceToken(root, client);
    throw expired();
  }
  if (response.status === 403)
    throw new AppError("FORBIDDEN", "Oracle denied access to this data.", 403);
  if (
    file &&
    response.ok &&
    !response.headers.get("content-type")?.includes("json")
  ) {
    const length = Number(response.headers.get("content-length"));
    if (Number.isFinite(length) && length > 4_000_000)
      throw new AppError("CONTRACT", "Oracle returned an invalid report file.");
    const chunks: Uint8Array[] = [];
    let size = 0;
    for await (const chunk of response.body ?? []) {
      size += chunk.length;
      if (size > 4_000_000)
        throw new AppError(
          "CONTRACT",
          "Oracle returned an invalid report file.",
        );
      chunks.push(chunk);
    }
    const bytes = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.length;
    }
    if (bytes.length === 0 || bytes.length > 4_000_000)
      throw new AppError("CONTRACT", "Oracle returned an invalid report file.");
    const disposition = response.headers.get("content-disposition") ?? "";
    const rawName =
      /filename="?([^";]+)"?/i.exec(disposition)?.[1] ?? "report.pdf";
    const filename = rawName.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 120);
    return {
      bytes,
      mime:
        response.headers.get("content-type")?.split(";")[0] ??
        "application/octet-stream",
      filename,
    };
  }
  let reply: unknown;
  try {
    const text = await response.text();
    // Writes may answer an empty body on success (saveDynamicCharts declares none).
    reply = text.trim() === "" && writes(operation) ? {} : parseBody(text);
  } catch {
    throw new AppError("UPSTREAM", "Oracle is unavailable. Please retry.");
  }
  if (!response.ok)
    throw (
      businessError(reply) ??
      new AppError("UPSTREAM", "Oracle is unavailable. Please retry.")
    );
  const failure = businessError(reply);
  if (failure) devTrace(operation, `${failure.code} ${failure.message}`);
  return assertBusiness(reply);
}
