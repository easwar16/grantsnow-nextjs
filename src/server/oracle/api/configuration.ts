import "server-only";
import { z } from "zod";
import { read } from "../client";
import { TTL } from "../cache";

/** The labels of every bundle this app shows (legacy getSharedLabels); the service merges them over the seeds. */
export const labels = read<void, unknown>({
  op: "getSharedLabels",
  headers: () => ({
    module_name:
      "DASHBOARD,PROPOSAL,OUTLINE_PROPOSAL,SUB_PROPOSAL,EXTENSION_PROPOSAL,OPPORTUNITIES-EOI",
  }),
});

const globals = z.object({
  items: z.array(
    z.object({
      var_key: z.string(),
      var_value: z.union([z.string(), z.number()]).nullish(),
    }),
  ),
});
export type GlobalVariable = z.infer<typeof globals>["items"][number];
/** The global variables (admin configuration): formats, form and file limits, the logo and the chatbot flag. */
export const globalVariables = read<void, GlobalVariable[]>({
  op: "getPre_award_costingGetGlobalVar",
  ttl: TTL.config,
  parse: (b) => globals.parse(b).items,
});

const visibility = z.record(
  z.string(),
  z.object({ isVisible: z.boolean().optional() }).passthrough(),
);
const preferences = z.object({
  theme: z.string().optional(),
  accessibility: z
    .record(
      z.string(),
      z
        .object({ value: z.union([z.number(), z.string()]).optional() })
        .passthrough(),
    )
    .optional(),
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
});
export type DashboardPreferences = z.infer<typeof preferences>;
/** The user's dashboard preferences as the shell, Home and its widgets read them, held per session. */
export const dashboardPreferences = read<void, DashboardPreferences>({
  op: "getSharedDashboardPreferences",
  ttl: TTL.config,
  parse: (b) => preferences.parse(b),
});
/** The same preferences as Oracle stores them now, for the panels that edit them (never the held copy). */
export const storedPreferences = read<void, Record<string, unknown>>({
  op: "getSharedDashboardPreferences",
  parse: (b) => b as Record<string, unknown>,
});

const roles = z.object({
  items: z.array(
    z.object({
      page_name: z.string(),
      read_access: z.string(),
      edit_access: z.string().nullish(),
    }),
  ),
});
export type DashboardRole = z.infer<typeof roles>["items"][number];
/** The user's DASHBOARD page grants (legacy user_roles, `p_obj_type` DASHBOARD). */
export const dashboardRoles = read<void, DashboardRole[]>({
  op: "getSecurityUser_roles",
  headers: () => ({ p_obj_type: "DASHBOARD" }),
  ttl: TTL.access,
  parse: (b) => roles.parse(b).items,
});
