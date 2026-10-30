import { pageIdentity } from "@/server/identity/auth/page";
import { recordIdentity } from "@/features/modules/proposals/record";
import { AttachmentsTab } from "@/features/record/attachments/attachments-tab";
import { State } from "@/components/feedback/state";
import styles from "../proposal-record.module.css";

export const metadata = { title: "Proposal Attachments" };

export default async function ProposalAttachments({
  params,
}: {
  params: Promise<{ type: string; id: string }>;
}) {
  const identity = recordIdentity.safeParse(await params);
  if (!identity.success)
    return <State title="Invalid proposal identity" code="BAD_REQUEST" />;
  const { type, id } = identity.data;
  await pageIdentity(`/proposals/${type}/${id}/attachments`);
  return (
    <section id={`proposal-${id}-attachments`} className={styles.form}>
      <AttachmentsTab
        host={type.toLowerCase()}
        record={id}
        id={`proposal-${id}-attachments-panel`}
      />
    </section>
  );
}
