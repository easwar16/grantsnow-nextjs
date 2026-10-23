import { auditView } from "@/server/objects/audit";
import { json, failure } from "@/server/api/http";
/** The page's audit trail: GET ?type&id&page&event (ALL, INSERTED, UPDATED, DELETED). */
export async function GET(request: Request) {
  try {
    return json(await auditView(new URL(request.url).searchParams));
  } catch (e) {
    return failure(e);
  }
}
