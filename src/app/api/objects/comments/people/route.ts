import { mentionPeople } from "@/server/record/objects/comments";
import { route, searchOf } from "@/server/http/route";
/** The @mention feed for a page the user may comment on: GET ?type&id&page. */
export const GET = route((request) => mentionPeople(searchOf(request)));
