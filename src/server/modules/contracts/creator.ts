import "server-only";
import { people } from "@/server/oracle/api";
import { personCard } from "@/server/record/objects/creator";
import type { CreatorCard } from "@/features/record/shell/creator-types";
import { loadContract } from "./service";

/** The Contract summary's Created by card (legacy showCreatorDetails): the contract's creator, read-access checked. */
export async function contractCreatorCard(id: string): Promise<CreatorCard> {
  const contract = await loadContract(id);
  const staff = contract.createdById ? await people.all() : [];
  return personCard(
    staff.find((p) => String(p.person_id) === contract.createdById) ?? null,
    "contract",
  );
}
