import { AppError } from "@/lib/errors";
import type { UserContext } from "@/features/auth/types";
import {
  navigationDefinitions,
  type NavDefinition,
} from "@/lib/unavailable-modules";
const groupOf = new Map(
  navigationDefinitions.flatMap((item) =>
    (item.children ?? []).map((child) => [child.id, item.id] as const),
  ),
);
const groups = new Set(
  navigationDefinitions.filter((i) => i.children).map((i) => i.id),
);
/**
 * The VBCS drawer gate (getNavigationItems / getDeepLinkItems): Home, Announcements and the header pages always; a group needs
 * its own id and each child its own id too; any other item needs its id upper-cased. Missing access fails closed
 * (VBCS showed everything when access was unknown).
 */
export function drawerAccess(modules: Record<string, boolean>, id: string) {
  // The header's Help and the bell's View all are always there, as legacy globalHeadersADP / the bell.
  if (
    [
      "home",
      "announcements",
      "tutorials",
      "announcements-notifications",
    ].includes(id)
  )
    return true;
  const group = groupOf.get(id);
  if (group) return modules[group] === true && modules[id] === true;
  if (groups.has(id)) return modules[id] === true;
  return modules[id.toUpperCase()] === true;
}
export function visibleNavigation(
  modules: Record<string, boolean>,
  items: NavDefinition[] = navigationDefinitions,
): NavDefinition[] {
  return items.flatMap((item) =>
    drawerAccess(modules, item.id)
      ? [
          item.children
            ? {
                ...item,
                children: item.children.filter((c) =>
                  drawerAccess(modules, c.id),
                ),
              }
            : item,
        ]
      : [],
  );
}
/** A page reached from the drawer needs the same grant that shows its entry. */
export function requireDrawerAccess(user: UserContext, id: string) {
  if (!drawerAccess(user.modules, id))
    throw new AppError(
      "FORBIDDEN",
      "You do not have access to this module.",
      403,
    );
}
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
/** Object read: every role row for the page must grant it (as proposals objectAccess); none or any 'N' denies. */
export function requireRead(
  items: { page_name: string; read_access: string | null }[],
  page: string,
) {
  const rows = items.filter((r) => r.page_name === page);
  if (rows.length === 0 || rows.some((r) => r.read_access !== "Y"))
    throw new AppError("FORBIDDEN", "Read access has not been granted.", 403);
}
