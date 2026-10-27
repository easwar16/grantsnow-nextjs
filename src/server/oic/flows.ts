import "server-only";
import operations from "./operations.json";
import { AppError } from "@/lib/errors";
import {
  assertWritesEnabled,
  fixtureMode,
} from "@/server/platform/configuration/environment";
import { businessError } from "@/server/oracle/connection";
import { oracleContext, type IdentityField } from "@/server/oracle/context";
import { FLOWS, TIMEOUT_MS, oicSettings } from "./connection";

/**
 * OIC integration flows (the VBCS `ics` connection) as functions, like the Oracle client: an allowlisted flow, its
 * declared headers only, identity and the session token from the verified session, writes behind WRITES_ENABLED and
 * simulated under fixtures. Object storage keeps its byte-safe functions in connection.ts.
 */
export type Flow = keyof typeof operations;
type Value = string | number | boolean | null | undefined;
type Entry = {
  path: string;
  method: string;
  headers: string[];
  write?: boolean;
  unresolved?: boolean;
};
export interface FlowDef<P> {
  op: Flow;
  identity?: readonly IdentityField[];
  /** The flow takes the GrantsNow session token as its `token` header. */
  token?: boolean;
  headers?: (p: P) => Record<string, Value>;
  query?: (p: P) => Record<string, Value>;
  path?: (p: P) => Record<string, Value>;
  body?: (p: P) => unknown;
}
const strings = (f: Record<string, Value> = {}) =>
  Object.fromEntries(
    Object.entries(f).flatMap(([k, v]) =>
      v === undefined || v === null ? [] : [[k, String(v)]],
    ),
  );
const SEGMENT = /^[A-Za-z0-9._-]{1,200}$/;
export function flow<P = void>(def: FlowDef<P>) {
  return async (
    params: P,
    options: { signal?: AbortSignal } = {},
  ): Promise<unknown> => {
    const op = operations[def.op] as Entry;
    if (op.unresolved)
      throw new AppError(
        "CONTRACT",
        "This integration has no path in the legacy contract, so it cannot be called yet.",
      );
    const ctx =
      def.identity?.length || def.token ? await oracleContext() : undefined;
    const headers: Record<string, string> = {
      ...strings(def.headers?.(params)),
      ...(ctx && def.identity
        ? Object.fromEntries(def.identity.map((k) => [k, ctx.identity[k]]))
        : {}),
      ...(ctx && def.token ? { token: ctx.token } : {}),
    };
    if (Object.keys(headers).some((k) => !op.headers.includes(k)))
      throw new AppError("BAD_REQUEST", "Unapproved OIC header.", 400);
    const values = strings(def.path?.(params));
    const path = op.path.replace(/\{(\w+)\}/g, (_, key: string) => {
      const value = values[key];
      // A dot segment would step out of the flow's path when the URL resolves.
      if (!value || !SEGMENT.test(value) || /^\.{1,2}$/.test(value))
        throw new AppError("BAD_REQUEST", "Invalid integration identity.", 400);
      return encodeURIComponent(value);
    });
    if (op.write) {
      if (fixtureMode()) return {};
      assertWritesEnabled();
    } else if (fixtureMode())
      throw new AppError(
        "UPSTREAM",
        "This integration is not available with development fixtures.",
        503,
      );
    const { url, auth } = oicSettings();
    const target = new URL(`${FLOWS}${path}`, url);
    if (def.query)
      target.search = new URLSearchParams(
        strings(def.query(params)),
      ).toString();
    const body = def.body?.(params);
    let response: Response;
    try {
      response = await fetch(target, {
        method: op.method,
        headers: {
          ...headers,
          Authorization: auth,
          Accept: "application/json",
          ...(body === undefined ? {} : { "Content-Type": "application/json" }),
        },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
        cache: "no-store",
        redirect: "error",
        signal: options.signal
          ? AbortSignal.any([options.signal, AbortSignal.timeout(TIMEOUT_MS)])
          : AbortSignal.timeout(TIMEOUT_MS),
      });
    } catch {
      throw new AppError(
        "UPSTREAM",
        "The integration did not answer. Please retry.",
      );
    }
    const text = await response.text().catch(() => "");
    let reply: unknown = text;
    try {
      reply = text.trim() ? JSON.parse(text) : {};
    } catch {
      // Some flows answer plain text; it is returned as it came.
    }
    if (!response.ok)
      throw (
        businessError(reply) ??
        new AppError("UPSTREAM", `The integration answered ${response.status}.`)
      );
    const failure = businessError(reply);
    if (failure) throw failure;
    return reply;
  };
}
