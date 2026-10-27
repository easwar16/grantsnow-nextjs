import { awardChoices } from "@/server/modules/awards/listing";
import { route } from "@/server/http/route";
/** The Awards drawer's org units, people and funders, read after the page shows. */
export const GET = route(() => awardChoices());
