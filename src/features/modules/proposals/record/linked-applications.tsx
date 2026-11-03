import { serverFunctions } from "@/server/functions";
import { functions } from "@/lib/functions";
import { pageIdentity } from "@/server/identity/auth/page";
import { recordIdentity } from "@/features/modules/proposals/record";
import {
  proposalLinkedApplications,
  type ApplicationKind,
} from "@/server/modules/proposals/linked-applications";
import { resources } from "@/server/platform/configuration/resources";
import { displayFormat } from "@/server/platform/configuration/formatting";
import { State } from "@/components/feedback/state";
import styles from "./proposal-record.module.css";

export async function LinkedApplications({
  params,
  kind,
}: {
  params: Promise<{ type: string; id: string }>;
  kind: ApplicationKind;
}) {
  const identity = recordIdentity.safeParse(await params);
  if (!identity.success)
    return <State title="Invalid proposal identity" code="BAD_REQUEST" />;
  const { type, id } = identity.data;
  const isEthics = kind === "ETHICS";
  const segment = isEthics ? "ethics" : "due-diligence";
  await pageIdentity(`/proposals/${type}/${id}/${segment}`);
  let applications: Awaited<ReturnType<typeof proposalLinkedApplications>>;
  try {
    applications = await proposalLinkedApplications(type, id, kind);
  } catch (error) {
    const failure = functions.errors.publicError(error);
    return (
      <State
        title={
          failure.code === "FORBIDDEN"
            ? "Access denied"
            : `${isEthics ? "Proposal ethics" : "Due diligence"} unavailable`
        }
        message={failure.message}
        action={failure.action}
        code={failure.code}
      />
    );
  }
  const [rb, format] = await Promise.all([resources(), displayFormat()]);
  const prefix = isEthics ? "ethics" : "dd";
  const fields = [
    ["created-by", "Created by", "createdBy"],
    ["reviewer", "Reviewer", "reviewer"],
    ["last-updated-by", "Last Updated by", "updatedBy"],
    ["creation-date", "Created On", "created"],
    ["last-updated-date", "Last Updated On", "updated"],
    ["deadline-date", "Deadline Date", "deadline"],
    ["expiry-date", "Expiry Date", "expiry"],
    ...(isEthics ? [["ethics-type", "Ethics Type", "ethicsType"]] : []),
  ] as [string, string, keyof (typeof applications.rows)[number]][];
  return (
    <section
      id={`proposal-${id}-${segment}`}
      className={styles.linkedApplications}
    >
      {applications.rows.length === 0 ? (
        <p>No data to display.</p>
      ) : (
        applications.rows.map((row) => (
          <article
            id={`proposal-${id}-${segment}-${row.id}`}
            className={styles.linkedApplication}
            key={row.id}
          >
            <div className={styles.linkedApplicationHeading}>
              <strong>{row.reference}</strong>
              {row.status && <span>{row.status}</span>}
            </div>
            <h2>{row.title}</h2>
            <dl>
              {fields.map(([key, fallback, field]) =>
                row[field] &&
                serverFunctions.resources.resourceVisible(
                  rb,
                  applications.bundle,
                  "labels",
                  `${prefix}-list-${key}`,
                ) ? (
                  <div
                    id={`proposal-${id}-${segment}-${row.id}-${key}`}
                    key={key}
                  >
                    <dt>
                      {serverFunctions.resources.label(
                        rb,
                        applications.bundle,
                        "labels",
                        `${prefix}-list-${key}`,
                        fallback,
                      )}
                    </dt>
                    <dd>
                      {key.includes("date")
                        ? functions.format.dateDisplay(
                            String(row[field]),
                            format,
                          )
                        : row[field]}
                    </dd>
                  </div>
                ) : null,
              )}
            </dl>
          </article>
        ))
      )}
    </section>
  );
}
