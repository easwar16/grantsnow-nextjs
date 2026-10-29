import Link from "next/link";
import { Suspense } from "react";
import { Skeleton } from "@/components/feedback/skeleton";
import { pageIdentity } from "@/server/identity/auth/page";
import { canCreateContract } from "@/server/modules/contracts/service";
import {
  contractTypeChoices,
  contractOrgChoices,
  contractRelationChoices,
  contractDeadlineChoices,
  contractDynamicForms,
} from "@/server/modules/contracts/lookups";
import { resources } from "@/server/platform/configuration/resources";
import { State } from "@/components/feedback/state";
import styles from "@/features/modules/contracts/contracts.module.css";
import { DependentFields } from "@/features/modules/contracts/new/dependent-fields";
import { AssigneeField } from "@/features/modules/contracts/new/assignee-field";
import { DynamicFields } from "@/features/modules/contracts/new/dynamic-fields";
import { DeadlineFields } from "@/features/modules/contracts/new/deadline-fields";
import { functions } from "@/lib/functions";
import { serverFunctions } from "@/server/functions";

export const metadata = { title: "New Contract" };

export default async function NewContract() {
  await pageIdentity("/contracts/new");
  return (
    <main className={styles.createPage}>
      <div className={styles.createTop}>
        <Link id="contract-new-back" href="/contracts" prefetch={false}>
          List
        </Link>
        <h1>Contract Detail</h1>
        <span className={styles.createTag}>＋ Contract Detail</span>
      </div>
      <Suspense
        fallback={
          <Skeleton kind="lines" count={7} label="Loading New Contract form" />
        }
      >
        <NewContractForm />
      </Suspense>
    </main>
  );
}

async function NewContractForm() {
  let access = false;
  let rb: Awaited<ReturnType<typeof resources>> | null = null;
  let failure: ReturnType<typeof functions.errors.publicError> | null = null;
  try {
    access = await canCreateContract();
    if (access) rb = await resources();
  } catch (error) {
    failure = functions.errors.publicError(error);
  }
  if (failure)
    return (
      <State
        title="New Contract unavailable"
        message={failure.message}
        action={failure.action}
        code={failure.code}
      />
    );
  if (!access || !rb)
    return (
      <State
        title="Access denied"
        message="New Contract access has not been granted."
        code="FORBIDDEN"
      />
    );
  const field = (key: string, fallback: string) =>
    serverFunctions.resources.label(rb, "contract", "labels", key, fallback);
  const visible = (key: string) =>
    serverFunctions.resources.resourceVisible(rb, "contract", "labels", key);
  return (
    <section
      id="contract-new"
      className={styles.createPanel}
      aria-labelledby="contract-detail-heading"
    >
      <h2 id="contract-detail-heading">Contract Detail</h2>
      <form id="contract-new-form" className={styles.createForm}>
        <div className={styles.createGrid}>
          <Suspense
            fallback={
              <Skeleton
                kind="lines"
                count={5}
                label="Loading Contract type and relation choices"
              />
            }
          >
            <CreateDependentFields rb={rb} />
          </Suspense>
          {visible("summary-assigned-to") && (
            <AssigneeField
              label={field("summary-assigned-to", "Assigned To")}
            />
          )}
          {visible("summary-contract-title") && (
            <label>
              {field("summary-contract-title", "Contract Title")} <b>*</b>
              <input
                id="contract-new-title"
                name="contract_title"
                required
                maxLength={200}
                placeholder="Enter Contract Title"
              />
            </label>
          )}
          {visible("summary-start-date") && (
            <label>
              {field("summary-start-date", "Start date")} <b>*</b>
              <input
                id="contract-new-start"
                name="contract_start_date"
                type="date"
                required
              />
            </label>
          )}
          {visible("summary-end-date") && (
            <label>
              {field("summary-end-date", "End date")} <b>*</b>
              <input
                id="contract-new-end"
                name="contract_end_date"
                type="date"
                required
              />
            </label>
          )}
          {visible("summary-deadline-date") && (
            <label>
              {field("summary-deadline-date", "Deadline date")}
              <input
                id="contract-new-deadline"
                name="deadline_date"
                type="date"
              />
            </label>
          )}
        </div>
        <section id="contract-new-deadlines" className={styles.createSection}>
          <Suspense
            fallback={
              <Skeleton
                kind="table"
                count={2}
                label="Loading Contract deadlines"
              />
            }
          >
            <CreateDeadlineFields />
          </Suspense>
        </section>
        <section id="contract-new-document" className={styles.createSection}>
          <h2>Contract Document</h2>
          <fieldset id="contract-new-standard-template">
            <legend>Use standard template</legend>
            <label>
              <input
                id="contract-new-standard-template-yes"
                type="radio"
                name="uses_standard_templ"
                value="Y"
                defaultChecked
              />{" "}
              Yes
            </label>
            <label>
              <input
                id="contract-new-standard-template-no"
                type="radio"
                name="uses_standard_templ"
                value="N"
              />{" "}
              No
            </label>
          </fieldset>
          <button type="button" id="contract-new-placeholder-tags" disabled>
            Get Placeholder Tags
          </button>
        </section>
        <Suspense
          fallback={
            <Skeleton
              kind="lines"
              count={4}
              label="Loading Contract dynamic fields"
            />
          }
        >
          <CreateDynamicFields />
        </Suspense>
        <div className={styles.createActions}>
          <button type="submit" id="contract-new-create" disabled>
            Create
          </button>
        </div>
      </form>
    </section>
  );
}

async function CreateDependentFields({
  rb,
}: {
  rb: Awaited<ReturnType<typeof resources>>;
}) {
  let choices;
  try {
    choices = await Promise.all([
      contractTypeChoices(),
      contractRelationChoices(),
      contractOrgChoices(),
    ]);
  } catch (error) {
    const failure = functions.errors.publicError(error);
    return (
      <State
        title="Contract choices unavailable"
        message={failure.message}
        action={failure.action}
        code={failure.code}
      />
    );
  }
  const [types, relations, orgs] = choices;
  const field = (key: string, fallback: string) =>
    serverFunctions.resources.label(rb, "contract", "labels", key, fallback);
  const visible = (key: string) =>
    serverFunctions.resources.resourceVisible(rb, "contract", "labels", key);
  return (
    <DependentFields
      types={types}
      relations={relations}
      orgs={orgs}
      labels={{
        type: field("summary-contract-type", "Contract Type"),
        relation: field(
          "summary-contract-relation-type",
          "Contract Relation Type",
        ),
        item: field("summary-relation-item", "Relation Item"),
        template: field("summary-contract-template", "Contract template"),
        org: field("summary-org-unit", "Org Unit"),
      }}
      visible={{
        type: visible("summary-contract-type"),
        relation: visible("summary-contract-relation-type"),
        item: visible("summary-relation-item"),
        template: visible("summary-contract-template"),
        org: visible("summary-org-unit"),
      }}
    />
  );
}

async function CreateDeadlineFields() {
  let types;
  try {
    types = await contractDeadlineChoices();
  } catch (error) {
    const failure = functions.errors.publicError(error);
    return (
      <State
        title="Deadline choices unavailable"
        message={failure.message}
        action={failure.action}
        code={failure.code}
      />
    );
  }
  return <DeadlineFields types={types} />;
}

async function CreateDynamicFields() {
  let forms;
  try {
    forms = await contractDynamicForms();
  } catch (error) {
    const failure = functions.errors.publicError(error);
    return (
      <State
        title="Contract dynamic fields unavailable"
        message={failure.message}
        action={failure.action}
        code={failure.code}
      />
    );
  }
  return <DynamicFields forms={forms} />;
}
