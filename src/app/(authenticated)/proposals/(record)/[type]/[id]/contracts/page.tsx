import { functions } from "@/lib/functions";
import { pageIdentity } from "@/server/identity/auth/page";
import { recordIdentity } from "@/features/modules/proposals/record";
import { proposalContracts } from "@/server/modules/proposals/contracts";
import { State } from "@/components/feedback/state";
import { displayFormat } from "@/server/platform/configuration/formatting";
import { resources } from "@/server/platform/configuration/resources";
import { ProposalContracts } from "@/features/modules/proposals/record/contracts";

export const metadata = { title: "Proposal Contracts" };

export default async function ContractsPage({
  params,
  searchParams,
}: {
  params: Promise<{ type: string; id: string }>;
  searchParams: Promise<{ page?: string }>;
}) {
  const identity = recordIdentity.safeParse(await params);
  if (!identity.success)
    return <State title="Invalid proposal identity" code="BAD_REQUEST" />;
  const { type, id } = identity.data;
  await pageIdentity(`/proposals/${type}/${id}/contracts`);
  const page = Number((await searchParams).page ?? "1");
  let result: Awaited<ReturnType<typeof proposalContracts>>;
  try {
    result = await proposalContracts(type, id, page);
  } catch (error) {
    const failure = functions.errors.publicError(error);
    return (
      <State
        title={
          failure.code === "FORBIDDEN"
            ? "Access denied"
            : "Proposal Contracts unavailable"
        }
        message={failure.message}
        action={failure.action}
        code={failure.code}
      />
    );
  }
  const [format, rb] = await Promise.all([displayFormat(), resources()]);
  return (
    <ProposalContracts
      type={type}
      id={id}
      page={page}
      result={result}
      format={format}
      rb={rb}
    />
  );
}
