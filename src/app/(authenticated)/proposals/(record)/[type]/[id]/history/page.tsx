import { functions } from "@/lib/functions";
import { pageIdentity } from "@/server/identity/auth/page";
import { recordIdentity } from "@/features/modules/proposals/record";
import { proposalHistoryHost } from "@/server/modules/proposals/history";
import { historyView } from "@/server/record/objects/history";
import { ObjectHistory } from "@/features/record/objects/object-history";
import { State } from "@/components/feedback/state";
import styles from "@/features/modules/proposals/record/proposal-record.module.css";

export const metadata = { title: "Proposal History" };

export default async function ProposalHistory({
  params,
}: {
  params: Promise<{ type: string; id: string }>;
}) {
  const identity = recordIdentity.safeParse(await params);
  if (!identity.success)
    return <State title="Invalid proposal identity" code="BAD_REQUEST" />;
  const { type, id } = identity.data;
  await pageIdentity(`/proposals/${type}/${id}/history`);
  let view: Awaited<ReturnType<typeof historyView>> | null = null;
  let failure: ReturnType<typeof functions.errors.publicError> | null = null;
  try {
    view = await historyView(await proposalHistoryHost(type, id));
  } catch (error) {
    failure = functions.errors.publicError(error);
  }
  if (!view || failure)
    return (
      <State
        title={
          failure?.code === "FORBIDDEN"
            ? "Access denied"
            : "Proposal history unavailable"
        }
        message={failure?.message}
        action={failure?.action}
        code={failure?.code}
      />
    );
  return (
    <section id={`proposal-${id}-history`} className={styles.form}>
      <ObjectHistory
        id={`proposal-${id}-history-panel`}
        host={{ host: "proposal", record: id }}
        view={view}
      />
    </section>
  );
}
