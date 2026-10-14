import "server-only";
import { z } from "zod";
import { authenticate } from "@/server/session/service";
import { requireModule } from "@/server/permissions/policy";
import { oracle } from "@/server/api/transport";
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
  const { session, user } = await authenticate();
  requireModule(user, "opportunities-analytics");
  return schema
    .parse(
      await oracle("getSharedGetOppStatistics", {
        token: session.token,
        chart_type: type,
      }),
    )
    .items.map((r, i) => ({
      id: `${r.code ?? i}:${i}`,
      label: r.label,
      value: r.value,
    }));
}
