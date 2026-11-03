import { route } from "@/server/http/route";
import { advancedSetup } from "@/server/modules/proposals/advanced";

export const GET = route(async () => advancedSetup());
