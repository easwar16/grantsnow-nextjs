import "server-only";
import { z } from "zod";
import { people } from "@/server/oracle/api";
import type { PersonRow } from "@/server/oracle/api/people";
import { resources } from "@/server/platform/configuration/resources";
import type { CreatorCard } from "@/features/record/shell/creator-types";
import { serverFunctions } from "@/server/functions";

const text = z.string().nullish();
const card = z.object({
  full_name: text,
  employee_number: text,
  email_address: text,
  org_unit_name: text,
  position: text,
  school: text,
  address_line: text,
});
// The body is the card itself or an ORDS `items` list holding it.
const body = z.union([
  z.object({ items: z.array(card) }).transform((b) => b.items[0] ?? null),
  card,
]);
const FIELDS = [
  ["full_name", "full-name", "Full Name"],
  ["employee_number", "employee-number", "Employee Number"],
  ["email_address", "email", "Email"],
  ["org_unit_name", "org-unit", "Org Unit"],
  ["position", "position", "Position"],
  ["school", "school", "School"],
  ["address_line", "address", "Address"],
] as const;

/**
 * The Created by card (legacy showCreatorDetails → getContactDetails), for a person the host has already
 * authorised: read with their own org; empty, as legacy opens it, when the person or their org is unknown.
 */
export async function personCard(
  person: PersonRow | null,
  bundle: string,
): Promise<CreatorCard> {
  const [rows, found] = await Promise.all([
    resources(),
    person?.org_unit_id
      ? people
          .contact({ personId: person.person_id, orgId: person.org_unit_id })
          .then((b) => body.parse(b))
      : null,
  ]);
  return {
    title: serverFunctions.resources.label(
      rows,
      bundle,
      "dialog-titles",
      "creator-details",
      "Creator Details",
    ),
    fields: FIELDS.map(([field, key, fallback]) => ({
      key,
      label: serverFunctions.resources.label(
        rows,
        bundle,
        "labels",
        key,
        fallback,
      ),
      value: found?.[field] ?? "",
    })),
  };
}
