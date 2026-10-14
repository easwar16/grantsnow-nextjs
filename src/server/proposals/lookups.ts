import "server-only";
import { cache } from "react";
import { z } from "zod";
import { authenticate } from "@/server/session/service";
import { requireModule } from "@/server/permissions/policy";
import { oracle } from "@/server/api/transport";
import { organizations } from "@/server/configuration/service";
import type { Choice, ListingChoices } from "@/features/proposals/lookups";
const envelope = z.object({
  items: z.array(z.record(z.string(), z.unknown())),
});
function choices(raw: unknown, value: string, label: string): Choice[] {
  const options = envelope.parse(raw).items.flatMap((row) => {
    const v = row[value],
      l = row[label];
    if (
      (typeof v !== "string" && typeof v !== "number") ||
      typeof l !== "string"
    )
      return [];
    return [{ value: String(v), label: l }];
  });
  // LOVs can contain multiple people with the same employee number, or sponsor
  // rows sharing a party name. A filter value must have one selectable option.
  return [...new Map(options.map((option) => [option.value, option])).values()];
}
export const listingChoices = cache(async (): Promise<ListingChoices> => {
  const { session, user } = await authenticate();
  requireModule(user, "PROPOSALS");
  const headers = { token: session.token };
  const settled = await Promise.allSettled([
    oracle(
      "getPre_awardGetLookupTypesCodes",
      headers,
      new URLSearchParams({
        lookupTypeCode:
          "PROPOSAL_STATUS,PROPOSAL_TYPES,ACTIVITY_TYPE,PROPOSAL_TYPE",
      }),
    ),
    oracle("getPre_awardGetPersonList", headers),
    oracle("GetSponsorList", headers),
    organizations(),
  ]);
  const result: ListingChoices = {
    statuses: [],
    categories: [],
    investigators: [],
    assignees: [],
    departments: [],
    sponsors: [],
    activities: [],
    proposalTypes: [],
    errors: [],
  };
  const labels = [
    "Status/category",
    "Investigator/assigned-to",
    "Sponsor",
    "Department",
  ];
  settled.forEach((r, i) => {
    if (r.status === "rejected")
      result.errors.push(`${labels[i]} choices could not be loaded.`);
  });
  try {
    if (settled[0].status === "fulfilled") {
      const rows = envelope.parse(settled[0].value).items;
      for (const [type, key, description] of [
        ["PROPOSAL_STATUS", "statuses", false],
        ["PROPOSAL_TYPES", "categories", true],
        ["ACTIVITY_TYPE", "activities", false],
        ["PROPOSAL_TYPE", "proposalTypes", false],
      ] as const) {
        result[key] = choices(
          { items: rows.filter((r) => r.lookup_type_code === type) },
          "lookup_code",
          description ? "lookup_code_descr" : "lookup_code_value",
        );
      }
    }
  } catch {
    result.errors.push("Status/category choices returned an invalid contract.");
  }
  try {
    if (settled[1].status === "fulfilled") {
      result.investigators = choices(
        settled[1].value,
        "employee_number",
        "full_name",
      );
      result.assignees = choices(settled[1].value, "person_id", "full_name");
    }
  } catch {
    result.errors.push("Person choices returned an invalid contract.");
  }
  try {
    if (settled[2].status === "fulfilled")
      result.sponsors = choices(settled[2].value, "party_name", "party_name");
  } catch {
    result.errors.push("Sponsor choices returned an invalid contract.");
  }
  if (settled[3].status === "fulfilled")
    result.departments = settled[3].value.map((r) => ({
      value: r.id,
      label: r.name,
    }));
  return result;
});
