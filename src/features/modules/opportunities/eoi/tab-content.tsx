import "server-only";
import { State } from "@/components/feedback/state";
import { resources, label } from "@/server/platform/configuration/resources";
import { displayFormat } from "@/server/platform/configuration/formatting";
import {
  eoiPageLock,
  type EoiRecordContext,
} from "@/server/modules/opportunities/record";
import { workflowView } from "@/server/record/approvals/workflow";
import { eoiApprovalHost } from "@/server/modules/opportunities/eoi-record/workflow";
import { ApprovalWorkflow } from "@/features/record/approvals/approval-workflow";
import { isFormTab, type EoiTab } from "@/shared/opportunities/eoi-record";
import {
  summaryEmpty,
  summaryRoles,
  summaryView,
  type OpportunityRecord,
} from "@/server/modules/opportunities/eoi-record/opportunity";
import { tabName } from "@/server/modules/opportunities/eoi-record/shell";
import { publicError } from "@/lib/errors";
import { ApplicationTab } from "./application-tab";
import { FormTab } from "./form-tab";
import { TabLock } from "./record-context";
import { Summary } from "./summary";
import { EoiObjectTab } from "./object-tabs";
import { AttachmentsTab } from "@/features/record/attachments/attachments-tab";
import styles from "./record.module.css";
const BUNDLE = "opportunities-eoi";
async function applicationTexts() {
  const rows = await resources();
  return {
    create: "Create",
    save: "Save",
    created: label(
      rows,
      BUNDLE,
      "success-msg",
      "created",
      "Application created successfully",
    ),
    updated: label(
      rows,
      BUNDLE,
      "success-msg",
      "updated",
      "Application updated successfully",
    ),
    createdNoNumber:
      "The application was created, but its number could not be read. Add its answers from the record.",
  };
}
/** The Summary tab of a record, a new application or More Info. */
export async function SummaryTab({
  opportunity,
  detail = false,
}: {
  opportunity: OpportunityRecord | null;
  detail?: boolean;
}) {
  const [rows, format, roles] = await Promise.all([
    resources(),
    displayFormat(),
    summaryRoles(),
  ]);
  return (
    <Summary
      view={
        opportunity && summaryView(opportunity, rows, roles, format, detail)
      }
      empty={summaryEmpty(rows)}
    />
  );
}
/** The Workflow tab: the shared approval workflow with the record as its host. */
async function WorkflowContent({ id }: { id: string }) {
  // The route read starts with the labels; its failure is settled here so it is never unhandled.
  const read = eoiApprovalHost(id)
    .then(workflowView)
    .then(
      (view) => ({ view }),
      (error: unknown) => ({ error }),
    );
  const [rows, result] = await Promise.all([resources(), read]);
  const name = tabName(rows, "approvals");
  if ("error" in result) {
    const e = publicError(result.error);
    return (
      <State
        id="eoi-workflow-error"
        title={`${name} unavailable`}
        message={e.message}
        action={e.action}
        code={e.code}
      />
    );
  }
  return (
    <div id="eoi-record-approvals" className={styles.tab}>
      <h2 id="eoi-record-approvals-heading">{name}</h2>
      <ApprovalWorkflow
        id="eoi-workflow"
        api={`/opportunities/eoi/${id}/workflow`}
        view={result.view}
      />
    </div>
  );
}
/** One tab of a saved application; the caller has checked the tab is one the record shows. */
export async function RecordTabContent({
  context,
  tab,
}: {
  context: EoiRecordContext;
  tab: EoiTab;
}) {
  // Labels (cached per request) load with the lock; the tab bodies below read them.
  const [lock] = await Promise.all([eoiPageLock(context, tab), resources()]);
  const r = context.request;
  const opportunityId = context.opportunity
    ? String(context.opportunity.opportunities_id)
    : null;
  const unknownLock = !lock.known && lock.locked && (
    <p id="eoi-record-lock-unknown" className={styles.notice} role="status">
      This page&apos;s lock could not be read, so it is read-only.
    </p>
  );
  let content: React.ReactNode;
  if (tab === "summary")
    content = <SummaryTab opportunity={context.opportunity} />;
  else if (tab === "application")
    content = opportunityId ? (
      <>
        {unknownLock}
        <ApplicationTab
          opportunityId={opportunityId}
          requestId={context.id}
          number={r.request_number}
          statusCode={r.status_code ?? undefined}
          lock={lock}
          texts={await applicationTexts()}
        />
      </>
    ) : (
      <State title={summaryEmpty(await resources())} />
    );
  else if (isFormTab(tab)) {
    const rows = await resources();
    content = (
      <>
        {unknownLock}
        <FormTab
          tab={tab}
          requestId={context.id}
          number={r.request_number}
          statusCode={r.status_code ?? undefined}
          lock={lock}
          texts={{
            submit: label(rows, BUNDLE, "button-labels", "submit", "Submit"),
            saved: label(
              rows,
              BUNDLE,
              "success-msg",
              "saved",
              "Response saved successfully!",
            ),
          }}
        />
      </>
    );
  } else if (tab === "attachments")
    content = (
      <AttachmentsTab host="eoi" record={context.id} id="eoi-attachments" />
    );
  else if (tab === "history" || tab === "delegation")
    content = <EoiObjectTab id={context.id} tab={tab} />;
  else content = <WorkflowContent id={context.id} />;
  return (
    <>
      <TabLock tab={tab} lock={lock} />
      {content}
    </>
  );
}
/** One tab of a new application (Summary or Application): editable, nothing locked, Create inserts the request. */
export async function NewTabContent({
  opportunity,
  tab,
}: {
  opportunity: OpportunityRecord;
  tab: "summary" | "application";
}) {
  if (tab === "summary") return <SummaryTab opportunity={opportunity} />;
  return (
    <ApplicationTab
      opportunityId={String(opportunity.opportunities_id)}
      lock={{ known: false, locked: false }}
      texts={await applicationTexts()}
    />
  );
}
