import {
  removeDelegation,
  setDelegationAccess,
} from "@/server/objects/delegations";
import { badInput, delegationHost, jsonBody } from "@/server/objects/hosts";
import { json, failure } from "@/server/api/http";
import { sameOrigin } from "@/lib/security";
import { appOrigin } from "@/server/configuration/environment";
const MAX_BODY = 1024;
type Context = { params: Promise<{ id: string }> };
/** WRITES one page switch of a delegate: POST ?host&record with `{ type, value }`. */
export async function POST(request: Request, context: Context) {
  try {
    sameOrigin(request, appOrigin());
    const host = await delegationHost(new URL(request.url).searchParams);
    const { id } = await context.params;
    return json(
      await setDelegationAccess(host, id, await jsonBody(request, MAX_BODY)),
    );
  } catch (e) {
    return failure(badInput(e, "Invalid delegation request."));
  }
}
/** WRITES: removes one delegated page: DELETE ?host&record. */
export async function DELETE(request: Request, context: Context) {
  try {
    sameOrigin(request, appOrigin());
    const host = await delegationHost(new URL(request.url).searchParams);
    const { id } = await context.params;
    return json(await removeDelegation(host, { id }));
  } catch (e) {
    return failure(badInput(e, "Invalid delegation request."));
  }
}
