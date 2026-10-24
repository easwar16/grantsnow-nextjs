import "server-only";
import { readText } from "@/server/http/body";
import { z, ZodError } from "zod";
import { AppError } from "@/lib/errors";
import {
  eoiDelegationHost,
  eoiHistoryHost,
} from "@/server/modules/opportunities/eoi-record/objects";
import type { HistoryHost } from "./history";
import type { DelegationHost } from "./delegations";
/** The modules hosting the shared History and Delegation panels; a request names only its host and record. */
const HISTORY: Record<string, (id: string) => Promise<HistoryHost>> = {
  eoi: eoiHistoryHost,
};
const DELEGATIONS: Record<string, (id: string) => Promise<DelegationHost>> = {
  eoi: eoiDelegationHost,
};
const record = z.string().regex(/^[1-9]\d{0,14}$/);
function resolve<T>(
  hosts: Record<string, (id: string) => Promise<T>>,
  q: URLSearchParams,
) {
  const host = q.get("host") ?? "",
    id = record.safeParse(q.get("record"));
  if (!Object.hasOwn(hosts, host) || !id.success)
    throw new AppError("BAD_REQUEST", "Invalid record request.", 400);
  return hosts[host](id.data);
}
/** `?host&record` → the resolved history host; anything malformed or unknown is a 400. */
export const historyHost = (q: URLSearchParams) => resolve(HISTORY, q);
/** `?host&record` → the resolved delegations host; anything malformed or unknown is a 400. */
export const delegationHost = (q: URLSearchParams) => resolve(DELEGATIONS, q);
/** A write's JSON body, capped at `max` bytes. */
export async function jsonBody(request: Request, max: number) {
  const text = await readText(request, max);
  return JSON.parse(text) as unknown;
}
/** A malformed body or input as a 400 with `message`; anything else unchanged. */
export const badInput = (e: unknown, message: string) =>
  e instanceof ZodError || e instanceof SyntaxError
    ? new AppError("BAD_REQUEST", message, 400)
    : e;
