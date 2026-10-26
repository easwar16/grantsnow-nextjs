import Link from "next/link";
import { Suspense } from "react";
import {
  contractComments,
  contractAudits,
  loadContract,
} from "@/server/contracts/service";
import type { ContractDetail } from "@/features/contracts/types";
import { State } from "@/components/feedback/state";
import { Skeleton } from "@/components/feedback/skeleton";
import { publicError } from "@/lib/errors";
import { dateDisplay } from "@/lib/format";
import { displayFormat } from "@/server/platform/configuration/formatting";
import { DynamicForm } from "@/features/record/dynamic-form/dynamic-form";
import { Icon } from "@/components/ui/icon";
import {
  label,
  resourceVisible,
  resources,
} from "@/server/platform/configuration/resources";
import styles from "../contracts.module.css";

export async function ContractSummaryContent({
  id,
  panel,
  event,
}: {
  id: string;
  panel?: "comments" | "audit";
  event: ReturnType<
    typeof import("@/server/contracts/service").parseContractAuditEvent
  >;
}) {
  let contract;
  try {
    contract = await loadContract(id);
  } catch (error) {
    const e = publicError(error);
    return (
      <State
        title={
          e.code === "FORBIDDEN" ? "Access denied" : "Contract unavailable"
        }
        message={e.message}
        action={e.action}
        code={e.code}
      />
    );
  }
  return (
    <>
      <Suspense
        fallback={
          <Skeleton kind="table" count={2} label="Loading Contract deadlines" />
        }
      >
        <SummaryDeadlines contract={contract} />
      </Suspense>
      <Suspense
        fallback={
          <Skeleton kind="lines" count={2} label="Loading Contract document" />
        }
      >
        <SummaryDocument contract={contract} />
      </Suspense>
      <DynamicForm
        objectType="CONTRACT"
        slot="CONTRACTS-SUMMARY"
        parentId={id}
        objectId={id}
        objectNumber={contract.number}
        editable={false}
      />
      {panel && (
        <Suspense fallback={<DrawerLoading panel={panel} id={id} />}>
          <SummaryDrawer id={id} panel={panel} event={event} />
        </Suspense>
      )}
    </>
  );
}

async function SummaryDeadlines({ contract }: { contract: ContractDetail }) {
  const format = await displayFormat();
  return (
    <section className={styles.summary} aria-label="Deadline Date">
      <h2>Deadline Date</h2>
      <table>
        <thead>
          <tr>
            <th>Deadline Type</th>
            <th>Deadline Description</th>
            <th>Deadline date</th>
            <th>Remind me before</th>
          </tr>
        </thead>
        <tbody>
          {contract.deadlines.length ? (
            contract.deadlines.map((deadline, index) => (
              <tr key={`${deadline.date}-${index}`}>
                <td>{deadline.type}</td>
                <td>{deadline.description}</td>
                <td>{dateDisplay(deadline.date, format)}</td>
                <td>{deadline.reminderDays}</td>
              </tr>
            ))
          ) : (
            <tr>
              <td colSpan={4}>No data to display.</td>
            </tr>
          )}
        </tbody>
      </table>
    </section>
  );
}

async function SummaryDocument({ contract }: { contract: ContractDetail }) {
  const rb = await resources();
  const id = contract.id;
  return (
    <section className={styles.summary} aria-label="Contract Document">
      <h2>Contract Document</h2>
      <div className={styles.documentActions}>
        {resourceVisible(
          rb,
          "contract",
          "labels",
          "summary-use-standard-template",
        ) && (
          <fieldset className={styles.documentChoice} disabled>
            <legend>
              {label(
                rb,
                "contract",
                "labels",
                "summary-use-standard-template",
                "Use standard template",
              )}
            </legend>
            <div>
              <label>
                <input
                  type="radio"
                  checked={contract.usesStandardTemplate === true}
                  readOnly
                />{" "}
                Yes
              </label>
              <label>
                <input
                  type="radio"
                  checked={contract.usesStandardTemplate === false}
                  readOnly
                />{" "}
                No
              </label>
            </div>
          </fieldset>
        )}
        <a href={`/api/contracts/${id}/document?kind=tags`}>
          <span aria-hidden="true">{"{ }"}</span>{" "}
          {label(
            rb,
            "contract",
            "labels",
            "summary-get-placeholder-tags",
            "Get Placeholder Tags",
          )}
        </a>
        {contract.usesStandardTemplate &&
          contract.document.typeCode &&
          resourceVisible(
            rb,
            "contract",
            "labels",
            "summary-download-standard-template",
          ) && (
            <a href={`/api/contracts/${id}/document?kind=template`}>
              <Icon name="download" />{" "}
              {label(
                rb,
                "contract",
                "labels",
                "summary-download-standard-template",
                "Download Standard Template",
              )}
            </a>
          )}
        {resourceVisible(
          rb,
          "contract",
          "labels",
          "summary-view-contracts",
        ) && (
          <a href={`/api/contracts/${id}/document?kind=contract`}>
            <Icon name="view" />{" "}
            {label(
              rb,
              "contract",
              "labels",
              "summary-view-contracts",
              "View contract",
            )}
          </a>
        )}
      </div>
    </section>
  );
}

function DrawerLoading({
  panel,
  id,
}: {
  panel: "comments" | "audit";
  id: string;
}) {
  return (
    <div className={styles.drawerBackdrop}>
      <aside
        className={styles.recordDrawer}
        aria-label={panel === "comments" ? "Comments" : "Audit Trail"}
      >
        <header>
          <h2>{panel === "comments" ? "Comments" : "Audit Trail"}</h2>
          <Link
            href={`/contracts/${id}`}
            prefetch={false}
            aria-label="Close drawer"
          >
            ×
          </Link>
        </header>
        <Skeleton
          kind="list"
          count={2}
          label={`Loading ${panel === "comments" ? "Comments" : "Audit Trail"}`}
        />
      </aside>
    </div>
  );
}

async function SummaryDrawer({
  id,
  panel,
  event,
}: {
  id: string;
  panel: "comments" | "audit";
  event: ReturnType<
    typeof import("@/server/contracts/service").parseContractAuditEvent
  >;
}) {
  let drawer:
    | Awaited<ReturnType<typeof contractComments>>
    | Awaited<ReturnType<typeof contractAudits>> = [];
  let drawerFailure: ReturnType<typeof publicError> | null = null;
  try {
    drawer =
      panel === "comments"
        ? await contractComments(id)
        : await contractAudits(id, event);
  } catch (error) {
    drawerFailure = publicError(error);
  }
  return (
    <div className={styles.drawerBackdrop}>
      <aside
        className={styles.recordDrawer}
        aria-label={panel === "comments" ? "Comments" : "Audit Trail"}
      >
        <header>
          <h2>{panel === "comments" ? "Comments" : "Audit Trail"}</h2>
          <Link
            href={`/contracts/${id}`}
            prefetch={false}
            aria-label="Close drawer"
          >
            ×
          </Link>
        </header>
        {drawerFailure ? (
          <p role="status">{drawerFailure.message}</p>
        ) : panel === "comments" ? (
          drawer.length ? (
            drawer.map(
              (item) =>
                "html" in item && (
                  <article key={item.id} className={styles.drawerCard}>
                    <div dangerouslySetInnerHTML={{ __html: item.html }} />
                    <small>
                      {item.author} {item.date}
                    </small>
                  </article>
                ),
            )
          ) : (
            <p>No data to display.</p>
          )
        ) : (
          <>
            <nav aria-label="Audit event">
              {(
                [
                  "",
                  "INSERTED",
                  "UPDATED",
                  "NEW VERSION CREATED",
                  "DELETED",
                ] as const
              ).map((item) => (
                <Link
                  key={item}
                  href={`/contracts/${id}?panel=audit${item ? `&event=${encodeURIComponent(item)}` : ""}`}
                  aria-current={event === item ? "page" : undefined}
                  prefetch={false}
                >
                  {item || "ALL"}
                </Link>
              ))}
            </nav>
            {drawer.length ? (
              drawer.map(
                (item) =>
                  "fields" in item && (
                    <article key={item.id} className={styles.drawerCard}>
                      <strong>{item.event}</strong>{" "}
                      <span>
                        {item.name} {item.date}
                      </span>
                      <dl>
                        {item.fields.map((field, index) => (
                          <div key={index}>
                            <dt>{field.name}</dt>
                            <dd>
                              {field.oldValue ? `${field.oldValue} → ` : ""}
                              {field.value}
                            </dd>
                          </div>
                        ))}
                      </dl>
                    </article>
                  ),
              )
            ) : (
              <p>No data to display.</p>
            )}
          </>
        )}
      </aside>
    </div>
  );
}
