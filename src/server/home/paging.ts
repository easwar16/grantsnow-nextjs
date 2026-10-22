import "server-only";
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
