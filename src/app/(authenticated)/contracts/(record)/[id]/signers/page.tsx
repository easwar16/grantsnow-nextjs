import { pageIdentity } from "@/server/identity/auth/page";
import { contractSigners } from "@/server/modules/contracts/service";
import { contractId } from "@/features/modules/contracts/schema";
import { State } from "@/components/feedback/state";
import { contractSignerStamp } from "@/features/modules/contracts/format";
import { displayFormat } from "@/server/platform/configuration/formatting";
import { resources } from "@/server/platform/configuration/resources";
import { Suspense } from "react";
import { Skeleton } from "@/components/feedback/skeleton";
import styles from "@/features/modules/contracts/contracts.module.css";
import { functions } from "@/lib/functions";
import { serverFunctions } from "@/server/functions";

export const metadata = { title: "Contract Signers" };
export default async function ContractSigners({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!contractId.safeParse(id).success)
    return <State title="Invalid contract identity" code="BAD_REQUEST" />;
  await pageIdentity(`/contracts/${id}/signers`);
  return (
    <>
      <Suspense
        fallback={<Skeleton kind="table" label="Loading Contract Signers" />}
      >
        <SignersContent id={id} />
      </Suspense>
    </>
  );
}

async function SignersContent({ id }: { id: string }) {
  const result = await Promise.all([
    contractSigners(id),
    displayFormat(),
    resources(),
  ]).then(
    ([signers, format, labels]) => ({ signers, format, labels }),
    (error: unknown) => ({ failure: functions.errors.publicError(error) }),
  );
  if ("failure" in result) {
    const failure = result.failure;
    return (
      <State
        title={
          failure.code === "FORBIDDEN"
            ? "Access denied"
            : "Contract Signers unavailable"
        }
        message={failure.message}
        action={failure.action}
        code={failure.code}
      />
    );
  }
  const { signers, format, labels } = result;
  const columns = [
    { key: "name", resource: "signer-name", fallback: "Name" },
    { key: "email", resource: "signer-email", fallback: "Email" },
    { key: "type", resource: "signer-user-type", fallback: "User Type" },
    { key: "sent", resource: "signer-sent-dt", fallback: "Sent Date time" },
    {
      key: "delivered",
      resource: "signer-delivered-dt",
      fallback: "Delivered Datetime",
    },
    {
      key: "signed",
      resource: "signer-signed-dt",
      fallback: "Signed Date Time",
    },
    { key: "status", resource: "signer-status", fallback: "Status" },
  ] as const;
  const visibleColumns = columns.filter((column) =>
    serverFunctions.resources.resourceVisible(
      labels,
      "contract",
      "table-headers",
      column.resource,
    ),
  );
  return (
    <section
      id="contract-signers"
      className={styles.signersPanel}
      aria-labelledby="contract-signers-title"
    >
      <h2 id="contract-signers-title">Signers</h2>
      {signers.length ? (
        <div className={styles.signersTableWrap}>
          <table id="contract-signers-table">
            <thead>
              <tr>
                {visibleColumns.map((column) => (
                  <th scope="col" key={column.key}>
                    {serverFunctions.resources.label(
                      labels,
                      "contract",
                      "table-headers",
                      column.resource,
                      column.fallback,
                    )}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {signers.map((row, index) => (
                <tr key={`${row.email}-${index}`}>
                  {visibleColumns.map((column) => (
                    <td key={column.key}>
                      {column.key === "sent" ||
                      column.key === "delivered" ||
                      column.key === "signed"
                        ? contractSignerStamp(row[column.key], format)
                        : row[column.key]}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p>No data to display.</p>
      )}
    </section>
  );
}
