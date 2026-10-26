import Link from "next/link";
import { Suspense } from "react";
import { Skeleton } from "@/components/feedback/skeleton";
import { pageIdentity } from "@/server/identity/auth/page";
import { canCreateContract } from "@/server/contracts/service";
import {
  contractTypeChoices,
  contractOrgChoices,
  contractRelationChoices,
  contractDeadlineChoices,
  contractDynamicForms,
} from "@/server/contracts/lookups";
import {
  resources,
  label,
  resourceVisible,
} from "@/server/platform/configuration/resources";
import { State } from "@/components/feedback/state";
import { publicError } from "@/lib/errors";
import styles from "../contracts.module.css";
import { DependentFields } from "./dependent-fields";
import { AssigneeField } from "./assignee-field";
import { DynamicFields } from "./dynamic-fields";
import { DeadlineFields } from "./deadline-fields";

export const metadata = { title: "New Contract" };

export default async function NewContract() {
  await pageIdentity("/contracts/new");
  return (
    <main className={styles.createPage}>
      <div className={styles.createTop}>
        <Link href="/contracts" prefetch={false}>
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
  let failure: ReturnType<typeof publicError> | null = null;
  try {
    access = await canCreateContract();
    if (access) rb = await resources();
  } catch (error) {
    failure = publicError(error);
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
    label(rb, "contract", "labels", key, fallback);
  const visible = (key: string) =>
    resourceVisible(rb, "contract", "labels", key);
  return (
    <section
      className={styles.createPanel}
      aria-labelledby="contract-detail-heading"
    >
      <h2 id="contract-detail-heading">Contract Detail</h2>
      <form className={styles.createForm}>
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
              <input name="contract_start_date" type="date" required />
            </label>
          )}
          {visible("summary-end-date") && (
            <label>
              {field("summary-end-date", "End date")} <b>*</b>
              <input name="contract_end_date" type="date" required />
            </label>
          )}
          {visible("summary-deadline-date") && (
            <label>
              {field("summary-deadline-date", "Deadline date")}
              <input name="deadline_date" type="date" />
            </label>
          )}
        </div>
        <section className={styles.createSection}>
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
        <section className={styles.createSection}>
          <h2>Contract Document</h2>
          <fieldset>
            <legend>Use standard template</legend>
            <label>
              <input
                type="radio"
                name="uses_standard_templ"
                value="Y"
                defaultChecked
              />{" "}
              Yes
            </label>
            <label>
              <input type="radio" name="uses_standard_templ" value="N" /> No
            </label>
          </fieldset>
          <button type="button" disabled>
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
          <button type="submit" disabled>
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
    const failure = publicError(error);
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
    label(rb, "contract", "labels", key, fallback);
  const visible = (key: string) =>
    resourceVisible(rb, "contract", "labels", key);
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
    const failure = publicError(error);
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
    const failure = publicError(error);
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
