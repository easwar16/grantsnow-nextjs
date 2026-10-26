import { Suspense } from "react";
import { pageIdentity } from "@/server/identity/auth/page";
import { contractId } from "@/features/contracts/schema";
import { parseContractAuditEvent } from "@/server/contracts/service";
import { State } from "@/components/feedback/state";
import { Skeleton } from "@/components/feedback/skeleton";
import { ContractSummaryContent } from "./summary-sections";

export const metadata = { title: "Contract Summary" };
export default async function ContractSummary({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { id } = await params;
  if (!contractId.safeParse(id).success)
    return <State title="Invalid contract identity" code="BAD_REQUEST" />;
  await pageIdentity(`/contracts/${id}`);
  const query = await searchParams;
  const panel = query.panel;
  if (panel !== undefined && panel !== "comments" && panel !== "audit")
    return <State title="Invalid Contract panel" code="BAD_REQUEST" />;
  if (Array.isArray(query.event))
    return <State title="Invalid Contract audit filter" code="BAD_REQUEST" />;
  let event;
  try {
    event = parseContractAuditEvent(query.event);
  } catch {
    return <State title="Invalid Contract audit filter" code="BAD_REQUEST" />;
  }
  return (
    <Suspense
      fallback={
        <Skeleton kind="lines" count={6} label="Loading Contract record" />
      }
    >
      <ContractSummaryContent id={id} panel={panel} event={event} />
    </Suspense>
  );
}
