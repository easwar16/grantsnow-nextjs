import {
  removeDelegation,
  setDelegationAccess,
} from "@/server/record/objects/delegations";
import {
  badInput,
  delegationHost,
  jsonBody,
} from "@/server/record/objects/hosts";
import { route, searchOf } from "@/server/http/route";
const MAX_BODY = 1024;
type Context = { params: Promise<{ id: string }> };
const invalid = (e: unknown) => badInput(e, "Invalid delegation request.");
/** WRITES one page switch of a delegate: POST ?host&record with `{ type, value }`. */
export const POST = route<Context>(
  async (request, context) => {
    const host = await delegationHost(searchOf(request));
    const { id } = await context.params;
    return setDelegationAccess(host, id, await jsonBody(request, MAX_BODY));
  },
  { write: true, onError: invalid },
);
/** WRITES: removes one delegated page: DELETE ?host&record. */
export const DELETE = route<Context>(
  async (request, context) => {
    const host = await delegationHost(searchOf(request));
    const { id } = await context.params;
    return removeDelegation(host, { id });
  },
  { write: true, onError: invalid },
);
