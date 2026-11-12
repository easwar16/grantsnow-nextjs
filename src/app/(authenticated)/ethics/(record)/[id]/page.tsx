import { pageIdentity } from "@/server/identity/auth/page";
import {
  ethicsHistoryHost,
  ethicsRecord,
  ethicsStakeholder,
  ethicsResponseEditable,
  type EthicsRecord as EthicsRecordData,
} from "@/server/modules/ethics/record";
import { authenticate } from "@/server/identity/session/service";
import { people } from "@/server/oracle/api";
import Link from "next/link";
import styles from "@/features/modules/ethics/record/participants.module.css";
import { ResponsesTab } from "@/features/modules/ethics/record/responses-tab";
import { ApprovalWorkflow } from "@/features/record/approvals/approval-workflow";
import { ethicsApprovalHost } from "@/server/modules/ethics/record/approval";
import { workflowView } from "@/server/record/approvals/workflow";
import { historyView } from "@/server/record/objects/history";
import { ObjectHistory } from "@/features/record/objects/object-history";
import { AttachmentsTab } from "@/features/record/attachments/attachments-tab";
import { ethicsShell } from "@/server/modules/ethics/record/shell";
import { resources } from "@/server/platform/configuration/resources";
import { State } from "@/components/feedback/state";
import { EthicsRecordShell } from "@/features/modules/ethics/record/record-shell";
import { OverviewTab } from "@/features/modules/ethics/record/overview-tab";
import { functions } from "@/lib/functions";
import { AppError } from "@/lib/errors";
import { ethicsFinalizeState } from "@/server/modules/ethics/record/finalize";
import { ethicsPrintOptions } from "@/server/modules/ethics/record/print";
import { ethicsEditableStatus } from "@/server/modules/ethics/record/status";
import { ethicsVersions } from "@/server/modules/ethics/record/versions";
import { canEditEthicsSetup } from "@/server/modules/ethics/actions";
import { ethicsAutoSubmitAvailable } from "@/server/modules/ethics/record/auto-submit";
import { serverFunctions } from "@/server/functions";

export const metadata = { title: "Ethics application" };

/** The record reads its access view from the query (legacy passes the listing tab), so the page holds the shell. */
export default async function EthicsRecord({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{
    access?: string;
    tab?: string;
    participant?: string;
    person?: string;
    version?: string;
  }>;
}) {
  const [{ id }, { access, tab, participant, person, version }] =
    await Promise.all([params, searchParams]);
  await pageIdentity(`/ethics/${id}`);
  const rowsRead = resources();
  rowsRead.catch(() => undefined);
  let model;
  let record: EthicsRecordData;
  try {
    record = await ethicsRecord(id, access);
    model = ethicsShell(record, await rowsRead);
  } catch (error) {
    const e = functions.errors.publicError(error);
    return (
      <State
        title="Ethics application unavailable"
        message={e.message}
        action={e.action}
        code={e.code}
      />
    );
  }
  const preferred =
    record.access === "EA_ACCESS"
      ? "ethics-general-overview"
      : "ethics-responses";
  const current =
    tab ??
    (model.tabs.some((item) => item.key === preferred)
      ? preferred
      : model.tabs[0]?.key);
  if (!current || !model.tabs.some((item) => item.key === current))
    return (
      <State
        title="Ethics section unavailable"
        message="You do not have access to this section."
        code="FORBIDDEN"
      />
    );
  let selected: ReturnType<typeof ethicsStakeholder>;
  try {
    const { user } = await authenticate();
    const mentioned =
      person === undefined
        ? undefined
        : record.respondents.find((row) => row.personId === person)?.id;
    if (person !== undefined && !mentioned)
      throw new AppError(
        "FORBIDDEN",
        "The mentioned Ethics participant is unavailable.",
        403,
      );
    selected = ethicsStakeholder(
      record,
      user.personId,
      participant ?? mentioned,
    );
  } catch (error) {
    const e = functions.errors.publicError(error);
    return (
      <State
        title="Ethics participant unavailable"
        message={e.message}
        code={e.code}
      />
    );
  }
  model.selectedParticipant = selected?.id ?? null;
  const statusCell = model.panel.find((cell) => cell.key === "status");
  if (statusCell && record.access !== "EA_ACCESS" && selected?.status)
    statusCell.value = selected.status;
  const participants =
    record.respondents.length ||
    record.reviewers.length ||
    record.creatorPersonId
      ? await people.all().catch(() => [])
      : [];
  const names = new Map(
    participants.map((person) => [String(person.person_id), person.full_name]),
  );
  const creator = model.panel.find((cell) => cell.key === "creator");
  if (creator) creator.value = names.get(record.creatorPersonId ?? "") ?? "";
  const participantLinks = record.respondents.map((person) => ({
    id: person.id,
    name: names.get(person.personId ?? "") ?? person.personId ?? person.id,
    org: person.org,
    status: person.status,
  }));
  const history =
    current === "ethics-history"
      ? await ethicsHistoryHost(id, selected?.id)
          .then(historyView)
          .then(
            (view) => ({ view }),
            (error: unknown) => ({
              failure: functions.errors.publicError(error),
            }),
          )
      : null;
  const approval =
    current === "ethics-approvals" && selected
      ? await ethicsApprovalHost(id, selected.id, record.access)
          .then(workflowView)
          .then(
            (view) => ({ view }),
            (error: unknown) => ({
              failure: functions.errors.publicError(error),
            }),
          )
      : null;
  const versions =
    current === "ethics-responses" && model.showVersion
      ? await ethicsVersions(id, record.access).catch(() => [])
      : [];
  const chosenVersion = version === undefined ? undefined : Number(version);
  if (
    version !== undefined &&
    (!Number.isInteger(chosenVersion) ||
      !versions.some((row) => row.value === chosenVersion))
  )
    return (
      <State
        title="Ethics version unavailable"
        message="This response version cannot be opened."
        code="FORBIDDEN"
      />
    );
  const historicalVersion =
    chosenVersion !== undefined && chosenVersion !== versions[0]?.value
      ? chosenVersion
      : undefined;
  const responseEditable =
    current === "ethics-responses" && selected
      ? await ethicsResponseEditable(
          record,
          selected,
          (await authenticate()).user.personId,
        )
      : false;
  const canEditSetup =
    historicalVersion === undefined && (await canEditEthicsSetup(record));
  const finalize =
    selected && record.statusCode !== "DRFT" && record.pageIds[current]
      ? await ethicsFinalizeState(record, selected.id, current).catch(
          () => undefined,
        )
      : undefined;
  const printOptions =
    current === "ethics-responses" && selected && record.statusCode !== "DRFT"
      ? await ethicsPrintOptions(record, selected.id).catch(() => [])
      : [];
  const autoSubmit =
    current === "ethics-responses" &&
    selected &&
    (await ethicsAutoSubmitAvailable(
      record,
      selected.id,
      (await authenticate()).user.personId,
    ))
      ? {
          label: serverFunctions.resources.label(
            await rowsRead,
            "ethics",
            "button-labels",
            "ethics-detail-submit-for-approval",
            "Submit for Approval",
          ),
        }
      : undefined;
  const canLink =
    record.statusCode === "COMPLETED" &&
    record.rights["ethics-link"]?.read === true;
  const canUnlink =
    !(await ethicsEditableStatus(record.statusCode).catch(() => false)) &&
    record.rights["ethics-unlink"]?.read === true;
  return (
    <EthicsRecordShell
      key={`${current}:${selected?.id ?? ""}:${chosenVersion ?? ""}`}
      model={model}
      current={current}
      finalizeState={finalize}
      printOptions={printOptions}
      canLink={canLink}
      autoSubmit={autoSubmit}
      versions={versions}
      selectedVersion={chosenVersion}
      canEditSetup={canEditSetup}
      canEditResponses={Boolean(responseEditable)}
    >
      <div
        className={
          current === "ethics-general-overview" ? undefined : styles.layout
        }
      >
        <div className={styles.content}>
          {current === "ethics-history" ? (
            history && "view" in history ? (
              <ObjectHistory
                id="ethics-history"
                host={{ host: "ethics", record: id, participant: selected?.id }}
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
          ) : current === "ethics-attachments" ? (
            <AttachmentsTab
              host="ethics"
              record={id}
              participant={selected?.id}
              id="ethics-attachments"
            />
          ) : current === "ethics-responses" ? (
            selected ? (
              <ResponsesTab
                setupId={id}
                stakeholderId={selected.id}
                editable={
                  Boolean(responseEditable) && historicalVersion === undefined
                }
                texts={model.labels}
                historicalVersion={historicalVersion}
              />
            ) : (
              <State
                title={model.labels.responseNoData}
                message={model.labels.responseSelect}
                code="EMPTY"
              />
            )
          ) : current === "ethics-approvals" ? (
            approval && "view" in approval && selected ? (
              <section id="ethics-approvals">
                <ApprovalWorkflow
                  id="ethics-workflow"
                  api={`/ethics/${id}/workflow/${record.access}/${selected.id}`}
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
          ) : current === "ethics-general-overview" ? (
            <>
              <OverviewTab
                model={model}
                selectedParticipant={selected?.id}
                canUnlink={canUnlink}
                participants={record.respondents.map((person) => ({
                  id: person.id,
                  name:
                    names.get(person.personId ?? "") ??
                    person.personId ??
                    person.id,
                  org: person.org,
                  status: person.status,
                }))}
                reviewers={record.reviewers.map((personId) => ({
                  id: personId,
                  name: names.get(personId) ?? personId,
                }))}
                references={record.references}
              />
            </>
          ) : (
            <State
              title="Ethics section unavailable"
              message="This section could not be loaded."
              code="ERROR"
            />
          )}
        </div>
        {current !== "ethics-general-overview" &&
          current !== "ethics-attachments" &&
          participantLinks.length > 0 &&
          !(
            current === "ethics-approvals" &&
            record.access === "RESPONDENT_ACCESS"
          ) && (
            <nav
              className={styles.participants}
              aria-label={model.labels.participants}
              id="ethics-participants"
            >
              <h2>
                {current === "ethics-history"
                  ? model.labels.historyParticipants
                  : current === "ethics-responses"
                    ? model.labels.responseParticipants
                    : model.labels.participants}
              </h2>
              {participantLinks.map((person) =>
                current === "ethics-approvals" &&
                record.ethicsTypeCode === "COLLAB" ? (
                  <div key={person.id} className={styles.person}>
                    {person.name}
                    {person.org ? (
                      <small className={styles.org}>{person.org}</small>
                    ) : null}
                    {person.status ? (
                      <small className={styles.status}>{person.status}</small>
                    ) : null}
                  </div>
                ) : (
                  <Link
                    key={person.id}
                    id={`ethics-participant-${person.id}`}
                    href={`/ethics/${id}?${new URLSearchParams({ ...(access ? { access } : {}), tab: current, participant: person.id })}`}
                    aria-current={
                      selected?.id === person.id ? "page" : undefined
                    }
                    prefetch={false}
                  >
                    {person.name}
                    {person.org ? (
                      <small className={styles.org}>{person.org}</small>
                    ) : null}
                    {person.status ? (
                      <small className={styles.status}>{person.status}</small>
                    ) : null}
                  </Link>
                ),
              )}
              {record.reviewers.length > 0 && (
                <>
                  <h2>{model.labels.supervisor}</h2>
                  {record.reviewers.map((personId) => (
                    <div key={personId} className={styles.person}>
                      {names.get(personId) ?? personId}
                    </div>
                  ))}
                </>
              )}
            </nav>
          )}
      </div>
    </EthicsRecordShell>
  );
}
