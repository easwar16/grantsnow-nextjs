import {
  removeDelegation,
  submitDelegation,
} from "@/server/record/objects/delegations";
import {
  badInput,
  delegationHost,
  jsonBody,
} from "@/server/record/objects/hosts";
import { route, searchOf } from "@/server/http/route";
// People and every delegable page of a record.
const MAX_BODY = 64 * 1024;
const invalid = (e: unknown) => badInput(e, "Invalid delegation request.");
/** WRITES a delegation (Add Delegation or Edit Access): POST ?host&record. */
export const POST = route(
  async (request) =>
    submitDelegation(
      await delegationHost(searchOf(request)),
      await jsonBody(request, MAX_BODY),
    ),
  { write: true, onError: invalid },
);
/** WRITES: removes a delegate and every page delegated to them: DELETE ?host&record&person. */
export const DELETE = route(
  async (request) => {
    const q = searchOf(request);
    return removeDelegation(await delegationHost(q), {
      person: q.get("person") ?? "",
    });
  },
  { write: true, onError: invalid },
);
