import { pageIdentity } from "@/server/identity/auth/page";
import { dueDiligenceCreateSetup } from "@/server/modules/due-diligence/actions";
import { proposalPage } from "@/server/modules/proposals/record";
import { awardRecordRead } from "@/server/modules/awards/record";
import { recordIdentity } from "@/features/modules/proposals/record";
import { NewDueDiligence } from "@/features/modules/due-diligence/listing/new-due-diligence";
import { State } from "@/components/feedback/state";

export const metadata = { title: "New Due Diligence application" };
export default async function Page({ searchParams }: {
  searchParams: Promise<{ parentType?: string; parentId?: string; proposalType?: string }>;
}) {
  await pageIdentity("/due-diligence");
  const query = await searchParams;
  let parent: { type: "PROPOSAL" | "AWARD"; id: string; proposalType?: string } | undefined;
  if (query.parentType || query.parentId || query.proposalType) {
    const id = query.parentId ?? "";
    if (!/^[1-9]\d{0,14}$/.test(id))
      return <State title="Invalid Due Diligence parent" code="BAD_REQUEST" />;
    if (query.parentType !== "PROPOSAL" && query.parentType !== "AWARD")
      return <State title="Invalid Due Diligence parent" code="BAD_REQUEST" />;
    const proposalType = query.parentType === "PROPOSAL"
      ? recordIdentity.shape.type.safeParse(query.proposalType) : null;
    if (proposalType && !proposalType.success)
      return <State title="Invalid Proposal type" code="BAD_REQUEST" />;
    try {
      if (query.parentType === "PROPOSAL") {
        const type = proposalType && proposalType.success ? proposalType.data : "PROPOSAL";
        const context = await proposalPage(type, id, "proposals-due-diligence");
        if (!context.rights.edit) throw new Error("Create access denied");
        parent = { type: "PROPOSAL", id, proposalType: type };
      } else {
        const context = await awardRecordRead(id, "due-diligence");
        if (context.access.roles.get("awards-due-diligence")?.edit !== true)
          throw new Error("Create access denied");
        parent = { type: "AWARD", id };
      }
    } catch {
      return <State title="Due Diligence parent unavailable" code="FORBIDDEN" />;
    }
  }
  const setup = await dueDiligenceCreateSetup().catch(() => null);
  return setup ? (
    <NewDueDiligence setup={setup} parent={parent} />
  ) : (
    <State
      title="New Due Diligence application unavailable"
      message="This action is not available with your current access."
      code="FORBIDDEN"
    />
  );
}
