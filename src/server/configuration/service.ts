import "server-only";
import { cache } from "react";
import { z } from "zod";
import { authenticate } from "@/server/session/service";
import { oracle } from "@/server/api/transport";
export const dashboardConfiguration = cache(async () => {
  const { session } = await authenticate();
  const visibility = z.record(
    z.string(),
    z.object({ isVisible: z.boolean().optional() }).passthrough(),
  );
  return z
    .object({
      theme: z.string().optional(),
      needAttention: visibility,
      insights: visibility,
      KPI_STATISTICS: visibility.optional(),
      notifications: z.boolean().optional(),
      opportunity: z.boolean().optional(),
      dynamicCharts: z
        .record(
          z.string(),
          z.object({
            isVisible: z.boolean().optional(),
            infolet_id: z.union([z.string(), z.number()]),
            ModuleName: z.string().optional(),
          }),
        )
        .optional(),
    })
    .parse(
      await oracle("getSharedDashboardPreferences", { token: session.token }),
    );
});
export const dashboardRoles = cache(async () => {
  const { session } = await authenticate();
  return z
    .object({
      items: z.array(
        z.object({ page_name: z.string(), read_access: z.string() }),
      ),
    })
    .parse(
      await oracle("getSecurityUser_roles", {
        token: session.token,
        p_obj_type: "DASHBOARD",
      }),
    ).items;
});
export const organizations = cache(async () => {
  const { session, user } = await authenticate();
  const raw = (await oracle("getPre_awardGetLkpOrgUnitType", {
    token: session.token,
    person_id: user.personId,
  })) as { items: Record<string, unknown>[] };
  const normalized = {
    ...raw,
    items: raw.items?.map((row) =>
      Object.fromEntries(
        Object.entries(row).map(([key, value]) => [key.toLowerCase(), value]),
      ),
    ),
  };
  const body = z
    .object({
      items: z.array(
        z.object({
          org_unit_id: z.union([z.string(), z.number()]),
          org_unit_name: z.string(),
        }),
      ),
    })
    .parse(normalized);
  return body.items.map((r) => ({
    id: String(r.org_unit_id),
    name: r.org_unit_name,
  }));
});
