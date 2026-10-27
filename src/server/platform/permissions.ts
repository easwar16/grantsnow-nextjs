import { AppError } from "@/lib/errors";
import type { UserContext } from "@/shared/auth/types";
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
/** One page's rights on a record (VBCS `current_user.access[page]`). */
export interface PageAccess {
  read: boolean;
  edit: boolean;
  delete: boolean;
}
/** The user's rights on one record (D38): by page name, plus the readable pages with their ids (lock levels). */
export interface ObjectAccess {
  roles: Map<string, PageAccess>;
  pages: { id: number; name: string }[];
}
export interface ObjectRoleRow {
  page_id?: number | null;
  page_name: string;
  read_access: string | null;
  edit_access?: string | null;
  delete_access?: string | null;
}
/**
 * VBCS prepareRoles, fail closed: a right holds only when every row for the page grants it (as requireRead), where
 * the original let the last row win. A readable page with no numeric id has no lock level and is left out of `pages`.
 */
export function objectAccessOf(rows: ObjectRoleRow[]): ObjectAccess {
  const roles = new Map<string, PageAccess>();
  const all = (
    page: string,
    key: "read_access" | "edit_access" | "delete_access",
  ) => rows.filter((r) => r.page_name === page).every((r) => r[key] === "Y");
  for (const name of new Set(rows.map((r) => r.page_name)))
    roles.set(name, {
      read: all(name, "read_access"),
      edit: all(name, "edit_access"),
      delete: all(name, "delete_access"),
    });
  const pages = [...roles]
    .filter(([, a]) => a.read)
    .flatMap(([name]) => {
      const id = rows.find(
        (r) => r.page_name === name && typeof r.page_id === "number",
      )?.page_id;
      return typeof id === "number" ? [{ id, name }] : [];
    });
  return { roles, pages };
}
/** VBCS renderLockedModules: each finalized page's name → its lock id (locks on pages the user cannot read are dropped). */
export function finalizedOf(
  pages: ObjectAccess["pages"],
  locks: { id: number; page_id: number }[],
) {
  const finalized = new Map<string, number>();
  for (const l of locks) {
    const page = pages.find((p) => p.id === l.page_id);
    if (page) finalized.set(page.name, l.id);
  }
  return finalized;
}
/** A user_roles row (getSecurityUser_roles, legacy `dashboard_access[page_name]`). */
export type RoleRow = {
  page_name: string;
  read_access: string | null;
  edit_access?: string | null;
};
/** Role based: every row for the page must grant it; no rows (or no roles read) denies. */
export function pageAccess(roles: RoleRow[] | null, page: string) {
  const rows = (roles ?? []).filter((r) => r.page_name === page);
  return {
    read: rows.length > 0 && rows.every((r) => r.read_access === "Y"),
    edit: rows.length > 0 && rows.every((r) => r.edit_access === "Y"),
  };
}
