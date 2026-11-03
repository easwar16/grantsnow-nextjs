import { unitChoices } from "@/server/modules/claims/units/listing";
import { route, searchOf } from "@/server/http/route";
/** The Unit Inquiry org units (`?list=orgs`), read after the page shows. */
export const GET = route((request) =>
  unitChoices(searchOf(request).get("list") ?? ""),
);
