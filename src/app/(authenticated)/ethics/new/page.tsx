import { pageIdentity } from "@/server/identity/auth/page";
import { ethicsCreateSetup } from "@/server/modules/ethics/create";
import { NewEthics } from "@/features/modules/ethics/new";
import { State } from "@/components/feedback/state";

export const metadata = { title: "New Ethics application" };
export default async function Page() {
  await pageIdentity("/ethics");
  const setup = await ethicsCreateSetup().catch(() => null);
  return setup ? (
    <NewEthics setup={setup} />
  ) : (
    <State
      title="New Ethics application unavailable"
      message="This action is not available with your current access."
      code="FORBIDDEN"
    />
  );
}
