import { awardChoices } from "@/server/modules/awards/listing";
import { route, searchOf } from "@/server/http/route";
/** One of the Awards drawer's choice lists (`?list=orgs|people|parties`), read after the page shows. */
export const GET = route((request) =>
  awardChoices(searchOf(request).get("list") ?? ""),
);
