import { displayFormat } from "@/server/platform/configuration/formatting";
import { pageIdentity } from "@/server/identity/auth/page";
import { proposalPage } from "@/server/modules/proposals/record";
import { recordIdentity } from "@/features/modules/proposals/record";
import { State } from "@/components/feedback/state";
import { functions } from "@/lib/functions";
import { parseProposalMode } from "@/features/modules/proposals/schemas";
import {
  proposalEditValues,
  proposalSponsorChoices,
  proposalEditChoices,
} from "@/server/modules/proposals/edit";
import { Summary } from "@/features/modules/proposals/record/summary";

export const metadata = { title: "Proposal Summary" };

export default async function SummaryPage({
  params,
  searchParams,
}: {
  params: Promise<{ type: string; id: string }>;
  searchParams: Promise<{ mode?: string }>;
}) {
  // Format loads beside the identity and summary, not before them.
  const formatRead = displayFormat();
  formatRead.catch(() => undefined);
  const input = recordIdentity.safeParse(await params);
  if (!input.success)
    return <State title="Invalid proposal identity" code="BAD_REQUEST" />;
  const mode = parseProposalMode((await searchParams).mode);
  if (!mode.success)
    return <State title="Invalid proposal mode" code="BAD_REQUEST" />;
  await pageIdentity(`/proposals/${input.data.type}/${input.data.id}`);
  let summary;
  let editValues: Awaited<ReturnType<typeof proposalEditValues>> | null = null;
  let sponsorChoices: Awaited<
    ReturnType<typeof proposalSponsorChoices>
  > | null = null;
  let editChoices: Awaited<ReturnType<typeof proposalEditChoices>> | null =
    null;
  try {
    summary = (
      await proposalPage(input.data.type, input.data.id, "proposals-summary")
    ).summary;
    if (mode.data === "edit")
      [editValues, sponsorChoices, editChoices] = await Promise.all([
        proposalEditValues(input.data.type, input.data.id),
        proposalSponsorChoices(input.data.type, input.data.id),
        proposalEditChoices(input.data.type, input.data.id),
      ]);
  } catch (e) {
    const error = functions.errors.publicError(e);
    return (
      <State
        title={
          error.code === "FORBIDDEN" ? "Access denied" : "Proposal unavailable"
        }
        message={error.message}
        action={error.action}
        code={error.code}
      />
    );
  }
  return (
    <Summary
      type={input.data.type}
      recordId={input.data.id}
      summary={summary}
      editValues={editValues}
      sponsorChoices={sponsorChoices}
      editChoices={editChoices}
      format={await formatRead}
    />
  );
}
