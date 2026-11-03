import { functions } from "@/lib/functions";
import { pageIdentity } from "@/server/identity/auth/page";
import { recordIdentity } from "@/features/modules/proposals/record";
import { proposalBudget } from "@/server/modules/proposals/budget";
import { resources } from "@/server/platform/configuration/resources";
import { displayFormat } from "@/server/platform/configuration/formatting";
import { State } from "@/components/feedback/state";
import { ProposalBudget } from "@/features/modules/proposals/record/budget/budget";

export const metadata = { title: "Proposal Budget" };

export default async function BudgetPage({
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
  return (
    <ProposalBudget
      type={type}
      id={id}
      version={version}
      budget={budget}
      rb={rb}
      format={format}
    />
  );
}
