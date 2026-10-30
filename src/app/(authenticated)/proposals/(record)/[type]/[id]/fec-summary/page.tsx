import { serverFunctions } from "@/server/functions";
import { functions } from "@/lib/functions";
import { pageIdentity } from "@/server/identity/auth/page";
import { recordIdentity } from "@/features/modules/proposals/record";
import { proposalPage } from "@/server/modules/proposals/record";
import { resources } from "@/server/platform/configuration/resources";
import { State } from "@/components/feedback/state";
import { displayFormat } from "@/server/platform/configuration/formatting";
import { FecReport } from "@/features/modules/proposals/record/fec-summary/report";

export const metadata = { title: "FEC Summary" };
export default async function FecSummary({
  params,
}: {
  params: Promise<{ type: string; id: string }>;
}) {
  const parsed = recordIdentity.safeParse(await params);
  if (!parsed.success)
    return <State title="Invalid proposal identity" code="BAD_REQUEST" />;
  const { type, id } = parsed.data;
  await pageIdentity(`/proposals/${type}/${id}/fec-summary`);
  let context: Awaited<ReturnType<typeof proposalPage>>;
  try {
    context = await proposalPage(type, id, "proposals-fec-summary");
  } catch (error) {
    const failure = functions.errors.publicError(error);
    return (
      <State
        title={
          failure.code === "FORBIDDEN"
            ? "Access denied"
            : "FEC Summary unavailable"
        }
        message={failure.message}
        action={failure.action}
        code={failure.code}
      />
    );
  }
  const rb = await resources();
  const format = await displayFormat();
  const text = (group: string, key: string, fallback: string) =>
    serverFunctions.resources.label(rb, context.bundle, group, key, fallback);
  const suggestions = rb
    .filter(
      (row) =>
        row.module_name.toLowerCase() === context.bundle.toLowerCase() &&
        row.label_type === "suggestions" &&
        serverFunctions.resources.resourceVisible(
          rb,
          context.bundle,
          "suggestions",
          row.label_name,
        ),
    )
    .sort((a, b) =>
      a.label_name.localeCompare(b.label_name, undefined, { numeric: true }),
    )
    .map((row) => row.label_value ?? "")
    .filter(Boolean);
  return (
    <FecReport
      id={id}
      type={type}
      currency={format?.currency ?? "GBP"}
      decimals={format?.decimals ?? 2}
      suggestions={suggestions}
      labels={{
        title: text("labels", "costing-analysis", "Costing Analysis"),
        generate: text("button-labels", "generate", "Generate"),
        frequent: text("labels", "frequent-searches", "Frequent Searches"),
        table: text("placeholders", "data-table", "Data Table"),
        chart: text("placeholders", "data-chart", "Data Chart"),
        empty: text("placeholders", "analysis-no-data", "No data to display."),
      }}
    />
  );
}
