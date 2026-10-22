import "server-only";
import operations from "./operations.json";
import {
  assertWritesEnabled,
  fixtureMode,
  oracleSettings,
  browserSessionMode,
} from "@/server/configuration/environment";
import { AppError } from "@/lib/errors";
export type Operation = keyof typeof operations;
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
): Promise<unknown> {
  if (!writes(operation))
    throw new AppError("BAD_REQUEST", "Unapproved Oracle write.", 400);
  if (fixtureMode()) return {};
  assertWritesEnabled();
  return send(operation, headers, undefined, signal, undefined, body);
}
async function send(
  operation: Operation,
  headers: Record<string, string>,
  query?: URLSearchParams,
  signal?: AbortSignal,
  pathParams?: Record<string, string>,
  body?: unknown,
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
  const url = new URL(
    path.replace(/^\//, ""),
    op.service === "base" ? config.base : config.apps,
  );
  if (query) url.search = query.toString();
  let response: Response;
  // DEV answers slowly (awardPendingApproval ~27 s, KPI statistics 40–60 s, GrantsNow-Dashboard.md); legacy sets no
  // limit. Bounded anyway: reads 60 s, aggregations 90 s. Each widget's own Suspense boundary keeps Home usable.
  const aggregates: Operation[] = [
    "getSharedGetKpiStatistics",
    "getProposalGetProposalStatistics",
    "getPost_awardsAwardStatistics",
    "getPost_awardsAwardVsCostStatistics",
    "getDynamicFormsApplicationStatistics",
    "getSharedGetOppCategoryStat",
    "getSharedGetTopOppCategoryStat",
    "getSharedGetWidgetParameters",
    "getSharedGetDynamicCharts",
  ];
  const timeout = aggregates.includes(operation) ? 90000 : 60000;
  try {
    response = await fetch(url, {
      method: op.method ?? "GET",
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      headers: {
        ...headers,
        ...(body === undefined ? {} : { "Content-Type": "application/json" }),
        ...(config.authorization
          ? { Authorization: config.authorization }
          : {}),
        Accept: "application/json",
      },
      cache: "no-store",
      redirect: "error",
      signal: signal
        ? AbortSignal.any([signal, AbortSignal.timeout(timeout)])
        : AbortSignal.timeout(timeout),
    });
  } catch (e) {
    devTrace(
      operation,
      e instanceof Error && e.name === "TimeoutError"
        ? `timed out after ${timeout / 1000}s`
        : `network error ${e instanceof Error ? `${e.name} ${String((e.cause as { code?: string } | undefined)?.code ?? "")}` : ""}`,
    );
    throw new AppError("UPSTREAM", "Oracle is unavailable. Please retry.");
  }
  if (!response.ok) devTrace(operation, `HTTP ${response.status}`);
  if (response.status === 401) throw expired();
  if (response.status === 403)
    throw new AppError("FORBIDDEN", "Oracle denied access to this data.", 403);
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
