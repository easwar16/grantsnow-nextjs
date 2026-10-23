import { auditView } from "@/server/record/objects/audit";
import { route, searchOf } from "@/server/http/route";
/** The page's audit trail: GET ?type&id&page&event (ALL, INSERTED, UPDATED, DELETED). */
export const GET = route((request) => auditView(searchOf(request)));
