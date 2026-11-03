import {
  attributesQuery,
  loadAttributes,
} from "@/server/record/attributes/service";
import { route, searchOf } from "@/server/http/route";
/** A host's object attributes: ?host&parentId&objectId (the panel's values travel in the host's own save). */
export const GET = route((request) =>
  loadAttributes(attributesQuery(searchOf(request))),
);
