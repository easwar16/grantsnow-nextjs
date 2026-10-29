import { listingChoices } from "@/server/modules/proposals/lookups";
import { route, searchOf } from "@/server/http/route";
/** One of the Proposals listing's choice groups (`?group=codes|people|sponsors|departments|sorts`). */
export const GET = route((request) =>
  listingChoices(searchOf(request).get("group") ?? ""),
);
