import { serverFunctions } from "@/server/functions";
import "server-only";
import { z } from "zod";
import { reports } from "@/server/oracle/api";
import { AppError } from "@/lib/errors";
import { recordIdentity } from "@/features/modules/proposals/record";
import { resources } from "@/server/platform/configuration/resources";
import { proposalPage } from "./record";

const cell = z.union([z.string(), z.number()]).nullish();
const report = z.object({
  data: z.array(z.object({ Metric: cell, Value: cell })),
});

export async function proposalViability(type: string, id: string) {
  const identity = recordIdentity.parse({ type, id });
  const context = await proposalPage(
    identity.type,
    identity.id,
    "proposals-budget",
  );
  if (
    !serverFunctions.resources.resourceVisible(
      await resources(),
      context.bundle,
      "button-labels",
      "proposal-budget-dyn-report",
    )
  )
    throw new AppError("FORBIDDEN", "Viability Checks are unavailable.", 403);
  const versionId = context.summary.budgetVersionId;
  if (versionId === null)
    return { columns: [] as string[], rows: [] as Record<string, string>[] };
  const raw = report.safeParse(
    await reports.viability({ proposalId: id, versionId }),
  );
  if (!raw.success)
    throw new AppError(
      "CONTRACT",
      "Oracle returned an invalid Viability Checks report.",
    );
  const columns = ["Metric", "Value"];
  return {
    columns,
    rows: raw.data.data.map((row) => ({
      Metric:
        row.Metric === null || row.Metric === undefined
          ? ""
          : String(row.Metric),
      Value:
        row.Value === null || row.Value === undefined ? "" : String(row.Value),
    })),
  };
}
