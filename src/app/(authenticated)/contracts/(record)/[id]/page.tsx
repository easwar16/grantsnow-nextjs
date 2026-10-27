import { Suspense } from "react";
import { pageIdentity } from "@/server/identity/auth/page";
import { contractId } from "@/features/modules/contracts/schema";
import { State } from "@/components/feedback/state";
import { Skeleton } from "@/components/feedback/skeleton";
import { ContractSummaryContent } from "./summary-sections";

export const metadata = { title: "Contract Summary" };
export default async function ContractSummary({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!contractId.safeParse(id).success)
    return <State title="Invalid contract identity" code="BAD_REQUEST" />;
  await pageIdentity(`/contracts/${id}`);
  return (
    <Suspense
      fallback={
        <Skeleton kind="lines" count={6} label="Loading Contract record" />
      }
    >
      <ContractSummaryContent id={id} />
    </Suspense>
  );
}
