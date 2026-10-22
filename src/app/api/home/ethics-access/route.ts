import { ethicsAccess } from "@/server/home/ethics-access";
import { json, failure } from "@/server/api/http";
export async function GET() {
  try {
    return json({ allowed: await ethicsAccess() });
  } catch (e) {
    return failure(e);
  }
}
