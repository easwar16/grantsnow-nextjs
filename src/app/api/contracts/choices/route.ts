import { newContractChoices } from "@/server/modules/contracts/create";
import { route, searchOf } from "@/server/http/route";
/** New Contract's dependent choices: GET ?contractType&relationType&orgId. */
export const GET = route((request) => newContractChoices(searchOf(request)));
