import "server-only";
import { cache } from "react";
import { z } from "zod";
import { authenticate } from "@/server/identity/session/service";
import { requireModule } from "@/server/platform/permissions";
import { contractRead } from "@/server/oracle/api/contracts";
import { organizations } from "@/server/platform/configuration/service";
import { AppError } from "@/lib/errors";

const rows = z.object({ items: z.array(z.record(z.string(), z.unknown())) });
type Choice = { value: string; label: string };
function choices(raw: unknown, valueKey: string, labelKey: string): Choice[] {
  return [
    ...new Map(
      rows
        .parse(raw)
        .items.flatMap((row) => {
          const value = row[valueKey];
          const label = row[labelKey];
          return (typeof value === "string" || typeof value === "number") &&
            typeof label === "string"
            ? [{ value: String(value), label }]
            : [];
        })
        .map((choice) => [choice.value, choice] as const),
    ).values(),
  ];
}

export const contractSortChoices = cache(async (): Promise<Choice[]> => {
  const { user, session } = await authenticate();
  requireModule(user, "CONTRACTS");
  return choices(
    await contractRead("getSharedGetObjectDates", {
      token: session.token,
      p_obj_type: "CONTRACT",
    }),
    "column_name",
    "column_description",
  ).filter((choice) => /^[A-Za-z][A-Za-z0-9_]{0,62}$/.test(choice.value));
});

export const contractTypeChoices = cache(async (): Promise<Choice[]> => {
  const { user, session } = await authenticate();
  requireModule(user, "CONTRACTS");
  const raw = await contractRead(
    "getPre_awardGetLookupTypesCodes",
    { token: session.token },
    new URLSearchParams({ lookupTypeCode: "CONTRACT_TYPE" }),
  );
  return choices(
    {
      items: rows
        .parse(raw)
        .items.filter((item) => item.lookup_type_code === "CONTRACT_TYPE"),
    },
    "lookup_code",
    "lookup_code_descr",
  );
});

export const contractOrgChoices = cache(async (): Promise<Choice[]> => {
  const { user } = await authenticate();
  requireModule(user, "CONTRACTS");
  return (await organizations()).map((org) => ({
    value: org.id,
    label: org.name,
  }));
});

export const contractListingChoices = cache(async () => {
  const settled = await Promise.allSettled([
    contractTypeChoices(),
    contractOrgChoices(),
    contractSortChoices(),
  ]);
  const errors: string[] = [];
  let types: Choice[] = [];
  let orgs: Choice[] = [];
  let sorts: Choice[] = [];
  if (settled[0].status === "fulfilled") types = settled[0].value;
  else errors.push("Contract Type choices are unavailable.");
  if (settled[1].status === "fulfilled") orgs = settled[1].value;
  else errors.push("Org Unit choices are unavailable.");
  if (settled[2].status === "fulfilled") sorts = settled[2].value;
  else errors.push("Date Sort choices are unavailable.");
  return { types, orgs, sorts, errors };
});

/** Allowlisted dynamic form display model used by the shared VBCS fragment. */
export function mapContractForms(formRaw: unknown) {
  return z
    .array(
      z.object({
        formId: z.number(),
        sections: z
          .array(
            z.object({
              sectionId: z.number(),
              sectionName: z.string(),
              isVisible: z.string().nullish(),
              fields: z
                .array(
                  z.object({
                    fieldId: z.number(),
                    description: z.string(),
                    fieldType: z.string(),
                    isVisible: z.string().nullish(),
                    isRequired: z.string().nullish(),
                    options: z
                      .array(
                        z.object({
                          optionId: z.union([z.string(), z.number()]),
                          optionValue: z.string(),
                        }),
                      )
                      .nullish(),
                  }),
                )
                .nullish(),
            }),
          )
          .nullish(),
      }),
    )
    .parse(formRaw)
    .map((form) => ({
      id: form.formId,
      sections: (form.sections ?? [])
        .filter((section) => section.isVisible !== "N")
        .map((section) => ({
          id: section.sectionId,
          name: section.sectionName,
          fields: (section.fields ?? [])
            .filter((field) => field.isVisible !== "N")
            .map((field) => ({
              id: field.fieldId,
              label: field.description,
              type: field.fieldType,
              required: field.isRequired === "Y",
              options: (field.options ?? []).map((option) => ({
                value: String(option.optionId),
                label: option.optionValue,
              })),
            })),
        })),
    }));
}

/** Standalone creation choices mirror the legacy Contract Summary data providers. */
export const contractRelationChoices = cache(async () => {
  const { user, session } = await authenticate();
  requireModule(user, "CONTRACTS");
  return choices(
    await contractRead("getContractsGetRelationType", { token: session.token }),
    "object_type",
    "object_desc",
  );
});

export const contractDynamicForms = cache(async () => {
  const { user, session } = await authenticate();
  requireModule(user, "CONTRACTS");
  return mapContractForms(
    await contractRead("getProposalEthical_dynFormsP_ref_module", {
      token: session.token,
      p_ref_module: "CONTRACT_HEADER",
      p_obj_type: "CONTRACT",
    }),
  );
});

export const contractDeadlineChoices = cache(async () => {
  const { user, session } = await authenticate();
  requireModule(user, "CONTRACTS");
  const raw = await contractRead(
    "getPre_awardGetLookupTypesCodes",
    { token: session.token },
    new URLSearchParams({ lookupTypeCode: "CTR_DEADLINE_TYPE" }),
  );
  return choices(
    {
      items: rows
        .parse(raw)
        .items.filter((item) => item.lookup_type_code === "CTR_DEADLINE_TYPE"),
    },
    "lookup_code",
    "lookup_code_descr",
  );
});

export const contractCreateChoices = cache(async () => {
  const [listing, relations, forms, deadlineTypes] = await Promise.all([
    contractListingChoices(),
    contractRelationChoices(),
    contractDynamicForms(),
    contractDeadlineChoices(),
  ]);
  return {
    ...listing,
    relations,
    forms,
    deadlineTypes,
  };
});

export async function contractAssignees() {
  const { user, session } = await authenticate();
  requireModule(user, "CONTRACTS");
  return choices(
    await contractRead("getPre_awardGetPersonListAll", {
      token: session.token,
    }),
    "person_id",
    "full_name",
  );
}

export async function contractDependentChoices(input: {
  contractType: string;
  relationType: string;
  orgId: string;
}) {
  const { user, session } = await authenticate();
  requireModule(user, "CONTRACTS");
  const base = await contractCreateChoices();
  if (
    input.contractType &&
    !base.types.some((c) => c.value === input.contractType)
  )
    throw new AppError("BAD_REQUEST", "Unknown Contract Type.", 400);
  if (
    input.relationType &&
    !base.relations.some((c) => c.value === input.relationType)
  )
    throw new AppError("BAD_REQUEST", "Unknown Contract Relation Type.", 400);
  if (input.orgId && !base.orgs.some((c) => c.value === input.orgId))
    throw new AppError("BAD_REQUEST", "Unknown Org Unit.", 400);
  const [templatesRaw, itemsRaw] = await Promise.all([
    input.contractType
      ? contractRead("getContractsGetContractTemplateName", {
          token: session.token,
          contract_type: input.contractType,
          contract_level: input.relationType,
        })
      : Promise.resolve({ items: [] }),
    input.relationType
      ? contractRead("getContractsGetRelationItem", {
          token: session.token,
          object_type: input.relationType,
          ...(input.orgId ? { org_unit_id: input.orgId } : {}),
        })
      : Promise.resolve({ items: [] }),
  ]);
  const templates = choices(templatesRaw, "template_id", "file_name");
  const items = z
    .object({
      items: z.array(
        z.object({
          object_id: z.union([z.string(), z.number()]),
          object_number: z.string(),
          object_title: z.string().nullish(),
        }),
      ),
    })
    .parse(itemsRaw)
    .items.map((item) => ({
      value: String(item.object_id),
      label: `${item.object_number}${item.object_title ? ` — ${item.object_title}` : ""}`,
    }));
  return { templates, items };
}
