import Link from "next/link";
import { pageIdentity } from "@/server/identity/auth/page";
import { proposalCreateChoices } from "@/server/modules/proposals/create";
import { State } from "@/components/feedback/state";
import { functions } from "@/lib/functions";
import { ProposalCreateForm } from "./proposal-create-form";
import styles from "./proposal-create.module.css";

export const metadata = { title: "Create Proposal" };

export default async function NewProposal({
  params,
}: {
  params: Promise<{ type: string }>;
}) {
  const { type } = await params;
  await pageIdentity(`/proposals/new/${type}`);
  let choices: Awaited<ReturnType<typeof proposalCreateChoices>>;
  try {
    choices = await proposalCreateChoices(type);
  } catch (error) {
    const info = functions.errors.publicError(error);
    return (
      <State
        title={
          info.code === "FORBIDDEN"
            ? "Access denied"
            : "Proposal creation unavailable"
        }
        message={info.message}
        action={info.action}
        code={info.code}
      />
    );
  }
  return (
    <main id="proposal-new-page" className={styles.page}>
      <div id="proposal-new-toolbar" className={styles.toolbar}>
        <Link id="proposal-new-list" href="/proposals" prefetch={false}>
          ← List
        </Link>
        <h1>
          {type === "PROPOSAL"
            ? "Create new Grant App"
            : "Create new outline proposal"}
        </h1>
      </div>
      <ProposalCreateForm
        type={type as "PROPOSAL" | "OUTLINE_PROPOSAL"}
        choices={choices}
      />
    </main>
  );
}
