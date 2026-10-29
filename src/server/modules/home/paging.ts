import "server-only";
import { serverFunctions } from "@/server/functions";

/** Owner rule (GN-Dashboard): queues load 25 rows per scroll page, up to 100, as legacy loadMoreOnScroll max-count. */
export const QUEUE_PAGE = 25;
export const QUEUE_CAP = 100;
/** Legacy SDP paginate transform (services/transforms.js): p_offset / p_limit for every non-claims read. */
export function pageQuery(offset: number, limit: number) {
  return new URLSearchParams({
    p_offset: String(offset),
    p_limit: String(limit),
  });
}
/** Pages read at once once the total is known (DEV answers each in 1–7 s; more would crowd ORDS). */
export const PAGE_CONCURRENCY = 4;
/**
 * Every row of a p_offset-paged read, in order. The first page comes alone; when it reports `total_count`, the
 * pages up to that total are read `PAGE_CONCURRENCY` at a time. `hasMore` is unreliable, so a full page always means
 * there may be more: reading then continues one page at a time, and stops at the first short page.
 */
export async function pagedRows<T>(
  read: (offset: number) => Promise<{ items: T[]; total_count?: number }>,
  size: number,
  /** Each page in order, before its rows are kept (e.g. to refuse a repeated page). */
  check: (items: T[]) => void,
  /** Rows beyond which a still-full read is an error, never a partial result. */
  cap: number,
  tooMany: () => Error,
): Promise<T[]> {
  const all: T[] = [];
  // Keeps one page; true when it was full, so another may follow.
  const keep = (items: T[]) => {
    check(items);
    all.push(...items);
    if (items.length !== size) return false;
    if (all.length >= cap) throw tooMany();
    return true;
  };
  const first = await read(0);
  if (!keep(first.items)) return all;
  let offset = size;
  const total = first.total_count;
  if (typeof total === "number" && Number.isSafeInteger(total)) {
    const offsets: number[] = [];
    for (let o = size; o < Math.min(total, cap); o += size) offsets.push(o);
    const pages = await serverFunctions.async.bounded(
      offsets.map((o) => () => read(o)),
      PAGE_CONCURRENCY,
    );
    for (const page of pages) {
      if (!keep(page.items)) return all;
      offset += size;
    }
  }
  for (; ; offset += size) if (!keep((await read(offset)).items)) return all;
}
