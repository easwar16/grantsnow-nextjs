import { pageIdentity } from "@/server/identity/auth/page";
import {
  contractHistoryHost,
  loadContract,
} from "@/server/modules/contracts/service";
import { historyView } from "@/server/record/objects/history";
import { contractId } from "@/features/modules/contracts/schema";
import { ObjectHistory } from "@/features/record/objects/object-history";
import { State } from "@/components/feedback/state";
import { publicError } from "@/lib/errors";
import { Suspense } from "react";
import { Skeleton } from "@/components/feedback/skeleton";

export const metadata = { title: "Contract History" };
export default async function ContractHistory({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!contractId.safeParse(id).success)
    return <State title="Invalid contract identity" code="BAD_REQUEST" />;
  await pageIdentity(`/contracts/${id}/history`);
  return (
    <>
      <Suspense
        fallback={<Skeleton kind="table" label="Loading Contract History" />}
      >
        <HistoryContent id={id} />
      </Suspense>
    </>
  );
}

async function HistoryContent({ id }: { id: string }) {
  const result = await Promise.all([
    loadContract(id),
    contractHistoryHost(id).then(historyView),
  ]).then(
    ([contract, view]) => ({ contract, view }),
    (error: unknown) => ({ failure: publicError(error) }),
  );
  if ("failure" in result) {
    const failure = result.failure;
    return (
      <State
        title={
          failure.code === "FORBIDDEN"
            ? "Access denied"
            : "Contract History unavailable"
        }
        message={failure.message}
        action={failure.action}
        code={failure.code}
      />
    );
  }
  return (
    <ObjectHistory
      id="contract-history"
      host={{ host: "contract", record: id }}
      view={result.view}
    />
  );
}
