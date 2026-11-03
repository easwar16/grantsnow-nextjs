import { serverFunctions } from "@/server/functions";
import { functions } from "@/lib/functions";
import Link from "next/link";
import { Suspense } from "react";
import { proposalContext } from "@/server/modules/proposals/record";
import { RecordPanels } from "@/features/record/objects/record-panels";
import { State } from "@/components/feedback/state";
import { StatusBadge } from "@/components/ui/status-badge";
import { displayFormat } from "@/server/platform/configuration/formatting";
import { people } from "@/server/oracle/api";
import { resources } from "@/server/platform/configuration/resources";
import { budgetVersions } from "@/server/modules/proposals/budget";
import { proposalPrintOptions } from "@/server/modules/proposals/print";
import { proposalEditContext } from "@/server/modules/proposals/edit";
import { ProposalTabs } from "./proposal-tabs";
import { BudgetVersionControl } from "./budget-version-control";
import { ProposalFinalize } from "./proposal-finalize";
import { Icon } from "@/components/ui/icon";
import { ProposalAiActions } from "./proposal-ai-actions";
import { ProposalPrint } from "./proposal-print";
import { ProposalBudgetActions } from "./proposal-budget-actions";
import { ProposalEditToolbar } from "./proposal-edit-form";
import styles from "./proposal-record.module.css";

/** The record's action bar: edit, budget, AI, panels and print, each streaming on its own. */
export async function ProposalActions({
  type,
  id,
}: {
  type: "PROPOSAL" | "OUTLINE_PROPOSAL" | "SUB_PROPOSAL" | "EXTENSION_PROPOSAL";
  id: string;
}) {
  let context;
  try {
    context = await proposalContext(type, id);
  } catch {
    return null;
  }
  const rb = await resources();
  const text = (key: string, fallback: string) =>
    serverFunctions.resources.resourceVisible(
      rb,
      context.bundle,
      "button-labels",
      key,
    )
      ? serverFunctions.resources.label(
          rb,
          context.bundle,
          "button-labels",
          key,
          fallback,
        )
      : null;
  return (
    <ProposalEditToolbar
      type={type}
      id={id}
      editAction={
        <Suspense fallback={null}>
          <EditAction
            type={type}
            id={id}
            label={text("edit-proposal", "Edit Proposal")}
          />
        </Suspense>
      }
      editChildren={
        <>
          <ProposalAiActions
            type={type}
            id={id}
            summaryLabel={text("proposal-ai-summary", "AI Summary")}
            comparisonLabel={text(
              "compare-proposal-opportunity",
              "Compare Proposal",
            )}
            canCompare={context.summary.opportunityFields.some(
              (field) => field.key === "opportunity-url" && field.value !== "",
            )}
          />
          <RecordPanels
            objectType={type}
            objectId={id}
            area="proposals"
            showAudit={false}
          />
          <Suspense fallback={null}>
            <PrintAction type={type} id={id} />
          </Suspense>
        </>
      }
    >
      {
        <ProposalBudgetActions
          type={type}
          id={id}
          versionId={context.summary.budgetVersionId}
          quickCostLabel={
            context.summary.statusCode === "DRFT" &&
            context.access.get("proposals-budget")?.edit === true &&
            context.access.get("quick-costing")?.edit === true
              ? text("quick-cost", "Quick Cost")
              : null
          }
          fxLabel={
            context.access.get("proposal-fx-rates")?.edit === true
              ? text("fx-rates", "FX Rates")
              : null
          }
          viabilityLabel={text(
            "proposal-budget-dyn-report",
            "Viability Checks",
          )}
        />
      }
      <ProposalAiActions
        type={type}
        id={id}
        summaryLabel={text("proposal-ai-summary", "AI Summary")}
        comparisonLabel={text(
          "compare-proposal-opportunity",
          "Compare Proposal",
        )}
        canCompare={context.summary.opportunityFields.some(
          (field) => field.key === "opportunity-url" && field.value !== "",
        )}
      />
      <RecordPanels objectType={type} objectId={id} area="proposals" />
      <Suspense fallback={null}>
        <PrintAction type={type} id={id} />
      </Suspense>
    </ProposalEditToolbar>
  );
}

async function EditAction({
  type,
  id,
  label: actionLabel,
}: {
  type: "PROPOSAL" | "OUTLINE_PROPOSAL" | "SUB_PROPOSAL" | "EXTENSION_PROPOSAL";
  id: string;
  label: string | null;
}) {
  if (!actionLabel) return null;
  try {
    if (!(await proposalEditContext(type, id))) return null;
  } catch {
    return null;
  }
  return (
    <Link
      id={`proposal-${id}-edit`}
      href={`/proposals/${type}/${id}?mode=edit`}
      prefetch={false}
      className={styles.actionButton}
    >
      ✎ &nbsp; {actionLabel}
    </Link>
  );
}

async function PrintAction({
  type,
  id,
}: {
  type: "PROPOSAL" | "OUTLINE_PROPOSAL" | "SUB_PROPOSAL" | "EXTENSION_PROPOSAL";
  id: string;
}) {
  let options: Awaited<ReturnType<typeof proposalPrintOptions>>;
  try {
    options = await proposalPrintOptions(type, id);
  } catch {
    return null;
  }
  return <ProposalPrint type={type} id={id} {...options} />;
}

/** The record header: tabs, title and detail columns. */
export async function ProposalHeader({
  type,
  id,
}: {
  type: "PROPOSAL" | "OUTLINE_PROPOSAL" | "SUB_PROPOSAL" | "EXTENSION_PROPOSAL";
  id: string;
}) {
  let context: Awaited<ReturnType<typeof proposalContext>> | null = null;
  let failure: ReturnType<typeof functions.errors.publicError> | null = null;
  try {
    context = await proposalContext(type, id);
  } catch (error) {
    failure = functions.errors.publicError(error);
  }
  if (!context || failure)
    return (
      <State
        title={
          failure?.code === "FORBIDDEN"
            ? "Access denied"
            : "Proposal unavailable"
        }
        message={failure?.message}
        action={failure?.action}
        code={failure?.code}
      />
    );
  const { summary, access } = context;
  const format = await displayFormat();
  return (
    <>
      <ProposalTabs
        type={type}
        id={id}
        access={[...access]}
        finalizedPages={[...context.pageIds]
          .filter(
            ([, pageId]) =>
              pageId != null && summary.lockedPageIds.includes(pageId),
          )
          .map(([page]) => page)}
      />
      <section id={`proposal-${id}-heading`} className={styles.heading}>
        <h1 className={styles.recordTitle}>{summary.title}</h1>
        <div className={styles.infoGrid}>
          {summary.detailColumns.map((column, index) => (
            <div className={styles.infoColumn} key={index}>
              {column.map((field) => (
                <div id={`proposal-${id}-detail-${field.key}`} key={field.key}>
                  <strong>{field.label}</strong>
                  <div className={styles.detailValue}>
                    {field.key === "detail-applicant-name" &&
                    summary.creatorId ? (
                      <Suspense fallback="…">
                        <CreatorName id={summary.creatorId} />
                      </Suspense>
                    ) : field.key === "active-budget-version" &&
                      summary.budgetVersionId ? (
                      <Suspense fallback="…">
                        <BudgetVersionField
                          proposalId={id}
                          type={type}
                          versionId={summary.budgetVersionId}
                        />
                      </Suspense>
                    ) : field.kind === "date" ? (
                      functions.format.dateDisplay(field.value, format)
                    ) : field.key === "detail-proposal-status" ? (
                      <StatusBadge className={styles.statusBadge}>
                        {field.value || "—"}
                      </StatusBadge>
                    ) : field.key === "detail-proposal-risk" ? (
                      <StatusBadge tone="info" className={styles.riskBadge}>
                        {field.value || "—"}
                      </StatusBadge>
                    ) : (
                      field.value || "—"
                    )}
                  </div>
                </div>
              ))}
              {index === 2 && context.finalize.visible && (
                <ProposalFinalize
                  type={type}
                  id={id}
                  checked={context.finalize.checked}
                  editable={context.finalize.editable}
                />
              )}
            </div>
          ))}
        </div>
      </section>
      {context.finalize.lockedBy && (
        <div id={`proposal-${id}-finalized-by`} className={styles.finalizedBy}>
          <Icon name="lock" /> {context.finalize.lockedBy}
        </div>
      )}
    </>
  );
}

async function CreatorName({ id }: { id: number }) {
  try {
    const rows = await people.all();
    return rows.find((person) => person.person_id === id)?.full_name || "—";
  } catch {
    return "—";
  }
}

async function BudgetVersionField({
  proposalId,
  type,
  versionId,
}: {
  proposalId: string;
  type: "PROPOSAL" | "OUTLINE_PROPOSAL" | "SUB_PROPOSAL" | "EXTENSION_PROPOSAL";
  versionId: number;
}) {
  let options: Awaited<ReturnType<typeof budgetVersions>>;
  try {
    options = await budgetVersions(type, proposalId);
  } catch {
    return "—";
  }
  return <BudgetVersionControl options={options} activeId={versionId} />;
}
