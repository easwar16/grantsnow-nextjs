import { functions } from "@/lib/functions";
import { pageIdentity } from "@/server/identity/auth/page";
import { recordIdentity } from "@/features/modules/proposals/record";
import { quickCostOptions } from "@/server/modules/proposals/quick-cost";
import { State } from "@/components/feedback/state";
import { CostingEditor } from "@/features/modules/proposals/record/budget/costing-editor";
import { StaffEntry } from "@/features/modules/proposals/record/budget/staff-entry";
import { staffEntryOptions } from "@/server/modules/proposals/staff-entry";

const kinds = [
  "staff",
  "student",
  "pool-tech",
  "non-staff",
  "research-partner",
] as const;
type Kind = (typeof kinds)[number];
const labels: Record<Kind, string> = {
  staff: "Add Staff Cost",
  student: "Add Student Cost",
  "pool-tech": "Add Pool Tech Cost",
  "non-staff": "Add Non Staff Cost",
  "research-partner": "Add Research Partner Costs",
};

export default async function NewBudgetCost({
  params,
}: {
  params: Promise<{ type: string; id: string; kind: string }>;
}) {
  const route = await params;
  const identity = recordIdentity.safeParse(route);
  const kind = kinds.find((item) => item === route.kind);
  if (!identity.success || !kind)
    return <State title="Invalid Budget cost entry" code="BAD_REQUEST" />;
  const { type, id } = identity.data;
  await pageIdentity(`/proposals/${type}/${id}/budget`);
  if (kind === "staff" || kind === "student" || kind === "pool-tech") {
    let options;
    try {
      options = await staffEntryOptions(type, id, kind);
    } catch (error) {
      const failure = functions.errors.publicError(error);
      return <State title="Staff costing unavailable" message={failure.message} action={failure.action} code={failure.code} />;
    }
    return <StaffEntry id={id} type={type} options={options} />;
  }
  let options;
  try {
    options = await quickCostOptions(type, id, kind);
  } catch (error) {
    const failure = functions.errors.publicError(error);
    return (
      <State
        title={
          failure.code === "FORBIDDEN"
            ? "Access denied"
            : "Budget costing unavailable"
        }
        message={failure.message}
        action={failure.action}
        code={failure.code}
      />
    );
  }
  return (
    <CostingEditor
      id={id}
      type={type}
      kind={kind}
      label={labels[kind]}
      inline
      initialOptions={options}
    />
  );
}
