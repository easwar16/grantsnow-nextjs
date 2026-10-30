import { functions } from "@/lib/functions";
import Link from "next/link";
import { pageIdentity } from "@/server/identity/auth/page";
import { recordIdentity } from "@/features/modules/proposals/record";
import { proposalStaffCost } from "@/server/modules/proposals/budget";
import { State } from "@/components/feedback/state";
import { displayFormat } from "@/server/platform/configuration/formatting";
import styles from "../../../proposal-record.module.css";

export const metadata = { title: "Proposal Staff Costing" };

export default async function StaffCosting({
  params,
  searchParams,
}: {
  params: Promise<{ type: string; id: string; costHeaderId: string }>;
  searchParams: Promise<{ version?: string }>;
}) {
  const route = await params;
  const parsed = recordIdentity.safeParse(route);
  if (!parsed.success || !/^[1-9]\d{0,14}$/.test(route.costHeaderId))
    return <State title="Invalid Staff cost identity" code="BAD_REQUEST" />;
  const { type, id } = parsed.data;
  await pageIdentity(`/proposals/${type}/${id}/budget`);
  const version = (await searchParams).version;
  if (version !== undefined && !/^[1-9]\d{0,14}$/.test(version))
    return <State title="Invalid Budget version" code="BAD_REQUEST" />;
  let cost: Awaited<ReturnType<typeof proposalStaffCost>>;
  try {
    cost = await proposalStaffCost(
      type,
      id,
      Number(route.costHeaderId),
      version ? Number(version) : undefined,
    );
  } catch (error) {
    const failure = functions.errors.publicError(error);
    return (
      <State
        title={
          failure.code === "FORBIDDEN"
            ? "Access denied"
            : "Staff costing unavailable"
        }
        message={failure.message}
        action={failure.action}
        code={failure.code}
      />
    );
  }
  const format = await displayFormat();
  const fields = [
    ["Full Name", cost.name],
    ["Employee number", cost.employeeNumber],
    ["Org Unit", cost.orgUnit],
    ["Faculty / School", cost.faculty],
    [
      "Probation end date",
      functions.format.dateDisplay(cost.probationEndDate, format),
    ],
    ["First Increment", cost.firstIncrement],
    ["Project role", cost.projectRole],
    ["Costing HDR section", cost.fundingSection],
    ["Salary Model", cost.salaryModel],
    ["HR FTE", String(cost.hrFte)],
    ["Override Inflation", cost.overrideInflation ? "Yes" : "No"],
  ];
  const showSensitive = cost.lines.some((line) => line.unitCost !== null);
  return (
    <section
      id={`proposal-${id}-staff-cost-${route.costHeaderId}`}
      className={styles.staffCost}
    >
      <div className={styles.staffCostTitle}>
        <h2>Staff costing</h2>
        <Link
          id={`proposal-${id}-staff-cost-back`}
          href={`/proposals/${type}/${id}/budget${version ? `?version=${version}` : ""}`}
          prefetch={false}
        >
          ← Back
        </Link>
      </div>
      <div className={styles.staffCostModel}>
        <strong>Cost model</strong>
        <span>{cost.costModel || "—"}</span>
      </div>
      <h3>Personal details</h3>
      <div className={styles.staffFields}>
        {fields.map(([name, value], index) => (
          <div id={`proposal-${id}-staff-field-${index}`} key={name}>
            <strong>{name}</strong>
            <span>{value || "—"}</span>
          </div>
        ))}
      </div>
      <h3>Cost lines</h3>
      {cost.lines.length === 0 ? (
        <p>No data to display.</p>
      ) : (
        <table className={styles.staffLines}>
          <thead>
            <tr>
              <th scope="col">Start date</th>
              <th scope="col">End date</th>
              <th scope="col">FTE</th>
              <th scope="col">Units</th>
              {showSensitive && <th scope="col">Unit cost</th>}
              {showSensitive && <th scope="col">Total cost</th>}
            </tr>
          </thead>
          <tbody>
            {cost.lines.map((line) => (
              <tr
                id={`proposal-${id}-staff-cost-line-${line.id}`}
                key={line.id}
              >
                <td>{functions.format.dateDisplay(line.startDate, format)}</td>
                <td>{functions.format.dateDisplay(line.endDate, format)}</td>
                <td>{line.fte}</td>
                <td>{line.units}</td>
                {showSensitive && <td>{line.unitCost}</td>}
                {showSensitive && <td>{line.total}</td>}
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}
