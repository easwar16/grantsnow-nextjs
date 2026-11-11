import { pageIdentity } from "@/server/identity/auth/page";
import { recordIdentity } from "@/features/modules/proposals/record";
import { proposalResearchPartnerCosts } from "@/server/modules/proposals/record/research-partner-costs";
import { resources } from "@/server/platform/configuration/resources";
import { displayFormat } from "@/server/platform/configuration/formatting";
import { serverFunctions } from "@/server/functions";
import { functions } from "@/lib/functions";
import { State } from "@/components/feedback/state";
import { ResearchPartnerCosts } from "@/features/modules/proposals/record/research-partner-costs";

export const metadata = { title: "Proposal Research Partner Costs" };
export default async function ResearchPartnerCostsPage({
  params,
}: {
  params: Promise<{ type: string; id: string }>;
}) {
  const identity = recordIdentity.safeParse(await params);
  if (!identity.success)
    return <State title="Invalid proposal identity" code="BAD_REQUEST" />;
  const { type, id } = identity.data;
  await pageIdentity(`/proposals/${type}/${id}/budget-research-partner`);
  let data: Awaited<ReturnType<typeof proposalResearchPartnerCosts>>;
  try {
    data = await proposalResearchPartnerCosts(type, id);
  } catch (cause) {
    const failure = functions.errors.publicError(cause);
    return (
      <State
        title={
          failure.code === "FORBIDDEN"
            ? "Access denied"
            : "Research Partner costs unavailable"
        }
        message={failure.message}
        action={failure.action}
        code={failure.code}
      />
    );
  }
  const [rb, format] = await Promise.all([resources(), displayFormat()]);
  const label = (section: string, key: string, fallback: string) =>
    serverFunctions.resources.label(rb, data.bundle, section, key, fallback);
  return (
    <ResearchPartnerCosts
      type={type}
      id={id}
      headers={data.headers}
      lines={data.lines}
      categories={data.categories}
      canEdit={data.canEdit}
      canDelete={data.canDelete}
      format={format}
      labels={{
        start: label("table-headers", "start-date", "Start Date"),
        end: label("table-headers", "end-date", "End Date"),
        category: label("table-headers", "cost-category", "Cost Category"),
        item: label("labels", "cost-item", "Cost Item"),
        description: label("table-headers", "description", "Description"),
        cost: label("labels", "cost", "Cost"),
        save: label("button-labels", "save", "Save"),
        cancel: label("button-labels", "cancel", "Cancel"),
      }}
    />
  );
}
