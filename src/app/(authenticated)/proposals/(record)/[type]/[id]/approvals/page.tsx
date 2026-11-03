import { functions } from "@/lib/functions";
import { pageIdentity } from "@/server/identity/auth/page";
import { recordIdentity } from "@/features/modules/proposals/record";
import { proposalApprovalHost } from "@/server/modules/proposals/approval";
import { workflowView } from "@/server/record/approvals/workflow";
import { ApprovalWorkflow } from "@/features/record/approvals/approval-workflow";
import { State } from "@/components/feedback/state";
import styles from "@/features/modules/proposals/record/proposal-record.module.css";

export const metadata = { title: "Proposal Approvals" };

export default async function ProposalApprovals({
  params,
}: {
  params: Promise<{ type: string; id: string }>;
}) {
  const identity = recordIdentity.safeParse(await params);
  if (!identity.success)
    return <State title="Invalid proposal identity" code="BAD_REQUEST" />;
  const { type, id } = identity.data;
  await pageIdentity(`/proposals/${type}/${id}/approvals`);
  let view: Awaited<ReturnType<typeof workflowView>> | null = null;
  let failure: ReturnType<typeof functions.errors.publicError> | null = null;
  try {
    view = await workflowView(await proposalApprovalHost(type, id));
  } catch (error) {
    failure = functions.errors.publicError(error);
  }
  if (!view || failure)
    return (
      <State
        title={
          failure?.code === "FORBIDDEN"
            ? "Access denied"
            : "Proposal approvals unavailable"
        }
        message={failure?.message}
        action={failure?.action}
        code={failure?.code}
      />
    );
  return (
    <section id={`proposal-${id}-approvals`} className={styles.form}>
      <ApprovalWorkflow
        id={`proposal-${id}-workflow`}
        api={`/proposals/${type}/${id}/approvals`}
        view={view}
      />
    </section>
  );
}
