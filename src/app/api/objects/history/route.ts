import { insertStatus, nextStatuses } from "@/server/objects/history";
import { badInput, historyHost, jsonBody } from "@/server/objects/hosts";
import { json, failure } from "@/server/api/http";
import { sameOrigin } from "@/lib/security";
import { appOrigin } from "@/server/configuration/environment";
// A status comment (legacy text area, no configured limit) with room to spare.
const MAX_BODY = 16 * 1024;
/** The statuses Add Status may set now: GET ?host&record. */
export async function GET(request: Request) {
  try {
    const host = await historyHost(new URL(request.url).searchParams);
    return json({ statuses: await nextStatuses(host) });
  } catch (e) {
    return failure(e);
  }
}
/** WRITES a status (Add Status or Abandon): POST ?host&record with `{ status, comments, responseDate? }`. */
export async function POST(request: Request) {
  try {
    sameOrigin(request, appOrigin());
    const host = await historyHost(new URL(request.url).searchParams);
    return json(await insertStatus(host, await jsonBody(request, MAX_BODY)));
  } catch (e) {
    return failure(badInput(e, "Invalid status request."));
  }
}
