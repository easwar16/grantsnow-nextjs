import "server-only";
import { cache } from "react";
import { forgetOperation } from "@/server/oracle/cache";
import { z } from "zod";
import { configuration, lookups } from "@/server/oracle/api";
import { authenticate } from "@/server/identity/session/service";
/** Every write to the user's dashboard preferences calls this once it settles, so the next read asks Oracle. */
export function forgetDashboardConfiguration(token: string) {
  forgetOperation("getSharedDashboardPreferences", token);
}
/** The shell, Home and its widgets all read this; saves through the drawer and dimension dialog forget it. */
export const dashboardConfiguration = cache(() =>
  configuration.dashboardPreferences(),
);
export const dashboardRoles = cache(() => configuration.dashboardRoles());
/** A bad or missing depth degrades to no indentation rather than failing the org list. */
export function orgDepth(raw: unknown) {
  const depth = Number(raw);
  return raw !== null && raw !== "" && Number.isInteger(depth) && depth > 0
    ? Math.min(depth, 20)
    : 0;
}
const orgRows = z.object({
  items: z.array(
    z.object({
      org_unit_id: z.union([z.string(), z.number()]),
      org_unit_name: z.string(),
      // Tree depth of the org (legacy NUM_SPACES); the picker indents by it.
      num_spaces: z.unknown(),
    }),
  ),
});
/** Org-unit rows (getLkpOrgUnitType, either column case) as id, name and tree depth. */
export function orgUnitRows(raw: unknown) {
  const rows = (raw as { items?: Record<string, unknown>[] }).items;
  const body = orgRows.parse({
    items: rows?.map((row) =>
      Object.fromEntries(
        Object.entries(row).map(([key, value]) => [key.toLowerCase(), value]),
      ),
    ),
  });
  return body.items.map((r) => ({
    id: String(r.org_unit_id),
    name: r.org_unit_name,
    depth: orgDepth(r.num_spaces),
  }));
}
export const organizations = cache(async () => {
  const { user } = await authenticate();
  return orgUnitRows(await lookups.orgUnits({ personId: user.personId }));
});
