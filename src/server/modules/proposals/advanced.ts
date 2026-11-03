import "server-only";
import { cache } from "react";
import { z } from "zod";
import { AppError } from "@/lib/errors";
import { authenticate } from "@/server/identity/session/service";
import { attributes, proposals } from "@/server/oracle/api";
import { resources } from "@/server/platform/configuration/resources";
import { serverFunctions } from "@/server/functions";
import type { ProposalCondition } from "@/features/modules/proposals/schemas";

const fieldRows = z.object({
  fields: z
    .array(
      z.object({
        attributeName: z.string(),
        description: z.string().nullish(),
      }),
    )
    .nullish(),
});
const probeRows = z.object({
  items: z.array(z.record(z.string(), z.unknown())),
});
const columnName = /^[A-Za-z][A-Za-z0-9_]{0,62}$/;
const titleCase = (key: string) =>
  key
    .toLowerCase()
    .replace(/_/g, " ")
    .replace(/(?: |\b)(\w)/g, (text) => text.toUpperCase());

/** VBCS refreshProposalAttributesChain probes the advanced view and names custom columns from object attributes. */
export const advancedAttributes = cache(async () => {
  const { user } = await authenticate();
  serverFunctions.permissions.requireModule(user, "PROPOSALS");
  const [rawFields, rawProbe] = await Promise.all([
    attributes.fields({ objectType: "PROPOSAL", objectId: "" }),
    proposals.advancedList({
      query: new URLSearchParams({ p_offset: "0", p_limit: "1" }),
    }),
  ]);
  const fields = fieldRows.parse(rawFields).fields ?? [];
  const first = probeRows.parse(rawProbe).items[0];
  return Object.keys(first ?? {}).flatMap((key) => {
    if (!columnName.test(key)) return [];
    if (!key.includes("attribute"))
      return [{ value: key, label: titleCase(key) }];
    const name = fields.find(
      (field) => field.attributeName === key,
    )?.description;
    return name ? [{ value: key, label: name }] : [];
  });
});

export async function advancedSetup() {
  const [columns, labels] = await Promise.all([
    advancedAttributes(),
    resources(),
  ]);
  const label = (group: string, key: string, fallback: string) =>
    serverFunctions.resources.label(labels, "proposal", group, key, fallback);
  return {
    attributes: columns,
    operators: [
      { value: "$eq", label: "Equals (=)" },
      { value: "$co", label: "Contains (LIKE)" },
      { value: "$gt", label: "Greater than (>)" },
      { value: "$lt", label: "Less than (<)" },
      { value: "$ge", label: "Greater than or equals (>=)" },
      { value: "$le", label: "Less than or equals (<=)" },
    ],
    texts: {
      title: label("button-labels", "advanced-query", "Advanced Query"),
      attribute: label("labels", "attribute", "Attribute"),
      operator: label("labels", "operator", "Operator"),
      value: label("labels", "value", "Value"),
      add: label("button-labels", "add-condition", "Add Condition"),
      edit: label("button-labels", "edit", "Edit"),
      remove: label("button-labels", "delete", "Delete"),
      save: label("button-labels", "save", "Save"),
      cancel: label("button-labels", "cancel", "Cancel"),
      close: label("button-labels", "close", "Close"),
      editTitle: label("dialog-titles", "edit-condition", "Edit Condition"),
    },
  };
}

export async function checkConditions(conditions: ProposalCondition[]) {
  if (!conditions.length) return;
  const offered = new Set((await advancedAttributes()).map((row) => row.value));
  if (conditions.some((condition) => !offered.has(condition.attribute)))
    throw new AppError("BAD_REQUEST", "Unknown Advanced Query attribute.", 400);
}
