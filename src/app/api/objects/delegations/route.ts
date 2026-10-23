import {
  removeDelegation,
  submitDelegation,
} from "@/server/objects/delegations";
import { badInput, delegationHost, jsonBody } from "@/server/objects/hosts";
import { json, failure } from "@/server/api/http";
import { sameOrigin } from "@/lib/security";
import { appOrigin } from "@/server/configuration/environment";
// People and every delegable page of a record.
const MAX_BODY = 64 * 1024;
/** WRITES a delegation (Add Delegation or Edit Access): POST ?host&record. */
export async function POST(request: Request) {
  try {
    sameOrigin(request, appOrigin());
    const host = await delegationHost(new URL(request.url).searchParams);
    return json(
      await submitDelegation(host, await jsonBody(request, MAX_BODY)),
    );
  } catch (e) {
    return failure(badInput(e, "Invalid delegation request."));
  }
}
/** WRITES: removes a delegate and every page delegated to them: DELETE ?host&record&person. */
export async function DELETE(request: Request) {
  try {
    sameOrigin(request, appOrigin());
    const q = new URL(request.url).searchParams;
    const host = await delegationHost(q);
    return json(
      await removeDelegation(host, { person: q.get("person") ?? "" }),
    );
  } catch (e) {
    return failure(badInput(e, "Invalid delegation request."));
  }
}
