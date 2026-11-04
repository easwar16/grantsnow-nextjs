import { pageIdentity } from "@/server/identity/auth/page";
import { dueDiligenceCreateSetup } from "@/server/modules/due-diligence/actions";
import { NewDueDiligence } from "@/features/modules/due-diligence/listing/new-due-diligence";
import { State } from "@/components/feedback/state";

export const metadata = { title: "New Due Diligence application" };
export default async function Page() {
  await pageIdentity("/due-diligence");
  const setup = await dueDiligenceCreateSetup().catch(() => null);
  return setup ? (
    <NewDueDiligence setup={setup} />
  ) : (
    <State
      title="New Due Diligence application unavailable"
      message="This action is not available with your current access."
      code="FORBIDDEN"
    />
  );
}
