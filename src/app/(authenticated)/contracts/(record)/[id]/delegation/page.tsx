import { pageIdentity } from "@/server/identity/auth/page";
import {
  contractDelegationHost,
  loadContract,
} from "@/server/modules/contracts/service";
import { delegationView } from "@/server/record/objects/delegations";
import { contractId } from "@/features/modules/contracts/schema";
import { ObjectDelegations } from "@/features/record/objects/object-delegations";
import { State } from "@/components/feedback/state";
import { publicError } from "@/lib/errors";
import { Suspense } from "react";
import { Skeleton } from "@/components/feedback/skeleton";

export const metadata = { title: "Contract Delegation" };
export default async function ContractDelegation({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!contractId.safeParse(id).success)
    return <State title="Invalid contract identity" code="BAD_REQUEST" />;
  await pageIdentity(`/contracts/${id}/delegation`);
  return (
    <>
      <Suspense
        fallback={<Skeleton kind="table" label="Loading Contract Delegation" />}
      >
        <DelegationContent id={id} />
      </Suspense>
    </>
  );
}

async function DelegationContent({ id }: { id: string }) {
  const result = await Promise.all([
    loadContract(id),
    contractDelegationHost(id).then(delegationView),
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
            : "Contract Delegation unavailable"
        }
        message={failure.message}
        action={failure.action}
        code={failure.code}
      />
    );
  }
  return (
    <ObjectDelegations
      id="contract-delegation"
      host={{ host: "contract", record: id }}
      view={result.view}
    />
  );
}
