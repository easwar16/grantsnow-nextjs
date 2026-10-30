import "server-only";
import type { RecordIdentity } from "@/features/modules/proposals/record";
import type { DelegationHost } from "@/server/record/objects/delegations";
import { proposalPage } from "./record";

export async function proposalDelegationHost(
  type: RecordIdentity["type"],
  id: string,
): Promise<DelegationHost> {
  const context = await proposalPage(type, id, "proposals-delegation");
  return {
    token: context.session.token,
    user: context.user,
    objectType: type,
    objectId: id,
    bundle: context.bundle,
    defaultPage: "proposals-summary",
    rights: { edit: false, delete: false },
  };
}
