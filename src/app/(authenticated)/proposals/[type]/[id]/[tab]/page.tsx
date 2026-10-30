import { functions } from "@/lib/functions";
import { pageIdentity } from "@/server/identity/auth/page";
import { recordIdentity } from "@/features/modules/proposals/record";
import { proposalPage } from "@/server/modules/proposals/record";
import { DynamicForm } from "@/features/record/dynamic-form/dynamic-form";
import { State } from "@/components/feedback/state";
import styles from "../proposal-record.module.css";

export default async function ProposalDynamicForm({
  params,
}: {
  params: Promise<{ type: string; id: string; tab: string }>;
}) {
  const paramsValue = await params;
  const identity = recordIdentity.safeParse(paramsValue);
  if (!identity.success || !/^dynamic-form-[1-5]$/.test(paramsValue.tab))
    return <State title="Invalid proposal page" code="BAD_REQUEST" />;
  const { type, id } = identity.data;
  await pageIdentity(`/proposals/${type}/${id}/${paramsValue.tab}`);
  const page = `proposals-${paramsValue.tab}`;
  let summary: Awaited<ReturnType<typeof proposalPage>>["summary"] | null =
    null;
  let failure: ReturnType<typeof functions.errors.publicError> | null = null;
  try {
    summary = (await proposalPage(type, id, page)).summary;
  } catch (error) {
    failure = functions.errors.publicError(error);
  }
  if (!summary || failure)
    return (
      <State
        title={
          failure?.code === "FORBIDDEN"
            ? "Access denied"
            : "Proposal page unavailable"
        }
        message={failure?.message}
        action={failure?.action}
        code={failure?.code}
      />
    );
  return (
    <section id={`proposal-${id}-${paramsValue.tab}`} className={styles.form}>
      <DynamicForm
        objectType={type}
        slot={page.toUpperCase()}
        parentId={id}
        objectId={id}
        objectNumber={summary.reference}
        editable={false}
      />
    </section>
  );
}
