import { functions } from "@/lib/functions";
import { pageIdentity } from "@/server/identity/auth/page";
import { recordIdentity } from "@/features/modules/proposals/record";
import { proposalDelegationHost } from "@/server/modules/proposals/delegation";
import { delegationView } from "@/server/record/objects/delegations";
import { ObjectDelegations } from "@/features/record/objects/object-delegations";
import { State } from "@/components/feedback/state";
import styles from "@/features/modules/proposals/record/proposal-record.module.css";

export const metadata = { title: "Proposal Delegation" };

export default async function ProposalDelegation({
  params,
}: {
  params: Promise<{ type: string; id: string }>;
}) {
  const identity = recordIdentity.safeParse(await params);
  if (!identity.success)
    return <State title="Invalid proposal identity" code="BAD_REQUEST" />;
  const { type, id } = identity.data;
  await pageIdentity(`/proposals/${type}/${id}/delegation`);
  let view: Awaited<ReturnType<typeof delegationView>> | null = null;
  let failure: ReturnType<typeof functions.errors.publicError> | null = null;
  try {
    view = await delegationView(await proposalDelegationHost(type, id));
  } catch (error) {
    failure = functions.errors.publicError(error);
  }
  if (!view || failure)
    return (
      <State
        title={
          failure?.code === "FORBIDDEN"
            ? "Access denied"
            : "Proposal delegation unavailable"
        }
        message={failure?.message}
        action={failure?.action}
        code={failure?.code}
      />
    );
  return (
    <section id={`proposal-${id}-delegation`} className={styles.form}>
      <ObjectDelegations
        id={`proposal-${id}-delegation-panel`}
        host={{ host: "proposal", record: id }}
        view={view}
      />
    </section>
  );
}
