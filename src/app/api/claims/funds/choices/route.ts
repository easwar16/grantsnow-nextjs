import { fundChoices } from "@/server/modules/claims/funds/listing";
import { route, searchOf } from "@/server/http/route";
/** The Funds Inquiry org units (`?list=orgs`), read after the page shows. */
export const GET = route((request) =>
  fundChoices(searchOf(request).get("list") ?? ""),
);
