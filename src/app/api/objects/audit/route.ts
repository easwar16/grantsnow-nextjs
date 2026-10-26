import { auditView } from "@/server/record/objects/audit";
import { route, searchOf } from "@/server/http/route";
/** The page's audit trail: Contracts also accept NEW VERSION CREATED. */
export const GET = route((request) => auditView(searchOf(request)));
