import "server-only";
import { home } from "@/server/oracle/api";
import { homeAccess } from "./service";
import { serverFunctions } from "@/server/functions";
import { grantsEthicsAccess } from "./ethics-access";

/** Both legacy listings use checkApplApprAccess for their approver tab. */
export async function dueDiligenceAccess() {
  const { user, session } = await homeAccess();
  serverFunctions.permissions.requireModule(user, "DUE-DILIGENCE");
  return grantsEthicsAccess(
    await home.ethicsAccess(undefined, { token: session.token }),
  );
}
