import { serverFunctions } from "@/server/functions";
import { functions } from "@/lib/functions";
import { pageIdentity } from "@/server/identity/auth/page";
import { recordIdentity } from "@/features/modules/proposals/record";
import { proposalCreditAllocation } from "@/server/modules/proposals/credit-allocation";
import { resources } from "@/server/platform/configuration/resources";
import { displayFormat } from "@/server/platform/configuration/formatting";
import { State } from "@/components/feedback/state";
import { CreditAllocation } from "@/features/modules/proposals/record/credit-allocation";

export const metadata = { title: "Credit Allocation" };

export default async function CreditAllocationPage({
  params,
  searchParams,
}: {
  params: Promise<{ type: string; id: string }>;
  searchParams: Promise<{ version?: string }>;
}) {
  const identity = recordIdentity.safeParse(await params);
  if (!identity.success)
    return <State title="Invalid proposal identity" code="BAD_REQUEST" />;
  const { type, id } = identity.data;
  await pageIdentity(`/proposals/${type}/${id}/allocation-for-credit`);
  const version = (await searchParams).version;
  if (version !== undefined && !/^[1-9]\d{0,14}$/.test(version))
    return <State title="Invalid Budget version" code="BAD_REQUEST" />;
  let allocation: Awaited<ReturnType<typeof proposalCreditAllocation>>;
  try {
    allocation = await proposalCreditAllocation(
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
            : "Credit Allocation unavailable"
        }
        message={failure.message}
        action={failure.action}
        code={failure.code}
      />
    );
  }
  const [rb, format] = await Promise.all([resources(), displayFormat()]);
  const columns = [
    ["credit-alloc-name", "Name", "name"],
    ["credit-alloc-proposal-number", "Proposal Number", "proposalNumber"],
    ["credit-alloc-project-role", "Project Role", "role"],
    ["credit-alloc-org-unit", "Org Unit", "orgUnit"],
    ["credit-alloc-project-effort", "Project Effort%", "effort"],
    ["credit-alloc-credit-allocation", "Credit Allocation %", "credit"],
  ] as const;
  const visible = columns.filter(([key]) =>
    serverFunctions.resources.resourceVisible(
      rb,
      allocation.bundle,
      "table-headers",
      key,
    ),
  );
  return (
    <CreditAllocation
      id={id}
      rows={allocation.rows}
      columns={visible.map(([key, fallback, field]) => ({
        key,
        field,
        label: serverFunctions.resources.label(
          rb,
          allocation.bundle,
          "table-headers",
          key,
          fallback,
        ),
      }))}
      format={format}
    />
  );
}
