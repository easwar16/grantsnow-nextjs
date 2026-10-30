import Link from "next/link";
import { Suspense, type ReactNode } from "react";
import { pageIdentity } from "@/server/identity/auth/page";
import { recordIdentity } from "@/features/modules/proposals/record";
import { State } from "@/components/feedback/state";
import { Skeleton } from "@/components/feedback/skeleton";
import { ProposalEditProvider } from "@/features/modules/proposals/record/proposal-edit-form";
import {
  ProposalActions,
  ProposalHeader,
} from "@/features/modules/proposals/record/record-header";
import styles from "@/features/modules/proposals/record/proposal-record.module.css";

export default async function ProposalRecordLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ type: string; id: string }>;
}) {
  const parsed = recordIdentity.safeParse(await params);
  if (!parsed.success)
    return <State title="Invalid proposal identity" code="BAD_REQUEST" />;
  const { type, id } = parsed.data;
  await pageIdentity(`/proposals/${type}/${id}`);
  return (
    <ProposalEditProvider>
      <section id={`proposal-${id}-record`} className={styles.record}>
        <header id={`proposal-${id}-actions`} className={styles.actions}>
          <Link id={`proposal-${id}-list`} href="/proposals" prefetch={false}>
            ← List
          </Link>
          <Suspense fallback={null}>
            <ProposalActions type={type} id={id} />
          </Suspense>
        </header>
        <Suspense
          fallback={
            <Skeleton kind="lines" count={3} label="Loading Proposal header" />
          }
        >
          <ProposalHeader type={type} id={id} />
        </Suspense>
        <div id={`proposal-${id}-content`}>{children}</div>
      </section>
    </ProposalEditProvider>
  );
}
