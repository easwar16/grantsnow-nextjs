import "server-only";
import { z } from "zod";
import { authenticate } from "@/server/identity/session/service";
import { opportunities } from "@/server/oracle/api";
import { serverFunctions } from "@/server/functions";
const schema = z.object({
  items: z.array(
    z.object({
      label: z.string(),
      value: z.number().finite().nonnegative(),
      code: z.union([z.string(), z.number()]).nullish(),
    }),
  ),
});
export async function opportunityStatistics(
  type: "TOP_FUNDERS" | "FUNDING_TYPE",
) {
  const { user } = await authenticate();
  serverFunctions.permissions.requireDrawerAccess(
    user,
    "opportunities-analytics",
  );
  return schema
    .parse(await opportunities.statistics({ chartType: type }))
    .items.map((r, i) => ({
      id: `${r.code ?? i}:${i}`,
      label: r.label,
      value: r.value,
    }));
}
