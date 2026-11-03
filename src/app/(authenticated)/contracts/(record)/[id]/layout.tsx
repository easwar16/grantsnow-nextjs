import Link from "next/link";
import { Suspense, type ReactNode } from "react";
import { pageIdentity } from "@/server/identity/auth/page";
import { contractId } from "@/features/modules/contracts/schema";
import { AppError } from "@/lib/errors";
import { State } from "@/components/feedback/state";
import { Skeleton } from "@/components/feedback/skeleton";
import { displayFormat } from "@/server/platform/configuration/formatting";
import {
  contractActiveVersion,
  contractVisibleTabs,
  loadContract,
} from "@/server/modules/contracts/service";
import { ContractTabs } from "@/features/modules/contracts/record/contract-tabs";
import { ContractCreatedBy } from "@/features/modules/contracts/record/created-by";
import { LocalTime } from "@/components/ui/local-time";
import { StatusBadge } from "@/components/ui/status-badge";
import { CONTRACT_STATUS_TONE } from "@/features/modules/contracts/format";
import styles from "@/features/modules/contracts/contracts.module.css";
import { ContractRecordPanels } from "@/features/record/objects/record-panels";
import { functions } from "@/lib/functions";

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
    <section id="contract" className={styles.detail}>
      <header id="contract-toolbar" className={styles.detailHeader}>
        <Link id="contract-back" href="/contracts" prefetch={false}>
          ← List
        </Link>
        <ContractRecordPanels objectId={id} />
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
    const failure = functions.errors.publicError(error);
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
  // Legacy header fields, each RB-gated and RB-labelled by the service, then the Contract Version.
  const facts: { key: string; label: string; value: ReactNode }[] = [
    ...contract.fields.map((f) => ({
      key: f.key,
      label: f.label,
      value:
        f.kind === "date" ? (
          functions.format.dateDisplay(f.value, format)
        ) : f.kind === "status" ? (
          <StatusBadge tone={CONTRACT_STATUS_TONE[contract.statusCode]}>
            {f.value}
          </StatusBadge>
        ) : f.kind === "creator" && contract.createdById ? (
          <ContractCreatedBy id={contract.id} name={f.value} />
        ) : (
          f.value
        ),
    })),
    ...(version
      ? [
          {
            key: "contract-version",
            label: version.label,
            // Legacy `object_str_ref - DATE hh:mm a`.
            value: (
              <>
                {version.name}
                {version.created && (
                  <>
                    {" - "}
                    <LocalTime value={version.created} kind="minutes" />
                  </>
                )}
              </>
            ),
          },
        ]
      : []),
  ];
  return (
    <>
      <h1 className="sr-only">{contract.title}</h1>
      <ContractTabs id={contract.id} grants={tabs} />
      <section
        id="contract-header"
        className={styles.workflowFacts}
        aria-label="Contract Summary"
      >
        {facts.map((f) => (
          <div key={f.key} id={`contract-header-${f.key}`}>
            <strong>{f.label}</strong>
            <span>{f.value}</span>
          </div>
        ))}
      </section>
    </>
  );
}
