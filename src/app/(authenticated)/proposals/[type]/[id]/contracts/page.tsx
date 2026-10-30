import { serverFunctions } from "@/server/functions";
import { functions } from "@/lib/functions";
import Link from "next/link";
import { pageIdentity } from "@/server/identity/auth/page";
import { recordIdentity } from "@/features/modules/proposals/record";
import { proposalContracts } from "@/server/modules/proposals/contracts";
import { State } from "@/components/feedback/state";
import { displayFormat } from "@/server/platform/configuration/formatting";
import { resources } from "@/server/platform/configuration/resources";
import styles from "../proposal-record.module.css";

export const metadata = { title: "Proposal Contracts" };

export default async function ProposalContracts({
  params,
  searchParams,
}: {
  params: Promise<{ type: string; id: string }>;
  searchParams: Promise<{ page?: string }>;
}) {
  const identity = recordIdentity.safeParse(await params);
  if (!identity.success)
    return <State title="Invalid proposal identity" code="BAD_REQUEST" />;
  const { type, id } = identity.data;
  await pageIdentity(`/proposals/${type}/${id}/contracts`);
  const page = Number((await searchParams).page ?? "1");
  let result: Awaited<ReturnType<typeof proposalContracts>>;
  try {
    result = await proposalContracts(type, id, page);
  } catch (error) {
    const failure = functions.errors.publicError(error);
    return (
      <State
        title={
          failure.code === "FORBIDDEN"
            ? "Access denied"
            : "Proposal Contracts unavailable"
        }
        message={failure.message}
        action={failure.action}
        code={failure.code}
      />
    );
  }
  const [format, rb] = await Promise.all([displayFormat(), resources()]);
  const base = `/proposals/${type}/${id}/contracts`;
  return (
    <section id={`proposal-${id}-contracts`} className={styles.form}>
      {result.rows.length === 0 && <p>No data to display.</p>}
      {result.rows.map((row) => (
        <article
          id={`proposal-${id}-contract-${row.contract_id}`}
          className={styles.contractCard}
          key={row.contract_id}
        >
          <strong>{row.contract_number}</strong>
          <h2>
            {result.canOpen ? (
              <Link href={`/contracts/${row.contract_id}`}>
                {row.contract_title}
              </Link>
            ) : (
              row.contract_title
            )}
          </h2>
          <div className={styles.contractBadges}>
            {row.contract_level && <span>Level : {row.contract_level}</span>}
            {row.status && <span>{row.status}</span>}
          </div>
          <div className="summary-grid">
            {[
              [
                "contract-list-contract-type",
                "Contract Type",
                row.contract_type_name,
              ],
              [
                "contract-list-reference-object",
                "Reference Object",
                row.contract_level,
              ],
              [
                "contract-list-reference-object-number",
                "Reference Object Number",
                row.object_ref_id,
              ],
              [
                "contract-list-start-date",
                "Start Date",
                row.contract_start_date
                  ? functions.format.dateDisplay(
                      row.contract_start_date,
                      format,
                    )
                  : "",
              ],
              [
                "contract-list-end-date",
                "End Date",
                row.contract_end_date
                  ? functions.format.dateDisplay(row.contract_end_date, format)
                  : "",
              ],
              [
                "contract-list-creation-date",
                "Created On",
                row.creation_date
                  ? functions.format.dateDisplay(row.creation_date, format)
                  : "",
              ],
              [
                "contract-list-last-update-date",
                "Updated On",
                row.last_update_date
                  ? functions.format.dateDisplay(row.last_update_date, format)
                  : "",
              ],
              ["contract-list-org-unit", "Org Unit", row.org_unit_name],
              [
                "contract-list-assigned-to",
                "Assigned to",
                row.assigned_to_name,
              ],
            ]
              .filter(
                ([key, , value]) =>
                  value &&
                  serverFunctions.resources.resourceVisible(
                    rb,
                    result.bundle,
                    "labels",
                    key ?? "",
                  ),
              )
              .map(([key, label, value]) => (
                <div className="summary-field" key={key}>
                  <strong>
                    {serverFunctions.resources.label(
                      rb,
                      result.bundle,
                      "labels",
                      key ?? "",
                      label ?? "",
                    )}
                  </strong>
                  <p>{value}</p>
                </div>
              ))}
          </div>
        </article>
      ))}
      <nav className={styles.pagination} aria-label="Linked Contracts pages">
        {page > 1 && <Link href={`${base}?page=${page - 1}`}>Previous</Link>}
        {result.hasMore && <Link href={`${base}?page=${page + 1}`}>Next</Link>}
      </nav>
    </section>
  );
}
