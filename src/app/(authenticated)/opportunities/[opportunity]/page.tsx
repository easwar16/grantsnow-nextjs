import { z } from "zod";
import { pageIdentity } from "@/server/identity/auth/page";
import { opportunityDetail } from "@/server/modules/opportunities/record";
import { openingShell } from "@/server/modules/opportunities/eoi-record/shell";
import { resources } from "@/server/platform/configuration/resources";
import { State } from "@/components/feedback/state";
import { RecordShell } from "@/features/modules/opportunities/eoi/record-shell";
import { Summary } from "@/features/modules/opportunities/eoi/summary";
import { functions } from "@/lib/functions";

/** More Info: the opportunity's summary alone, read-only, with Apply / Convert / Convert to Proposal. */
export default async function OpportunityDetailPage({
  params,
}: {
  params: Promise<{ opportunity: string }>;
}) {
  const { opportunity: id } = await params;
  await pageIdentity(`/opportunities/${id}`);
  if (
    !z
      .string()
      .regex(/^[1-9]\d{0,14}$/)
      .safeParse(id).success
  )
    return <State title="Invalid opportunity" code="BAD_REQUEST" />;
  // The shell's labels load beside the detail, not after it.
  const labelsRead = resources();
  labelsRead.catch(() => undefined);
  let detail;
  try {
    detail = await opportunityDetail(id);
  } catch (error) {
    const e = functions.errors.publicError(error);
    return (
      <State
        title={
          e.code === "FORBIDDEN" ? "Access denied" : "Opportunity unavailable"
        }
        message={e.message}
        action={e.action}
        code={e.code}
      />
    );
  }
  return (
    <RecordShell
      model={openingShell("detail", id, detail.view.heading, await labelsRead)}
    >
      <Summary
        view={detail.view}
        empty=""
        actionContext={detail.actionContext}
      />
    </RecordShell>
  );
}
