import { functions } from "@/lib/functions";
import { pageIdentity } from "@/server/identity/auth/page";
import { recordIdentity } from "@/features/modules/proposals/record";
import { proposalStaffCost } from "@/server/modules/proposals/budget";
import { State } from "@/components/feedback/state";
import { displayFormat } from "@/server/platform/configuration/formatting";
import { StaffCost } from "@/features/modules/proposals/record/budget/staff-cost";

export const metadata = { title: "Proposal Staff Costing" };

export default async function StaffCosting({
  params,
  searchParams,
}: {
  params: Promise<{ type: string; id: string; costHeaderId: string }>;
  searchParams: Promise<{ version?: string }>;
}) {
  const route = await params;
  const parsed = recordIdentity.safeParse(route);
  if (!parsed.success || !/^[1-9]\d{0,14}$/.test(route.costHeaderId))
    return <State title="Invalid Staff cost identity" code="BAD_REQUEST" />;
  const { type, id } = parsed.data;
  await pageIdentity(`/proposals/${type}/${id}/budget`);
  const version = (await searchParams).version;
  if (version !== undefined && !/^[1-9]\d{0,14}$/.test(version))
    return <State title="Invalid Budget version" code="BAD_REQUEST" />;
  let cost: Awaited<ReturnType<typeof proposalStaffCost>>;
  try {
    cost = await proposalStaffCost(
      type,
      id,
      Number(route.costHeaderId),
      version ? Number(version) : undefined,
    );
  } catch (error) {
    const failure = functions.errors.publicError(error);
    return (
      <State
        title={
          failure.code === "FORBIDDEN"
            ? "Access denied"
            : "Staff costing unavailable"
        }
        message={failure.message}
        action={failure.action}
        code={failure.code}
      />
    );
  }
  return (
    <StaffCost
      type={type}
      id={id}
      costHeaderId={route.costHeaderId}
      version={version}
      cost={cost}
      format={await displayFormat()}
    />
  );
}
