import "server-only";
import { State } from "@/components/feedback/state";
import { resources, label } from "@/server/platform/configuration/resources";
import {
  awardPageLock,
  type AwardRecordContext,
} from "@/server/modules/awards/record";
import { workflowView } from "@/server/record/approvals/workflow";
import { historyView } from "@/server/record/objects/history";
import { delegationView } from "@/server/record/objects/delegations";
import {
  awardApprovalHost,
  awardDelegationHost,
  awardHistoryHost,
} from "@/server/modules/awards/record/objects";
import { tabName } from "@/server/modules/awards/record/shell";
import { ApprovalWorkflow } from "@/features/record/approvals/approval-workflow";
import { AttachmentsTab } from "@/features/record/attachments/attachments-tab";
import { ObjectHistory } from "@/features/record/objects/object-history";
import { ObjectDelegations } from "@/features/record/objects/object-delegations";
import { isFormTab, type AwardTab } from "@/shared/awards/award-record";
import { publicError } from "@/lib/errors";
import { AwardFormTab } from "./form-tab";
import { HeaderTab } from "./header-tab";
import { BudgetTab } from "./budget-tab";
import { ReportTab } from "./report-tab";
import { DueDiligenceTab } from "./due-diligence-tab";
import { ProjectsTab } from "./projects-tab";
import { projectsView } from "@/server/modules/awards/record/projects";
import {
  installmentsView,
  milestonesView,
} from "@/server/modules/awards/record/installments";
import { InstallmentsTab } from "./installments-tab";
import { CreditTab } from "./credit-tab";
import { creditView } from "@/server/modules/awards/record/credit";
import { MilestonesTab } from "./milestones-tab";
import { dueDiligenceView } from "@/server/modules/awards/record/due-diligence";
import { reportView } from "@/server/modules/awards/record/report";
import { budgetView } from "@/server/modules/awards/record/budget";
import { headerView } from "@/server/modules/awards/record/header";
import { displayFormat } from "@/server/platform/configuration/formatting";
import { AwardTabLock } from "./record-shell";
import styles from "@/features/record/shell/record-tab.module.css";

const BUNDLE = "award";

/** A shared panel's read, settled first so only its failure (never the render) becomes the error state. */
async function settle<T>(read: Promise<T>) {
  return read.then(
    (view) => ({ view }) as const,
    (error: unknown) => ({ error }) as const,
  );
}
function failed(id: string, title: string, error: unknown) {
  const e = publicError(error);
  return (
    <State
      id={`${id}-error`}
      title={`${title} unavailable`}
      message={e.message}
      action={e.action}
      code={e.code}
    />
  );
}

/** One tab of an award record; the caller has checked the tab is one the record shows. */
export async function AwardTabContent({
  context,
  tab,
}: {
  context: AwardRecordContext;
  tab: AwardTab;
}) {
  const [lock, rows] = await Promise.all([
    awardPageLock(context, tab),
    resources(),
  ]);
  const id = context.id;
  const name = tabName(rows, tab);
  const status = context.award.award_status ?? "";
  const unknownLock = !lock.known && lock.locked && (
    <p id="award-record-lock-unknown" className={styles.notice} role="status">
      This page&apos;s lock could not be read, so it is read-only.
    </p>
  );
  let content: React.ReactNode;
  if (tab === "header") {
    const [result, format] = await Promise.all([
      settle(headerView(id)),
      displayFormat(),
    ]);
    content =
      "error" in result ? (
        failed("award-header", name, result.error)
      ) : (
        <>
          {unknownLock}
          <HeaderTab
            key={JSON.stringify(result.view.values)}
            view={result.view}
            lock={lock}
            format={format}
          />
        </>
      );
  } else if (tab === "budget-periods") {
    const [result, format] = await Promise.all([
      settle(budgetView(id)),
      displayFormat(),
    ]);
    content =
      "error" in result ? (
        failed("award-budget", name, result.error)
      ) : (
        <>
          {unknownLock}
          <BudgetTab view={result.view} format={format} />
        </>
      );
  } else if (tab === "report") {
    const [result, format] = await Promise.all([
      settle(reportView(id)),
      displayFormat(),
    ]);
    content =
      "error" in result ? (
        failed("award-report", name, result.error)
      ) : (
        <ReportTab view={result.view} format={format} />
      );
  } else if (tab === "projects") {
    const [result, format] = await Promise.all([
      settle(projectsView(id)),
      displayFormat(),
    ]);
    content =
      "error" in result ? (
        failed("award-projects", name, result.error)
      ) : (
        <>
          {unknownLock}
          <ProjectsTab view={result.view} format={format} />
        </>
      );
  } else if (tab === "due-diligence") {
    const [result, format] = await Promise.all([
      settle(dueDiligenceView(id)),
      displayFormat(),
    ]);
    content =
      "error" in result ? (
        failed("award-dd", name, result.error)
      ) : (
        <DueDiligenceTab view={result.view} format={format} />
      );
  } else if (isFormTab(tab))
    content = (
      <>
        {unknownLock}
        <AwardFormTab
          tab={tab}
          awardId={id}
          number={context.award.award_number ?? id}
          statusCode={status}
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
  else if (tab === "attachments")
    content = (
      <AttachmentsTab host="award" record={id} id="award-attachments" />
    );
  else if (tab === "approvals") {
    const result = await settle(awardApprovalHost(id).then(workflowView));
    content =
      "error" in result ? (
        failed("award-workflow", name, result.error)
      ) : (
        <div id="award-record-approvals" className={styles.tab}>
          <ApprovalWorkflow
            id="award-workflow"
            api={`/awards/${id}/workflow`}
            view={result.view}
          />
        </div>
      );
  } else if (tab === "history") {
    const result = await settle(awardHistoryHost(id).then(historyView));
    content =
      "error" in result ? (
        failed("award-history", name, result.error)
      ) : (
        <ObjectHistory
          id="award-history"
          host={{ host: "award", record: id }}
          view={result.view}
        />
      );
  } else if (tab === "delegation") {
    const result = await settle(awardDelegationHost(id).then(delegationView));
    content =
      "error" in result ? (
        failed("award-delegation", name, result.error)
      ) : (
        <ObjectDelegations
          id="award-delegation"
          host={{ host: "award", record: id }}
          view={result.view}
        />
      );
  } else if (tab === "credit-allocation") {
    const [result, format] = await Promise.all([
      settle(creditView(id)),
      displayFormat(),
    ]);
    content =
      "error" in result ? (
        failed("award-credit", name, result.error)
      ) : (
        <>
          {unknownLock}
          <CreditTab view={result.view} format={format} />
        </>
      );
  } else if (tab === "installments") {
    const [result, format] = await Promise.all([
      settle(installmentsView(id)),
      displayFormat(),
    ]);
    content =
      "error" in result ? (
        failed("award-installments", name, result.error)
      ) : (
        <InstallmentsTab view={result.view} format={format} />
      );
  } else if (tab === "milestones") {
    const result = await settle(milestonesView(id));
    content =
      "error" in result ? (
        failed("award-milestones", name, result.error)
      ) : (
        <MilestonesTab view={result.view} />
      );
  } else
    content = (
      <div id={`award-record-${tab}`} className={styles.placeholder}>
        <h2>{name}</h2>
        <p>This page has not been rebuilt yet.</p>
      </div>
    );
  return (
    <>
      <AwardTabLock tab={tab} lock={lock} />
      {content}
    </>
  );
}
