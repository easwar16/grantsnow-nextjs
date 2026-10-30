import { serverFunctions } from "@/server/functions";
import { functions } from "@/lib/functions";
import { pageIdentity } from "@/server/identity/auth/page";
import { recordIdentity } from "@/features/modules/proposals/record";
import { proposalCreditAllocation } from "@/server/modules/proposals/credit-allocation";
import { resources } from "@/server/platform/configuration/resources";
import { displayFormat } from "@/server/platform/configuration/formatting";
import { State } from "@/components/feedback/state";
import styles from "../proposal-record.module.css";

export const metadata = { title: "Credit Allocation" };

function percent(value: string | number, decimals: number, fixed: boolean) {
  if (value === "") return "";
  const number = Number(value);
  return Number.isFinite(number)
    ? `${new Intl.NumberFormat(undefined, {
        minimumFractionDigits: fixed ? decimals : 0,
        maximumFractionDigits: decimals,
      }).format(number * 100)}%`
    : String(value);
}

export default async function CreditAllocation({
  params,
  searchParams,
}: {
  params: Promise<{ type: string; id: string }>;
  searchParams: Promise<{ version?: string }>;
}) {
  const identity = recordIdentity.safeParse(await params);
  if (!identity.success)
    return <State title="Invalid proposal identity" code="BAD_REQUEST" />;
  const { type, id } = identity.data;
  await pageIdentity(`/proposals/${type}/${id}/allocation-for-credit`);
  const version = (await searchParams).version;
  if (version !== undefined && !/^[1-9]\d{0,14}$/.test(version))
    return <State title="Invalid Budget version" code="BAD_REQUEST" />;
  let allocation: Awaited<ReturnType<typeof proposalCreditAllocation>>;
  try {
    allocation = await proposalCreditAllocation(
      type,
      id,
      version ? Number(version) : undefined,
    );
  } catch (error) {
    const failure = functions.errors.publicError(error);
    return (
      <State
        title={
          failure.code === "FORBIDDEN"
            ? "Access denied"
            : "Credit Allocation unavailable"
        }
        message={failure.message}
        action={failure.action}
        code={failure.code}
      />
    );
  }
  const [rb, format] = await Promise.all([resources(), displayFormat()]);
  const columns = [
    ["credit-alloc-name", "Name", "name"],
    ["credit-alloc-proposal-number", "Proposal Number", "proposalNumber"],
    ["credit-alloc-project-role", "Project Role", "role"],
    ["credit-alloc-org-unit", "Org Unit", "orgUnit"],
    ["credit-alloc-project-effort", "Project Effort%", "effort"],
    ["credit-alloc-credit-allocation", "Credit Allocation %", "credit"],
  ] as const;
  const visible = columns.filter(([key]) =>
    serverFunctions.resources.resourceVisible(
      rb,
      allocation.bundle,
      "table-headers",
      key,
    ),
  );
  return (
    <section
      id={`proposal-${id}-credit-allocation`}
      className={styles.creditAllocation}
    >
      <table
        id={`proposal-${id}-credit-allocation-table`}
        className={styles.staffLines}
      >
        <thead>
          <tr>
            {visible.map(([key, fallback]) => (
              <th
                id={`proposal-${id}-credit-allocation-header-${key}`}
                scope="col"
                key={key}
              >
                {serverFunctions.resources.label(
                  rb,
                  allocation.bundle,
                  "table-headers",
                  key,
                  fallback,
                )}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {allocation.rows.length === 0 ? (
            <tr>
              <td colSpan={Math.max(visible.length, 1)}>No data to display.</td>
            </tr>
          ) : (
            allocation.rows.map((row) => (
              <tr
                id={`proposal-${id}-credit-allocation-${row.id}`}
                key={row.id}
              >
                {visible.map(([key, , field]) => (
                  <td
                    id={`proposal-${id}-credit-allocation-${row.id}-${key}`}
                    key={field}
                  >
                    {field === "effort" || field === "credit"
                      ? percent(
                          row[field],
                          format?.decimals ?? 2,
                          field === "credit",
                        )
                      : row[field]}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </section>
  );
}
