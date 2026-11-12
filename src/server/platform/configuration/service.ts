import "server-only";
import { cache } from "react";
import { forgetOperation } from "@/server/oracle/cache";
import { configuration, lookups, roles } from "@/server/oracle/api";
import { authenticate } from "@/server/identity/session/service";
import { serverFunctions } from "@/server/functions";
/** Every write to the user's dashboard preferences calls this once it settles, so the next read asks Oracle. */
export function forgetDashboardConfiguration(token: string) {
  forgetOperation("getSharedDashboardPreferences", token);
}

/** The shell, Home and its widgets all read this; saves through the drawer and dimension dialog forget it. */
export const dashboardConfiguration = cache(async () =>
  configuration.preferences.parse(await configuration.dashboardPreferences()),
);

export const dashboardRoles = cache(async () =>
  configuration.dashboardRoleRows(
    await roles.record({ objectType: "DASHBOARD" }),
  ),
);

export const organizations = cache(async () => {
  const { user } = await authenticate();
  return serverFunctions.organizations.orgUnitRows(
    await lookups.orgUnits({ personId: user.personId }),
  );
});
