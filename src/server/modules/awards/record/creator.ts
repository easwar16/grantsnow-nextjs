import "server-only";
import { personCard } from "@/server/record/objects/creator";
import type { CreatorCard } from "@/features/record/shell/creator-types";
import { awardRecordContext } from "../record";

/** The award panel's Created by card: the award's PI (legacy labels the PI "Created by"). */
export async function creatorCard(id: string): Promise<CreatorCard> {
  const context = await awardRecordContext(id);
  return personCard(context.piPerson, "award");
}
