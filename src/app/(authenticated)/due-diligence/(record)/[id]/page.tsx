import Link from "next/link";
import { authenticate } from "@/server/identity/session/service";
import { ApprovalWorkflow } from "@/features/record/approvals/approval-workflow";
import { dueDiligenceApprovalHost } from "@/server/modules/due-diligence/record/approval";
import { workflowView } from "@/server/record/approvals/workflow";
import { ResponsesTab } from "@/features/modules/due-diligence/record/responses-tab";
import { pageIdentity } from "@/server/identity/auth/page";
import {
  dueDiligenceHistoryHost,
  dueDiligenceRecord,
} from "@/server/modules/due-diligence/record";
import { historyView } from "@/server/record/objects/history";
import { ObjectHistory } from "@/features/record/objects/object-history";
import { AttachmentsTab } from "@/features/record/attachments/attachments-tab";
import { dueDiligenceShell } from "@/server/modules/due-diligence/record/shell";
import { dueDiligenceFinalizeState } from "@/server/modules/due-diligence/record/finalize";
import { dueDiligencePrintOptions } from "@/server/modules/due-diligence/record/print";
import { dueDiligenceVersions } from "@/server/modules/due-diligence/record/versions";
import { dueDiligenceAutoSubmitAvailable } from "@/server/modules/due-diligence/record/submit";
import { resources } from "@/server/platform/configuration/resources";
import { dashboardRoles } from "@/server/platform/configuration/service";
import { serverFunctions } from "@/server/functions";
import { State } from "@/components/feedback/state";
import { DueDiligenceRecordShell } from "@/features/modules/due-diligence/record/record-shell";
import { OverviewTab } from "@/features/modules/due-diligence/record/overview-tab";
import { functions } from "@/lib/functions";

export const metadata = { title: "Due Diligence application" };

/** The record reads its access view from the query (legacy passes the listing tab), so the page holds the shell. */
export default async function DueDiligenceRecord({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{
    access?: string;
    tab?: string;
    respondent?: string;
    version?: string;
  }>;
}) {
  const [{ id }, { access, tab, respondent, version }] = await Promise.all([
    params,
    searchParams,
  ]);
  await pageIdentity(`/due-diligence/${id}`);
  const rowsRead = resources();
  rowsRead.catch(() => undefined);
  let model;
  let record;
  try {
    record = await dueDiligenceRecord(id, access);
    model = dueDiligenceShell(record, await rowsRead);
  } catch (error) {
    const e = functions.errors.publicError(error);
    return (
      <State
        title="Due Diligence application unavailable"
        message={
          e.code === "FORBIDDEN"
            ? "This application could not be opened with your current access."
            : e.message
        }
        action={e.action}
        code={e.code}
      />
    );
  }
  const current = tab ?? model.tabs[0]?.key;
  if (!current || !model.tabs.some((item) => item.key === current))
    return (
      <State
        title="Due Diligence section unavailable"
        message="You do not have access to this section."
        code="FORBIDDEN"
      />
    );
  const identity = [
    "duediligence-responses",
    "duediligence-approvals",
  ].includes(current)
    ? await authenticate()
    : null;
  const availableRespondents = record.respondents.filter(
    (row) =>
      record.access !== "RESPONDENT_ACCESS" ||
      row.personId === String(identity?.user.personId),
  );
  const selectedRespondent = respondent
    ? availableRespondents.find((row) => row.id === respondent)
    : availableRespondents[0];
  if (current === "duediligence-responses" && !selectedRespondent)
    return (
      <State
        title="Response unavailable"
        message="You do not have access to this response."
        code="FORBIDDEN"
      />
    );
  const versions =
    current === "duediligence-responses" && record.statusCode !== "DRFT"
      ? await dueDiligenceVersions(id, record.access)
      : [];
  const chosenVersion =
    version && /^[1-9]\d*$/.test(version) ? Number(version) : undefined;
  if (
    version &&
    (!chosenVersion || !versions.some((row) => row.value === chosenVersion))
  )
    return <State title="Response version unavailable" code="FORBIDDEN" />;
  const historicalVersion =
    chosenVersion !== undefined && chosenVersion !== versions[0]?.value
      ? chosenVersion
      : undefined;
  const finalizeState =
    selectedRespondent &&
    record.statusCode !== "DRFT" &&
    record.rights[current]?.pageId
      ? await dueDiligenceFinalizeState(
          record,
          selectedRespondent.id,
          current,
        ).then((state) => ({
          ...state,
          finalizedPages: model.tabs
            .filter((tab) =>
              state.finalizedPageIds.includes(
                record.rights[tab.key]?.pageId ?? -1,
              ),
            )
            .map((tab) => tab.key),
        }))
      : undefined;
  const printOptions =
    current === "duediligence-responses" &&
    selectedRespondent &&
    record.statusCode !== "DRFT"
      ? await dueDiligencePrintOptions(record, selectedRespondent.id).catch(
          () => [],
        )
      : [];
  const canLink =
    record.statusCode === "COMPLETED" &&
    serverFunctions.permissions.pageAccess(
      await dashboardRoles(),
      "due-diligence-link",
    ).read;
  const canAutoSubmit =
    current === "duediligence-responses" && selectedRespondent
      ? await dueDiligenceAutoSubmitAvailable(record, selectedRespondent.id)
      : false;
  const approval =
    current === "duediligence-approvals"
      ? await dueDiligenceApprovalHost(id, respondent, access)
          .then(workflowView)
          .then(
            (view) => ({ view }),
            (error: unknown) => ({
              failure: functions.errors.publicError(error),
            }),
          )
      : null;
  const history =
    current === "duediligence-history"
      ? await dueDiligenceHistoryHost(id)
          .then(historyView)
          .then(
            (view) => ({ view }),
            (error: unknown) => ({
              failure: functions.errors.publicError(error),
            }),
          )
      : null;
  return (
    <DueDiligenceRecordShell
      model={model}
      current={current}
      participantId={selectedRespondent?.id ?? record.respondents[0]?.id}
      finalizeState={finalizeState}
      printOptions={printOptions}
      canLink={canLink}
      canAutoSubmit={canAutoSubmit}
    >
      {current === "duediligence-history" ? (
        history && "view" in history ? (
          <ObjectHistory
            id="due-diligence-history"
            host={{ host: "due-diligence", record: id }}
            view={history.view}
          />
        ) : (
          <State
            title="History unavailable"
            message={
              history && "failure" in history
                ? history.failure.message
                : "The history could not be loaded."
            }
            code="ERROR"
          />
        )
      ) : current === "duediligence-approvals" ? (
        approval && "view" in approval ? (
          <section id="due-diligence-approvals">
            {availableRespondents.length > 1 && (
              <nav
                id="due-diligence-approval-people"
                aria-label={model.responses.participants}
              >
                {availableRespondents.map((row) => (
                  <Link
                    key={row.id}
                    id={`due-diligence-approval-person-${row.id}`}
                    prefetch={false}
                    href={`/due-diligence/${id}?access=${record.access}&tab=duediligence-approvals&respondent=${row.id}`}
                  >
                    {row.name || row.id}
                  </Link>
                ))}
              </nav>
            )}
            <ApprovalWorkflow
              id="due-diligence-workflow"
              api={`/due-diligence/${id}/workflow/${record.access}/${respondent ?? availableRespondents[0]?.id ?? ""}`}
              view={approval.view}
            />
          </section>
        ) : (
          <State
            title="Approvals unavailable"
            message={
              approval && "failure" in approval
                ? approval.failure.message
                : "The approval route could not be loaded."
            }
            code="ERROR"
          />
        )
      ) : current === "duediligence-responses" && selectedRespondent ? (
        <ResponsesTab
          setupId={id}
          respondent={selectedRespondent}
          respondents={availableRespondents}
          access={record.access}
          editable={
            record.access === "RESPONDENT_ACCESS" &&
            selectedRespondent.statusCode === "DRFT" &&
            record.rights["duediligence-responses"]?.edit === true &&
            historicalVersion === undefined
          }
          versions={versions}
          selectedVersion={chosenVersion}
          historicalVersion={historicalVersion}
          texts={model.responses}
        />
      ) : current === "duediligence-attachments" ? (
        <AttachmentsTab
          host="due-diligence"
          record={id}
          id="due-diligence-attachments"
        />
      ) : current === "duediligence-general-overview" ? (
        <OverviewTab model={model} />
      ) : (
        <State
          title="Due Diligence section unavailable"
          message="This section could not be loaded."
          code="ERROR"
        />
      )}
    </DueDiligenceRecordShell>
  );
}
