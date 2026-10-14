import { AppError } from "@/lib/errors";
import type { UserContext } from "@/features/auth/types";
export function requireModule(user: UserContext, module: string) {
  if (user.modules[module] !== true)
    throw new AppError(
      "FORBIDDEN",
      "You do not have access to this module.",
      403,
    );
}
export function scopeOrganization(
  requested: string | undefined,
  allowed: { id: string }[],
) {
  if (!requested) return undefined;
  if (!allowed.some((o) => o.id === requested))
    throw new AppError(
      "FORBIDDEN",
      "That organization is outside your access scope.",
      403,
    );
  return requested;
}
export function requireRead(
  items: { page_name: string; read_access: string }[],
  page: string,
) {
  if (!items.some((r) => r.page_name === page && r.read_access === "Y"))
    throw new AppError("FORBIDDEN", "Read access has not been granted.", 403);
}
