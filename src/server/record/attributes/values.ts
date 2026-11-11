import "server-only";
import { z } from "zod";

const NAME = /^attribute_\d{1,2}$/;
/** A record's `attribute_N` values with a value (legacy getAttributeValues), for the panel's `initial`. */
export const recordAttributeValues = (raw: Record<string, unknown>) =>
  Object.fromEntries(
    Object.entries(raw).flatMap(([k, v]) =>
      NAME.test(k) && v !== null && v !== undefined && v !== ""
        ? [[k, String(v)]]
        : [],
    ),
  );
/** The panel's `values()` as a host's save body takes them: `attribute_N` keys only. */
export const attributeInput = z
  .record(
    z.string().regex(NAME),
    z.union([z.string().max(4000), z.number(), z.null()]),
  )
  .default({});
