import { pageIdentity } from "@/server/identity/auth/page";
import { ethicsCreateSetup } from "@/server/modules/ethics/actions";
import { NewEthics } from "@/features/modules/ethics/listing/new-ethics";
import { State } from "@/components/feedback/state";
import { proposalPage } from "@/server/modules/proposals/record";
import { recordIdentity } from "@/features/modules/proposals/record";
import type { CreateEthics } from "@/lib/api/endpoints/ethics";

export const metadata = { title: "New Ethics application" };
export default async function Page({ searchParams }: {
  searchParams: Promise<{ parentType?: string; parentId?: string; proposalType?: string }>;
}) {
  await pageIdentity("/ethics");
  const query = await searchParams;
  let parent: CreateEthics["parent"];
  if (query.parentType || query.parentId || query.proposalType) {
    const parsed = recordIdentity.safeParse({ type: query.proposalType, id: query.parentId });
    if (query.parentType !== "PROPOSAL" || !parsed.success)
      return <State title="Invalid Ethics parent" code="BAD_REQUEST" />;
    try {
      const context = await proposalPage(parsed.data.type, parsed.data.id, "proposals-ethics");
      if (context.rights.edit !== true) throw new Error("Create access denied");
      parent = { type: "PROPOSAL", id: parsed.data.id, proposalType: parsed.data.type };
    } catch {
      return <State title="Proposal Ethics creation unavailable" code="FORBIDDEN" />;
    }
  }
  const setup = await ethicsCreateSetup().catch(() => null);
  return setup ? (
    <NewEthics setup={setup} parent={parent} />
  ) : (
    <State
      title="New Ethics application unavailable"
      message="This action is not available with your current access."
      code="FORBIDDEN"
    />
  );
}
