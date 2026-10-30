import "server-only";
import { cache } from "react";
import {
  oracle,
  oracleWrite,
  oracleFileWrite,
  type Operation,
} from "./connection";
import { forget, forgetOperation, memo, operationKey, refresh } from "./cache";
import { inWrite } from "./scope";
import { oracleContext, type IdentityField } from "./context";
import { AppError } from "@/lib/errors";
import { serverConstants } from "@/server/constants";

/**
 * The Oracle API client. Every backend operation is one function defined here with `read` or `write`; services call
 * those functions with plain parameters and never build headers. The client:
 * - sends the session token, plus the identity headers the definition names, from the verified session;
 * - holds reads: the same operation with the same parameters answers from the held copy (once per request by default,
 *   per session for `ttl`), while any changed parameter is a new read;
 * - reads a paged reference list whole (`pages: "all"`), or one listing page by `offset` / `limit` (`pages: "page"`);
 * - sends writes through the writes gate and then forgets the reads they change (`invalidates`).
 */
type Value = string | number | boolean | null | undefined;
type Fields = Record<string, Value>;
type Options = { signal?: AbortSignal; token?: string };
interface Shape<P> {
  op: Operation;
  /** Identity headers taken from the session (the token is always sent). */
  identity?: readonly IdentityField[];
  /** The header the session token goes in: `token` unless the operation names it otherwise; `false` sends none. */
  tokenHeader?: "token" | "p_token" | "P_TOKEN" | false;
  headers?: (p: P) => Fields;
  query?: (p: P) => Fields;
  path?: (p: P) => Record<string, string>;
}
export interface ReadDef<P, R> extends Shape<P> {
  parse?: (body: unknown) => R;
  /** Held per session for this long (ms) while every parameter is unchanged; omitted, it is held for the request. */
  ttl?: number;
  /** Past `ttl`, still answered from the held copy for this long (ms) while one background read refreshes it. */
  stale?: number;
  /** `all`: a reference list the backend pages, read whole. `page`: one listing page (`offset`, `limit` params). */
  pages?: "all" | "page";
}
export interface WriteDef<P, R> extends Shape<P> {
  body?: (p: P) => unknown;
  parse?: (body: unknown) => R;
  /** The reads this write changes; their held answers are dropped for the session once it succeeds. */
  invalidates?: readonly Operation[];
}
export type PageParams = { offset?: number; limit?: number };
export type Page<T = unknown> = { items: T[]; hasMore: boolean };

const strings = (f: Fields = {}) =>
  Object.fromEntries(
    Object.entries(f).flatMap(([k, v]) =>
      v === undefined || v === null ? [] : [[k, String(v)]],
    ),
  );
async function request<P>(def: Shape<P>, params: P, options: Options) {
  const token = options.token ?? (await oracleContext()).token;
  const identity = def.identity?.length
    ? (await oracleContext()).identity
    : undefined;
  const tokenHeader = def.tokenHeader ?? "token";
  const headers: Record<string, string> = {
    ...strings(def.headers?.(params)),
    ...(identity
      ? Object.fromEntries(def.identity!.map((k) => [k, identity[k]]))
      : {}),
    ...(tokenHeader ? { [tokenHeader]: token } : {}),
  };
  const query = def.query
    ? new URLSearchParams(strings(def.query(params)))
    : undefined;
  return { token, tokenHeader, headers, query, path: def.path?.(params) };
}
// The held reads of this request (React scopes `cache` per server request).
const requestReads = cache(() => new Map<string, Promise<unknown>>());
const more = (b: { hasMore?: unknown }) =>
  b.hasMore === true || b.hasMore === "true";
const isPaged = (b: unknown): b is { items: unknown[]; hasMore?: unknown } =>
  typeof b === "object" &&
  b !== null &&
  Array.isArray((b as { items?: unknown }).items);
/** The backend pages a list with p_offset / p_limit and a `hasMore` flag ("true" as a string); read every page. */
async function everyPage(
  send: (query: URLSearchParams) => Promise<unknown>,
  base?: URLSearchParams,
) {
  const at = (offset: number) => {
    const q = new URLSearchParams(base);
    q.set("p_limit", String(serverConstants.paging.rowsPerPage));
    q.set("p_offset", String(offset));
    return send(q);
  };
  const first = await at(0);
  if (!isPaged(first) || !more(first)) return first;
  const items = [...first.items];
  for (let page = 1; page < serverConstants.paging.maxPages; page++) {
    const next = await at(items.length);
    if (!isPaged(next)) break;
    items.push(...next.items);
    if (!more(next) || next.items.length === 0)
      return { ...first, items, hasMore: "false" };
  }
  throw new AppError(
    "CONTRACT",
    "A reference list is larger than this app reads. Contact your administrator.",
  );
}

/** `value`, or a rejection as soon as `signal` aborts (the work behind `value` carries on for others). */
function abortable<T>(value: Promise<T>, signal?: AbortSignal): Promise<T> {
  if (!signal) return value;
  if (signal.aborted) return Promise.reject(signal.reason);
  return new Promise<T>((resolve, reject) => {
    const stop = () => reject(signal.reason);
    signal.addEventListener("abort", stop, { once: true });
    value.then(
      (v) => (signal.removeEventListener("abort", stop), resolve(v)),
      (e) => (signal.removeEventListener("abort", stop), reject(e)),
    );
  });
}
/** One backend read as a function of its parameters. */
export function read<P = void, R = unknown>(def: ReadDef<P, R>) {
  return async (params: P, options: Options = {}): Promise<R> => {
    const req = await request(def, params, options);
    const { token, tokenHeader, headers, path } = req;
    let query = req.query;
    if (def.pages === "page") {
      const { offset = 0, limit = 25 } = params as PageParams;
      query = new URLSearchParams(query);
      query.set("p_offset", String(offset));
      query.set("p_limit", String(limit));
    }
    const read = (signal?: AbortSignal) => {
      if (def.pages !== "all")
        return oracle(def.op, headers, query, signal, path);
      // Each page has its own limit; the whole list gets one too, so up to serverConstants.paging.maxPages slow pages cannot chain.
      const deadline = // A whole list gets the same limit as one call, so a slow page is never cut short by its list.
          AbortSignal.timeout(serverConstants.timeouts.oracle),
        all = signal ? AbortSignal.any([signal, deadline]) : deadline;
      return everyPage((q) => oracle(def.op, headers, q, all, path), query);
    };
    // Every parameter is in the key (the token only as the session prefix), so a changed one is a new read.
    const key =
      operationKey(def.op, token) +
      [
        JSON.stringify(
          Object.entries(headers)
            .filter(([k]) => k !== tokenHeader)
            .sort(),
        ),
        query?.toString() ?? "",
        JSON.stringify(path ?? {}),
      ].join("|");
    // A caller's own abort signal must not be shared with other readers; such a read is never held.
    // A held read is fetched without the caller's signal (other callers share it); the caller only stops waiting.
    const held = def.ttl
      ? abortable(
          inWrite()
            ? refresh(key, def.ttl, () => read(), def.stale)
            : memo(key, def.ttl, () => read(), { staleMs: def.stale }),
          options.signal,
        )
      : options.signal
        ? read(options.signal)
        : (() => {
            const reads = requestReads();
            const hit = reads.get(key);
            if (hit) return hit;
            const value = read();
            reads.set(key, value);
            value.catch(() => reads.delete(key));
            return value;
          })();
    const body = await held;
    if (!def.parse) return body as R;
    try {
      return def.parse(body);
    } catch (e) {
      // A reply that fails its schema is not kept: the next call asks Oracle again, as before the client held raw bodies.
      forget(key);
      requestReads().delete(key);
      throw e;
    }
  };
}
/** One backend write as a function of its parameters; it clears the reads it changes. */
export function write<P = void, R = unknown>(def: WriteDef<P, R>) {
  const run = async (params: P, options: Options = {}): Promise<R> => {
    const { token, headers, query, path } = await request(def, params, options);
    try {
      const body = await oracleWrite(
        def.op,
        headers,
        def.body?.(params),
        options.signal,
        query,
        path,
      );
      return def.parse ? def.parse(body) : (body as R);
    } finally {
      // Also after a failure: a timed-out write may still have committed, so what it changes is read again.
      for (const op of def.invalidates ?? []) forgetOperation(op, token);
      requestReads().clear();
    }
  };
  // What this write changes, so a fixture stand-in for it can drop the same reads (`invalidate`).
  return Object.assign(run, { invalidates: def.invalidates ?? [] });
}
/** An allowlisted write that returns a binary report instead of JSON. */
export function writeFile<P>(def: WriteDef<P, never>) {
  return async (params: P, options: Options = {}) => {
    const { token, headers } = await request(def, params, options);
    try {
      return await oracleFileWrite(
        def.op,
        headers,
        def.body?.(params),
        options.signal,
      );
    } finally {
      for (const op of def.invalidates ?? []) forgetOperation(op, token);
      requestReads().clear();
    }
  };
}
/** Drops the session's held reads of `operations`: for code that changes data without a write function (fixtures). */
export async function invalidate(operations: readonly Operation[]) {
  const { token } = await oracleContext();
  for (const op of operations) forgetOperation(op, token);
  requestReads().clear();
}
/** A listing page's rows and whether another page follows, from the backend's `{ items, hasMore }`. */
export function asPage<T>(body: unknown, item: (row: unknown) => T): Page<T> {
  if (!isPaged(body))
    throw new AppError("CONTRACT", "Oracle returned an invalid list.");
  return { items: body.items.map(item), hasMore: more(body) };
}
