import { ethicsAccess } from "@/server/modules/home/ethics-access";
import { route } from "@/server/http/route";
export const GET = route(async () => ({ allowed: await ethicsAccess() }));
