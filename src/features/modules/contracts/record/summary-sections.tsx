import { Suspense } from "react";
import { loadContract } from "@/server/modules/contracts/service";
import type { ContractDetail } from "@/features/modules/contracts/types";
import { State } from "@/components/feedback/state";
import { Skeleton } from "@/components/feedback/skeleton";
import { displayFormat } from "@/server/platform/configuration/formatting";
import { DynamicForm } from "@/features/record/dynamic-form/dynamic-form";
import { Icon } from "@/components/ui/icon";
import { resources } from "@/server/platform/configuration/resources";
import { DocumentLink } from "./document-link";
import styles from "../contracts.module.css";
import { functions } from "@/lib/functions";
import { serverFunctions } from "@/server/functions";

export async function ContractSummaryContent({ id }: { id: string }) {
  let contract;
  try {
    contract = await loadContract(id);
  } catch (error) {
    const e = functions.errors.publicError(error);
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
    <section
      id={`contract-${contract.id}-deadlines`}
      className={styles.summary}
      aria-label="Deadline Date"
    >
      <h2>Deadline Date</h2>
      <table id={`contract-${contract.id}-deadlines-table`}>
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
                <td>{functions.format.dateDisplay(deadline.date, format)}</td>
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
    <section
      id={`contract-${id}-document`}
      className={styles.summary}
      aria-label="Contract Document"
    >
      <h2>Contract Document</h2>
      <div className={styles.documentActions}>
        {serverFunctions.resources.resourceVisible(
          rb,
          "contract",
          "labels",
          "summary-use-standard-template",
        ) && (
          <fieldset
            id={`contract-${id}-standard-template`}
            className={styles.documentChoice}
            disabled
          >
            <legend>
              {serverFunctions.resources.label(
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
                  id={`contract-${id}-standard-template-yes`}
                  type="radio"
                  checked={contract.usesStandardTemplate === true}
                  readOnly
                />{" "}
                Yes
              </label>
              <label>
                <input
                  id={`contract-${id}-standard-template-no`}
                  type="radio"
                  checked={contract.usesStandardTemplate === false}
                  readOnly
                />{" "}
                No
              </label>
            </div>
          </fieldset>
        )}
        <DocumentLink id={id} kind="tags">
          <span aria-hidden="true">{"{ }"}</span>{" "}
          {serverFunctions.resources.label(
            rb,
            "contract",
            "labels",
            "summary-get-placeholder-tags",
            "Get Placeholder Tags",
          )}
        </DocumentLink>
        {contract.usesStandardTemplate &&
          contract.document.typeCode &&
          serverFunctions.resources.resourceVisible(
            rb,
            "contract",
            "labels",
            "summary-download-standard-template",
          ) && (
            <DocumentLink id={id} kind="template">
              <Icon name="download" />{" "}
              {serverFunctions.resources.label(
                rb,
                "contract",
                "labels",
                "summary-download-standard-template",
                "Download Standard Template",
              )}
            </DocumentLink>
          )}
        {serverFunctions.resources.resourceVisible(
          rb,
          "contract",
          "labels",
          "summary-view-contracts",
        ) && (
          <DocumentLink id={id} kind="contract">
            <Icon name="view" />{" "}
            {serverFunctions.resources.label(
              rb,
              "contract",
              "labels",
              "summary-view-contracts",
              "View contract",
            )}
          </DocumentLink>
        )}
      </div>
    </section>
  );
}
