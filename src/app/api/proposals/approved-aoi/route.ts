import { route, searchOf } from "@/server/http/route";
import {
  approvedAois,
  approvedAoiSource,
} from "@/server/modules/proposals/create";

export const GET = route(async (request) => {
  const query = searchOf(request);
  const id = query.get("id");
  if (id !== null) return approvedAoiSource(id);
  return approvedAois(Number(query.get("offset") ?? 0));
});
