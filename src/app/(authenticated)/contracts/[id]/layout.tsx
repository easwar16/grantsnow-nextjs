import Link from "next/link";
import { Suspense, type ReactNode } from "react";
import { pageIdentity } from "@/server/identity/auth/page";
import { contractId } from "@/features/contracts/schema";
import { dateDisplay } from "@/lib/format";
import { AppError, publicError } from "@/lib/errors";
import { State } from "@/components/feedback/state";
import { Skeleton } from "@/components/feedback/skeleton";
import { displayFormat } from "@/server/platform/configuration/formatting";
import {
  contractActiveVersion,
  contractVisibleTabs,
  loadContract,
} from "@/server/contracts/service";
import { ContractTabs } from "./contract-tabs";
import styles from "../contracts.module.css";

/** Kept mounted across Contract tabs; only children below this header are replaced. */
export default async function ContractRecordLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!contractId.safeParse(id).success)
    return <State title="Invalid contract identity" code="BAD_REQUEST" />;
  await pageIdentity(`/contracts/${id}`);
  return (
    <section className={styles.detail}>
      <header className={styles.detailHeader}>
        <Link href="/contracts" prefetch={false}>
          ← List
        </Link>
        <div className={styles.detailActions}>
          <Link href={`/contracts/${id}?panel=comments`} prefetch={false}>
            Comments
          </Link>
          <Link href={`/contracts/${id}?panel=audit`} prefetch={false}>
            Open Audit Trail
          </Link>
        </div>
      </header>
      <Suspense
        fallback={
          <Skeleton kind="lines" count={5} label="Loading Contract header" />
        }
      >
        <ContractRecordHeader id={id} />
      </Suspense>
      {children}
    </section>
  );
}

async function ContractRecordHeader({ id }: { id: string }) {
  let contract;
  try {
    contract = await loadContract(id);
  } catch (error) {
    const failure = publicError(error);
    return (
      <State
        title={
          failure.code === "FORBIDDEN"
            ? "Access denied"
            : "Contract unavailable"
        }
        message={failure.message}
        action={failure.action}
        code={failure.code}
      />
    );
  }
  const [tabs, format, version] = await Promise.all([
    contractVisibleTabs(contract.id),
    displayFormat(),
    contractActiveVersion(id).catch((error: unknown) => {
      if (
        error instanceof AppError &&
        (error.status === 401 || error.status === 403)
      )
        throw error;
      return null;
    }),
  ]);
  const versionLabel = version
    ? [
        version.name,
        version.created &&
          !Number.isNaN(Date.parse(version.created)) &&
          `${dateDisplay(version.created, format)} ${new Intl.DateTimeFormat("en-GB", { hour: "numeric", minute: "2-digit", hour12: true }).format(new Date(version.created)).toLowerCase()}`,
      ]
        .filter(Boolean)
        .join(" - ")
    : "";
  const facts = [
    ["Contract Type", contract.type],
    ["Start date", dateDisplay(contract.start, format)],
    ["Last Updated by", contract.updatedBy],
    ["Contract Title", contract.title],
    ["End date", dateDisplay(contract.end, format)],
    ["Contract Version", versionLabel],
    ["Org Unit", contract.organization],
    ["Created by", contract.createdBy],
  ];
  return (
    <>
      <h1 className="sr-only">{contract.title}</h1>
      <ContractTabs
        id={contract.id}
        grants={tabs}
        statusCode={contract.statusCode}
      />
      <section className={styles.workflowFacts} aria-label="Contract Summary">
        {facts.map(([name, value]) => (
          <div key={name}>
            <strong>{name}</strong>
            <span>{value}</span>
          </div>
        ))}
      </section>
    </>
  );
}
