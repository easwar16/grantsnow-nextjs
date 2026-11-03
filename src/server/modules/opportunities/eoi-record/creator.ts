import "server-only";
import { personCard } from "@/server/record/objects/creator";
import type { CreatorCard } from "@/features/record/shell/creator-types";
import { eoiRecordContext } from "../record";

/** The EOI panel's Created by card: the application's creator (legacy fetchAOIDataChain getPersonData). */
export async function eoiCreatorCard(id: string): Promise<CreatorCard> {
  const context = await eoiRecordContext(id);
  return personCard(context.creator, "opportunities-eoi");
}
