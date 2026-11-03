import { route } from "@/server/http/route";
import {
  createEthics,
  ethicsCreateSetup,
} from "@/server/modules/ethics/create";

export const GET = route(() => ethicsCreateSetup());
export const POST = route(
  async (request) => createEthics(await request.json()),
  { write: true },
);
