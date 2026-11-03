import { insertStatus, nextStatuses } from "@/server/record/objects/history";
import { badInput, historyHost, jsonBody } from "@/server/record/objects/hosts";
import { route, searchOf } from "@/server/http/route";
// A status comment (legacy text area, no configured limit) with room to spare.
const MAX_BODY = 16 * 1024;
/** The statuses Add Status may set now: GET ?host&record. */
export const GET = route(async (request) => ({
  statuses: await nextStatuses(await historyHost(searchOf(request))),
}));
/** WRITES a status (Add Status or Abandon): POST ?host&record with `{ status, comments, responseDate? }`. */
export const POST = route(
  async (request) =>
    insertStatus(
      await historyHost(searchOf(request)),
      await jsonBody(request, MAX_BODY),
    ),
  { write: true, onError: (e) => badInput(e, "Invalid status request.") },
);
