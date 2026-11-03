import "server-only";
import { cache } from "react";
import { z } from "zod";
import { authenticate } from "@/server/identity/session/service";
import { lookups, people } from "@/server/oracle/api";
import { organizations } from "@/server/platform/configuration/service";
import { AppError } from "@/lib/errors";
import {
  CHOICE_GROUPS,
  type Choice,
  type ChoiceGroup,
  type ChoiceGroupResult,
} from "@/features/modules/proposals/lookups";
import { serverFunctions } from "@/server/functions";
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
const sortColumn = /^[A-Za-z][A-Za-z0-9_]{0,62}$/;
/** The configured Date Sort columns (legacy fetchDateTypes, `p_obj_type` PROPOSAL); an unsafe name is dropped. */
export const sortChoices = cache(async (): Promise<Choice[]> => {
  return choices(
    await lookups.objectDates({ objectType: "PROPOSAL" }),
    "column_name",
    "column_description",
  ).filter((c) => sortColumn.test(c.value));
});
const FAILURES: Record<ChoiceGroup, string> = {
  codes: "Status/category choices could not be loaded.",
  people: "Investigator/assigned-to choices could not be loaded.",
  sponsors: "Sponsor choices could not be loaded.",
  departments: "Department choices could not be loaded.",
  sorts: "Date sort choices could not be loaded.",
};
/** One group's choices, with its failures; the other groups' keys are absent. */
export async function listingChoices(
  group: string,
): Promise<ChoiceGroupResult> {
  const { user } = await authenticate();
  serverFunctions.permissions.requireModule(user, "PROPOSALS");
  if (!(CHOICE_GROUPS as readonly string[]).includes(group))
    throw new AppError("BAD_REQUEST", "Unknown choice group.", 400);
  const g = group as ChoiceGroup;
  let raw: unknown;
  try {
    raw = await {
      codes: () =>
        lookups.codes({
          types: "PROPOSAL_STATUS,PROPOSAL_TYPES,ACTIVITY_TYPE,PROPOSAL_TYPE",
        }),
      // The listing sends no organisation: everyone, every page.
      people: () => people.inOrg({}),
      sponsors: () => lookups.sponsors(),
      departments: () => organizations(),
      sorts: () => sortChoices(),
    }[g]();
  } catch {
    return { errors: [FAILURES[g]] };
  }
  if (g === "sorts") return { sorts: raw as Choice[], errors: [] };
  if (g === "departments")
    return {
      departments: (raw as Awaited<ReturnType<typeof organizations>>).map(
        (r) => ({ value: r.id, label: r.name }),
      ),
      errors: [],
    };
  try {
    if (g === "people")
      return {
        investigators: choices(raw, "employee_number", "full_name"),
        assignees: choices(raw, "person_id", "full_name"),
        errors: [],
      };
    if (g === "sponsors")
      return {
        sponsors: choices(raw, "party_name", "party_name"),
        errors: [],
      };
    const rows = envelope.parse(raw).items;
    const result: ChoiceGroupResult = {
      errors: [],
    };
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
    return result;
  } catch {
    const what = {
      codes: "Status/category",
      people: "Person",
      sponsors: "Sponsor",
    }[g];
    return { errors: [`${what} choices returned an invalid contract.`] };
  }
}
