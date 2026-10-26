import Link from "next/link";
import { pageIdentity } from "@/server/identity/auth/page";
import {
  contractApprovalHistory,
  contractStageUsers,
  contractWorkflow,
  contractWorkflowGraph,
  loadContract,
} from "@/server/contracts/service";
import { contractId } from "@/features/contracts/schema";
import { State } from "@/components/feedback/state";
import { publicError } from "@/lib/errors";
import styles from "../../contracts.module.css";
import {
  ApprovalHistory,
  ApprovalWorkflow,
} from "@/features/record/approvals/approval-workflow";
import type { WorkflowView } from "@/features/record/approvals/types";
import { workflowTexts } from "@/server/record/approvals/workflow";
import { resources } from "@/server/platform/configuration/resources";
import { dateDisplay } from "@/lib/format";
import { displayFormat } from "@/server/platform/configuration/formatting";
import { Suspense } from "react";
import { Skeleton } from "@/components/feedback/skeleton";
import { ApprovalTree } from "@/features/record/approvals/approval-tree";

export const metadata = { title: "Contract Workflow" };

export default async function ContractWorkflow({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { id } = await params;
  const { stage } = await searchParams;
  if (!contractId.safeParse(id).success)
    return <State title="Invalid contract identity" code="BAD_REQUEST" />;
  if (
    stage !== undefined &&
    (typeof stage !== "string" || !/^[1-9]\d*$/.test(stage))
  )
    return <State title="Invalid approval stage" code="BAD_REQUEST" />;
  await pageIdentity(`/contracts/${id}/workflow`);
  return (
    <>
      <Suspense
        fallback={
          <Skeleton kind="list" count={4} label="Loading Approval Route" />
        }
      >
        <WorkflowContent id={id} />
      </Suspense>
      <Suspense
        fallback={<Skeleton kind="table" label="Loading Approval History" />}
      >
        <WorkflowHistory id={id} />
      </Suspense>
      {stage !== undefined && (
        <Suspense
          fallback={
            <Skeleton kind="table" label="Loading Approver Information" />
          }
        >
          <StageUsersDialog id={id} stage={Number(stage)} />
        </Suspense>
      )}
    </>
  );
}

async function WorkflowContent({ id }: { id: string }) {
  let data: Awaited<ReturnType<typeof contractWorkflow>> | null = null;
  let contract: Awaited<ReturnType<typeof loadContract>> | null = null;
  let failure: ReturnType<typeof publicError> | null = null;
  try {
    contract = await loadContract(id);
    data = await contractWorkflow(id, contract.number, contract.statusCode);
  } catch (error) {
    failure = publicError(error);
  }
  if (failure || !data || !contract)
    return (
      <State
        title={
          failure?.code === "FORBIDDEN"
            ? "Access denied"
            : "Contract Workflow unavailable"
        }
        message={failure?.message}
        action={failure?.action}
        code={failure?.code}
      />
    );
  return (
    <>
      <ApprovalWorkflow
        id={`contract-${id}-workflow`}
        api=""
        showHistory={false}
        compactGraph
        graphContent={
          <Suspense
            fallback={<Skeleton kind="chart" label="Loading Approval Graph" />}
          >
            <WorkflowGraph id={id} />
          </Suspense>
        }
        view={
          {
            texts: workflowTexts(await resources(), "contract"),
            stages: data.map((stage) => ({
              id: String(stage.id),
              name: stage.name,
              description: stage.description,
              helpText: null,
              // The Contract host does not show a role in VBCS route cards.
              role: null,
              actionType: stage.type,
              required: stage.required === null ? "—" : String(stage.required),
              status: stage.status,
              review: stage.type === "PEERREVIEW",
              remarks: stage.remarks || null,
              pendingDays: null,
              approvers: false,
              approverHref: `/contracts/${id}/workflow?stage=${stage.id}`,
              canDelete: false,
              canAct: false,
            })),
            history: { rows: [] },
            gates: {
              generate: false,
              submit: false,
              withdraw: false,
              addStage: false,
            },
          } satisfies WorkflowView
        }
      />
    </>
  );
}

async function WorkflowGraph({ id }: { id: string }) {
  let graph: Awaited<ReturnType<typeof contractWorkflowGraph>> | null = null;
  let failure: ReturnType<typeof publicError> | null = null;
  try {
    const contract = await loadContract(id);
    graph = await contractWorkflowGraph(
      id,
      contract.number,
      contract.statusCode,
    );
  } catch (error) {
    failure = publicError(error);
  }
  if (failure)
    return (
      <State
        title="Approval Graph unavailable"
        message={failure.message}
        action={failure.action}
        code={failure.code}
      />
    );
  return graph ? (
    <ApprovalTree root={graph} />
  ) : (
    <State title="No data to display." />
  );
}

async function WorkflowHistory({ id }: { id: string }) {
  let result: {
    history: Awaited<ReturnType<typeof contractApprovalHistory>>;
    format: Awaited<ReturnType<typeof displayFormat>>;
    rb: Awaited<ReturnType<typeof resources>>;
  } | null = null;
  let failure: ReturnType<typeof publicError> | null = null;
  try {
    const contract = await loadContract(id);
    const [history, format, rb] = await Promise.all([
      contractApprovalHistory(id, contract.number),
      displayFormat(),
      resources(),
    ]);
    result = { history, format, rb };
  } catch (error) {
    failure = publicError(error);
  }
  if (failure || !result)
    return (
      <State
        title="Approval History unavailable"
        message={failure?.message}
        action={failure?.action}
        code={failure?.code}
      />
    );
  const { history, format, rb } = result;
  return (
    <ApprovalHistory
      id={`contract-${id}-workflow`}
      standalone
      texts={workflowTexts(rb, "contract")}
      history={{
        rows: history.map((row, index) => ({
          id: `${index}-${row.status}`,
          name: row.user,
          status: row.status,
          stage: row.stage,
          comments: row.comments,
          updated: workflowDate(row.date, format),
          created: workflowDate(row.created, format),
        })),
      }}
    />
  );
}

async function StageUsersDialog({ id, stage }: { id: string; stage: number }) {
  let stageUsers: Awaited<ReturnType<typeof contractStageUsers>> | null = null;
  let stageFailure: ReturnType<typeof publicError> | null = null;
  try {
    const contract = await loadContract(id);
    stageUsers = await contractStageUsers(id, contract.number, stage);
  } catch (error) {
    stageFailure = publicError(error);
  }
  return (
    <div className={styles.workflowDialogBackdrop}>
      <section
        role="dialog"
        aria-modal="true"
        aria-label="Approver Information"
        className={styles.workflowDialog}
      >
        <header>
          <h2>Approver Information</h2>
          <Link
            href={`/contracts/${id}/workflow`}
            aria-label="Close approver information"
          >
            ×
          </Link>
        </header>
        {stageFailure ? (
          <p>{stageFailure.message}</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {stageUsers?.length ? (
                stageUsers.map((user, index) => (
                  <tr key={index}>
                    <td>{user.name}</td>
                    <td>{user.email}</td>
                    <td>{user.status}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={3}>No data to display.</td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}

function workflowDate(
  value: string,
  format: Awaited<ReturnType<typeof displayFormat>>,
) {
  if (!value || Number.isNaN(Date.parse(value))) return value;
  return `${dateDisplay(value, format)} ${new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Kolkata", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false }).format(new Date(value))}`;
}
