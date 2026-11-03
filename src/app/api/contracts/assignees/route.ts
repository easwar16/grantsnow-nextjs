import { newContractAssignees } from "@/server/modules/contracts/create";
import { route } from "@/server/http/route";
/** New Contract's Assigned To people, read when the field is first reached. */
export const GET = route(() => newContractAssignees());
