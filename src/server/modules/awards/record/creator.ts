import "server-only";
import { personCard } from "@/server/record/objects/creator";
import type { CreatorCard } from "@/features/record/shell/creator-types";
import { awardRecordContext } from "../record";

/** The award panel's Created by card: the award's creator (legacy 9412). */
export async function creatorCard(id: string): Promise<CreatorCard> {
  const context = await awardRecordContext(id);
  return personCard(context.creator, "award");
}
