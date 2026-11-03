import { route } from "@/server/http/route";
import { dueDiligenceCreateSupervisors } from "@/server/modules/due-diligence/create";

export const GET = route(() => dueDiligenceCreateSupervisors());
