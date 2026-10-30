import { functions } from "@/lib/functions";
import { pageIdentity } from "@/server/identity/auth/page";
import { recordIdentity } from "@/features/modules/proposals/record";
import { proposalPricing } from "@/server/modules/proposals/pricing";
import { resources } from "@/server/platform/configuration/resources";
import { displayFormat } from "@/server/platform/configuration/formatting";
import { State } from "@/components/feedback/state";
import { ProposalPricing } from "@/features/modules/proposals/record/pricing";

export const metadata = { title: "Proposal Funder Rules" };

export default async function PricingPage({
  params,
}: {
  params: Promise<{ type: string; id: string }>;
}) {
  const identity = recordIdentity.safeParse(await params);
  if (!identity.success)
    return <State title="Invalid proposal identity" code="BAD_REQUEST" />;
  const { type, id } = identity.data;
  await pageIdentity(`/proposals/${type}/${id}/pricing`);
  let pricing: Awaited<ReturnType<typeof proposalPricing>>;
  try {
    pricing = await proposalPricing(type, id);
  } catch (error) {
    const failure = functions.errors.publicError(error);
    return (
      <State
        title={
          failure.code === "FORBIDDEN"
            ? "Access denied"
            : "Proposal Funder Rules unavailable"
        }
        message={failure.message}
        action={failure.action}
        code={failure.code}
      />
    );
  }
  const [rb, format] = await Promise.all([resources(), displayFormat()]);
  return <ProposalPricing id={id} pricing={pricing} rb={rb} format={format} />;
}
