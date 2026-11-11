import { pageIdentity } from "@/server/identity/auth/page";
import {
  approvedAoiPrefill,
  proposalCreateChoices,
} from "@/server/modules/proposals/create";
import { State } from "@/components/feedback/state";
import { functions } from "@/lib/functions";
import { matchSponsor } from "@/server/modules/opportunities/payloads";
import { CreateProposalSummary } from "@/features/modules/proposals/record/create-summary";

export const metadata = { title: "Create Proposal" };

export default async function NewProposal({
  params,
  searchParams,
}: {
  params: Promise<{ type: string }>;
  searchParams: Promise<{ sourceRequestId?: string }>;
}) {
  const { type } = await params;
  const { sourceRequestId } = await searchParams;
  await pageIdentity(`/proposals/new/${type}`);
  let choices: Awaited<ReturnType<typeof proposalCreateChoices>>;
  let aoi: Awaited<ReturnType<typeof approvedAoiPrefill>> | null = null;
  try {
    choices = await proposalCreateChoices(type);
    if (sourceRequestId !== undefined) {
      const id = Number(sourceRequestId);
      if (type !== "OUTLINE_PROPOSAL" || !Number.isSafeInteger(id) || id <= 0)
        throw new Error("Invalid AOI source.");
      aoi = await approvedAoiPrefill(id);
    }
  } catch (error) {
    const info = functions.errors.publicError(error);
    return (
      <State
        title={
          info.code === "FORBIDDEN"
            ? "Access denied"
            : "Proposal creation unavailable"
        }
        message={info.message}
        action={info.action}
        code={info.code}
      />
    );
  }
  return (
    <main id="proposal-new-page">
      <CreateProposalSummary
        type={type as "PROPOSAL" | "OUTLINE_PROPOSAL"}
        choices={choices}
        sourceRequestId={aoi ? Number(sourceRequestId) : undefined}
        aoi={
          aoi
            ? {
                ...aoi,
                sponsorId:
                  matchSponsor(
                    choices.sponsors.map((row) => ({
                      id: Number(row.value),
                      name: row.label,
                    })),
                    aoi.firstFunder,
                  )?.id ?? null,
              }
            : null
        }
      />
    </main>
  );
}
