import { Suspense } from "react";
import { pageIdentity } from "@/server/identity/auth/page";
import { contractApprovalHost } from "@/server/modules/contracts/workflow";
import { workflowView } from "@/server/record/approvals/workflow";
import { contractId } from "@/features/modules/contracts/schema";
import { ApprovalWorkflow } from "@/features/record/approvals/approval-workflow";
import { State } from "@/components/feedback/state";
import { Skeleton } from "@/components/feedback/skeleton";
import { functions } from "@/lib/functions";

export const metadata = { title: "Contract Workflow" };

export default async function ContractWorkflow({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!contractId.safeParse(id).success)
    return <State title="Invalid contract identity" code="BAD_REQUEST" />;
  await pageIdentity(`/contracts/${id}/workflow`);
  return (
    <Suspense
      fallback={
        <Skeleton kind="list" count={4} label="Loading Approval Route" />
      }
    >
      <WorkflowContent id={id} />
    </Suspense>
  );
}

/** The shared approval workflow with the contract as its host (legacy mounts the approval-workflow fragment). */
async function WorkflowContent({ id }: { id: string }) {
  // The failure is settled here, so the JSX below is built outside any try.
  const result = await contractApprovalHost(id)
    .then(workflowView)
    .then(
      (view) => ({ view }),
      (error: unknown) => ({ failure: functions.errors.publicError(error) }),
    );
  if ("failure" in result) {
    const { failure } = result;
    return (
      <State
        id={`contract-${id}-workflow-error`}
        title={
          failure.code === "FORBIDDEN"
            ? "Access denied"
            : "Contract Workflow unavailable"
        }
        message={failure.message}
        action={failure.action}
        code={failure.code}
      />
    );
  }
  return (
    <ApprovalWorkflow
      id={`contract-${id}-workflow`}
      api={`/contracts/${id}/workflow`}
      view={result.view}
    />
  );
}
