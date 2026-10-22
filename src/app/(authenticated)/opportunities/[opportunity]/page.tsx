import { z } from "zod";
import { pageIdentity } from "@/server/auth/page";
import { opportunityDetail } from "@/server/opportunities/record";
import { openingShell } from "@/server/opportunities/eoi-record/shell";
import { resources } from "@/server/configuration/resources";
import { State } from "@/components/feedback/state";
import { RecordShell } from "@/features/opportunities/eoi/record-shell";
import { Summary } from "@/features/opportunities/eoi/summary";
import { publicError } from "@/lib/errors";
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
  let detail;
  try {
    detail = await opportunityDetail(id);
  } catch (error) {
    const e = publicError(error);
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
      model={openingShell("detail", id, detail.view.heading, await resources())}
    >
      <Summary
        view={detail.view}
        empty=""
        actionContext={detail.actionContext}
      />
    </RecordShell>
  );
}
