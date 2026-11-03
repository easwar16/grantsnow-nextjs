import { eoiFunders } from "@/server/modules/opportunities/eoi";
import { route } from "@/server/http/route";
/** The EOI drawer's funder options, read after the page shows. */
export const GET = route(() => eoiFunders());
