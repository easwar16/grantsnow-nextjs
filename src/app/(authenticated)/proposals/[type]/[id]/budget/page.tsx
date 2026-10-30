import { serverFunctions } from "@/server/functions";
import { functions } from "@/lib/functions";
import { pageIdentity } from "@/server/identity/auth/page";
import { recordIdentity } from "@/features/modules/proposals/record";
import { proposalBudget } from "@/server/modules/proposals/budget";
import { resources } from "@/server/platform/configuration/resources";
import { displayFormat } from "@/server/platform/configuration/formatting";
import { State } from "@/components/feedback/state";
import { BudgetView } from "./budget-view";
import { CostingEditor } from "./costing-editor";
import styles from "../proposal-record.module.css";

export const metadata = { title: "Proposal Budget" };

const budgetColumns = [
  ["name", "Name"],
  ["role", "Role"],
  ["project-fte", "Project FTE"],
  ["project-avg-fte", "Average FTE"],
  ["project-hours", "Project Hours"],
  ["project-months", "Project Months"],
  ["unindexed-cost", "Unindexed Cost"],
  ["total-cost", "Total Cost"],
] as const;

export default async function ProposalBudget({
  params,
  searchParams,
}: {
  params: Promise<{ type: string; id: string }>;
  searchParams: Promise<{ version?: string }>;
}) {
  const parsed = recordIdentity.safeParse(await params);
  if (!parsed.success)
    return <State title="Invalid proposal identity" code="BAD_REQUEST" />;
  const { type, id } = parsed.data;
  await pageIdentity(`/proposals/${type}/${id}/budget`);
  const version = (await searchParams).version;
  if (version !== undefined && !/^[1-9]\d{0,14}$/.test(version))
    return <State title="Invalid Budget version" code="BAD_REQUEST" />;
  let budget: Awaited<ReturnType<typeof proposalBudget>>;
  try {
    budget = await proposalBudget(
      type,
      id,
      version ? Number(version) : undefined,
    );
  } catch (error) {
    const failure = functions.errors.publicError(error);
    return (
      <State
        title={
          failure.code === "FORBIDDEN"
            ? "Access denied"
            : "Proposal Budget unavailable"
        }
        message={failure.message}
        action={failure.action}
        code={failure.code}
      />
    );
  }
  const [rb, format] = await Promise.all([resources(), displayFormat()]);
  const columns = budgetColumns
    .filter(([key]) =>
      serverFunctions.resources.resourceVisible(
        rb,
        budget.bundle,
        "table-headers",
        key,
      ),
    )
    .map(([key, fallback]) => ({
      key,
      label: serverFunctions.resources.label(
        rb,
        budget.bundle,
        "table-headers",
        key,
        fallback,
      ),
    }));
  const shows = (key: (typeof budgetColumns)[number][0]) =>
    columns.some((column) => column.key === key);
  const indexedYears = serverFunctions.resources.resourceVisible(
    rb,
    budget.bundle,
    "table-headers",
    "indexed-year-split",
  );
  const unindexedYears = serverFunctions.resources.resourceVisible(
    rb,
    budget.bundle,
    "table-headers",
    "unindexed-year-split",
  );
  const visibleSplits = (splits: typeof budget.yearSplits) =>
    splits.map((split) => ({
      period: split.period,
      indexed: indexedYears ? split.indexed : "",
      unindexed: unindexedYears ? split.unindexed : "",
    }));
  const displayGroups = (groups: typeof budget.groups) =>
    groups.map((group) => ({
      id: group.id,
      name: shows("name") ? group.name : "",
      unindexed: shows("unindexed-cost") ? group.unindexed : "",
      total: shows("total-cost") ? group.total : "",
      yearSplits: visibleSplits(group.yearSplits),
      categories: group.categories.map((category) => ({
        id: category.id,
        code: category.code,
        name: shows("name") ? category.name : "",
        unindexed: shows("unindexed-cost") ? category.unindexed : "",
        total: shows("total-cost") ? category.total : "",
        yearSplits: visibleSplits(category.yearSplits),
        rows: category.rows.map((row) => ({
          id: row.id,
          name: shows("name") ? row.name : "",
          role: shows("role") ? row.role : "",
          fte: shows("project-fte") ? row.fte : "",
          averageFte: shows("project-avg-fte") ? row.averageFte : "",
          hours: shows("project-hours") ? row.hours : "",
          months: shows("project-months") ? row.months : "",
          unindexed: shows("unindexed-cost") ? row.unindexed : "",
          total: shows("total-cost") ? row.total : "",
          yearSplits: visibleSplits(row.yearSplits),
        })),
      })),
    }));
  const actions = [
    {
      kind: "staff",
      key: "proposals-budget-staff",
      fallback: "Add Staff Cost",
      read: budget.actions.staff,
      edit: budget.actions.staffEdit,
    },
    {
      kind: "student",
      key: "proposals-budget-student",
      fallback: "Add Student Cost",
      read: budget.actions.student,
      edit: budget.actions.studentEdit,
    },
    {
      kind: "pool-tech",
      key: "proposals-budget-pool-tech",
      fallback: "Add Pool Tech Cost",
      read: budget.actions.poolTech,
      edit: budget.actions.poolTechEdit,
    },
    {
      kind: "non-staff",
      key: "proposals-budget-non-staff",
      fallback: "Add Non Staff Cost",
      read: budget.actions.nonStaff,
      edit: budget.actions.nonStaffEdit,
    },
    {
      kind: "research-partner",
      key: "proposals-budget-research-partner",
      fallback: "Add Research Partner Costs",
      read: budget.actions.researchPartner,
      edit: budget.actions.researchPartnerEdit,
    },
  ] as const;
  return (
    <section id={`proposal-${id}-budget`} className={styles.budget}>
      <div
        id={`proposal-${id}-budget-add-actions`}
        className={styles.budgetAddActions}
      >
        {actions
          .filter(
            (action) =>
              action.read &&
              (action.kind === "research-partner" ||
                serverFunctions.resources.resourceVisible(
                  rb,
                  budget.bundle,
                  "button-labels",
                  action.key,
                )),
          )
          .map((action) => (
            <CostingEditor
              key={action.kind}
              id={id}
              type={type}
              kind={action.kind}
              label={serverFunctions.resources.label(
                rb,
                budget.bundle,
                "button-labels",
                action.key,
                action.fallback,
              )}
              disabled={
                budget.versionId === null ||
                !budget.actions.editable ||
                !action.edit ||
                (version !== undefined && Number(version) !== budget.versionId)
              }
            />
          ))}
      </div>
      {budget.projects.length === 0 ? (
        <p>No data to display.</p>
      ) : (
        <BudgetView
          id={id}
          type={type}
          projects={budget.projects.map((project) => ({
            id: project.id.replace(/[^a-zA-Z0-9-]/g, "-"),
            title: `${project.reference} : ${project.name}`,
            groups: displayGroups(project.groups),
            total: project.total,
            unindexed: project.unindexed,
            yearSplits: visibleSplits(project.yearSplits),
          }))}
          combinedGroups={displayGroups(budget.groups)}
          combinedYearSplits={visibleSplits(budget.yearSplits)}
          columns={columns}
          canReadStaff={budget.canReadStaff}
          versionId={budget.versionId}
          showTotal={shows("total-cost")}
          showUnindexed={shows("unindexed-cost")}
          total={budget.total}
          unindexed={budget.unindexed}
          currency={format?.currency ?? "GBP"}
          decimals={format?.decimals ?? 2}
          yearSplitLabel={
            serverFunctions.resources.resourceVisible(
              rb,
              budget.bundle,
              "labels",
              "year-split",
            )
              ? serverFunctions.resources.label(
                  rb,
                  budget.bundle,
                  "labels",
                  "year-split",
                  "Show Year Split",
                )
              : null
          }
          showIndexedYears={indexedYears}
          showUnindexedYears={unindexedYears}
        />
      )}
    </section>
  );
}
