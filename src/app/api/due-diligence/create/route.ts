import { route } from "@/server/http/route";
import {
  createDueDiligence,
  dueDiligenceCreateSetup,
} from "@/server/modules/due-diligence/create";

export const GET = route(() => dueDiligenceCreateSetup());
export const POST = route(
  async (request) => createDueDiligence(await request.json()),
  { write: true },
);
