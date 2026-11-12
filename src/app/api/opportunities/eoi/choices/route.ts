import { eoiFunders } from "@/server/modules/opportunities/eoi";
import { route, searchOf } from "@/server/http/route";
import { AppError } from "@/lib/errors";
/** One of the EOI listing's choice lists (`?list=funders`): the drawer's funder options, read after the page shows. */
export const GET = route((request) => {
  if (searchOf(request).get("list") !== "funders")
    throw new AppError("BAD_REQUEST", "Unknown choice list.", 400);
  return eoiFunders();
});
