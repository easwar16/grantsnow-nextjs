import { z } from "zod";
import { AppError } from "@/lib/errors";
import { assertBusiness } from "@/server/api/transport";
const id = z.union([z.string().min(1), z.number().int()]).transform(String);
const loginSchema = z.object({
  token: z.string().min(1).max(1600),
  expiry_datetime: z.string(),
  pid: id,
  org_id: id,
  full_name: z.string().min(1),
  org_name: z.string(),
  landing_module: z.string().nullish(),
  module_access: z.array(
    z.object({ module_name: z.string(), is_accessible: z.enum(["Y", "N"]) }),
  ),
});
export function mapValidatedIdentity(raw: unknown) {
  assertBusiness(raw);
  const b = loginSchema.omit({ expiry_datetime: true }).parse(raw);
  return {
    token: b.token,
    user: {
      name: b.full_name,
      organization: b.org_name,
      organizationId: b.org_id,
      personId: b.pid,
      modules: Object.fromEntries(
        b.module_access.map((m) => [m.module_name, m.is_accessible === "Y"]),
      ),
      landing: b.landing_module || "",
    },
  };
}
export function expiry(value: unknown) {
  // Refuse ambiguous timezone-free timestamps until the backend owner confirms semantics.
  if (typeof value !== "string" || !/(Z|[+-]\d{2}:\d{2})$/.test(value))
    throw new AppError(
      "CONTRACT",
      "Oracle session expiry must include its timezone.",
    );
  const n = Date.parse(value);
  if (!Number.isFinite(n) || n <= Date.now())
    throw new AppError(
      "EXPIRED",
      "Your GrantsNow session has expired. Sign in again.",
      401,
    );
  return n;
}
export function mapBootstrap(raw: unknown) {
  assertBusiness(raw);
  const result = loginSchema.safeParse(raw);
  if (!result.success)
    throw new AppError(
      "CONTRACT",
      "Oracle login response is missing required identity or access data.",
    );
  const b = result.data;
  return {
    token: b.token,
    expiresAt: expiry(b.expiry_datetime),
    user: {
      name: b.full_name,
      organization: b.org_name,
      organizationId: b.org_id,
      personId: b.pid,
      modules: Object.fromEntries(
        b.module_access.map((m) => [m.module_name, m.is_accessible === "Y"]),
      ),
      landing: b.landing_module || "",
    },
  };
}
