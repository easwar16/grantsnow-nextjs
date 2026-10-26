import { Suspense } from "react";
import { loadContract } from "@/server/contracts/service";
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

export async function ContractSummaryContent({ id }: { id: string }) {
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
