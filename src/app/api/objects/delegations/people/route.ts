import { delegationPeople } from "@/server/objects/delegations";
import { delegationHost } from "@/server/objects/hosts";
import { json, failure } from "@/server/api/http";
/** The Add Delegation picker's people: GET ?host&record (needs the host's edit right). */
export async function GET(request: Request) {
  try {
    const host = await delegationHost(new URL(request.url).searchParams);
    return json(await delegationPeople(host));
  } catch (e) {
    return failure(e);
  }
}
