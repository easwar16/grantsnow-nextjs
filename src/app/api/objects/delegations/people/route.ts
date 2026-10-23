import { delegationPeople } from "@/server/record/objects/delegations";
import { delegationHost } from "@/server/record/objects/hosts";
import { route, searchOf } from "@/server/http/route";
/** The Add Delegation picker's people: GET ?host&record (needs the host's edit right). */
export const GET = route(async (request) =>
  delegationPeople(await delegationHost(searchOf(request))),
);
