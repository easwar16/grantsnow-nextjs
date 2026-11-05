import "server-only";
import { z } from "zod";
import { AppError } from "@/lib/errors";
import { dueDiligenceRecord } from "./record";
import { authenticate } from "@/server/identity/session/service";
import { dueDiligence, lookups, people } from "@/server/oracle/api";
import {
  dashboardRoles,
  organizations,
} from "@/server/platform/configuration/service";
import { serverFunctions } from "@/server/functions";
import { resources } from "@/server/platform/configuration/resources";
import { dueDiligenceListView } from "./listing";

const copyRows = z.object({
  items: z.array(
    z.object({
      r: z.string().min(1),
      d: z.string().nullish(),
      default_value: z.boolean().nullish(),
    }),
  ),
});
const body = z
  .object({
    id: z.string().regex(/^[1-9]\d{0,14}$/),
    access: z.enum(["DDA_ACCESS", "RESPONDENT_ACCESS"]),
    objects: z.array(z.string().min(1)).max(100),
  })
  .strict();
const target = z
  .object({
    id: z.string().regex(/^[1-9]\d{0,14}$/),
    access: z.enum(["DDA_ACCESS", "RESPONDENT_ACCESS"]),
  })
  .strict();

async function allowed(raw: unknown, action: "clone" | "delete") {
  const input = (action === "clone" ? body : target).parse(raw);
  const view = await dueDiligenceListView();
  if (!view.actions.clone || (action === "delete" && !view.actions.delete))
    throw new AppError(
      "FORBIDDEN",
      "Due Diligence action access has not been granted.",
      403,
    );
  const record = await dueDiligenceRecord(input.id, input.access);
  if (action === "delete" && record.statusCode !== "DRFT")
    throw new AppError(
      "FORBIDDEN",
      "Only Draft Due Diligence applications can be deleted.",
      403,
    );
  return { input, record };
}

export async function dueDiligenceCloneOptions(id: string, access: string) {
  await allowed({ id, access, objects: [] }, "clone");
  const rows = copyRows.parse(await dueDiligence.copyOptions()).items;
  return rows.map((row) => ({
    value: row.r,
    label: row.d || row.r,
    selected: row.default_value === true,
  }));
}
export async function cloneDueDiligence(raw: unknown) {
  const { input } = await allowed(raw, "clone");
  const selected = body.parse(input);
  const available = copyRows.parse(await dueDiligence.copyOptions()).items;
  const names = new Set(available.map((row) => row.r));
  if (selected.objects.some((name) => !names.has(name)))
    throw new AppError(
      "BAD_REQUEST",
      "Invalid Due Diligence clone selection.",
      400,
    );
  await dueDiligence.copy({
    id: selected.id,
    access: selected.access,
    objects: [...new Set(selected.objects)].map((object_name) => ({
      object_name,
      object_val: true,
    })),
  });
  return { cloned: true };
}
export async function deleteDueDiligence(raw: unknown) {
  const { input } = await allowed(raw, "delete");
  const selected = target.parse(input);
  await dueDiligence.remove({ id: selected.id });
  return { deleted: true };
}
const input = z
  .object({
    title: z.string().trim().min(1).max(400),
    org: z.string().regex(/^[1-9]\d{0,14}$/),
    formType: z.string().regex(/^[A-Z0-9_]{1,40}$/),
    dueDiligenceType: z.string().regex(/^[A-Z0-9_]{1,40}$/),
    deadline: z.union([z.iso.date(), z.literal("")]).nullish(),
    expiry: z.union([z.iso.date(), z.literal("")]).nullish(),
    participants: z
      .array(z.string().regex(/^[1-9]\d{0,14}:[1-9]\d{0,14}$/))
      .max(100)
      .default([]),
    supervisor: z
      .string()
      .regex(/^(-?[0-9]\d{0,14}:[0-9]\d{0,14})?$/)
      .default(""),
  })
  .strict();
const definition = z.array(
  z.object({
    formId: z.coerce.number().int().positive(),
    sections: z.array(
      z.object({
        sectionId: z.coerce.number().int().positive(),
        enabled: z.union([z.boolean(), z.string()]).nullish(),
        isMandatory: z.string().nullish(),
      }),
    ),
  }),
);
const saved = z.object({ setup_flow_id: z.coerce.number().int().positive() });
const personRows = z.object({
  items: z.array(
    z.object({
      person_id: z.coerce.number().int(),
      org_unit_id: z.coerce.number().int().nonnegative(),
      full_name: z.string().nullish(),
      org_unit_name: z.string().nullish(),
    }),
  ),
});
const keyOf = (person: z.infer<typeof personRows>["items"][number]) =>
  `${person.person_id}:${person.org_unit_id}`;

async function requireCreate() {
  const { user } = await authenticate();
  serverFunctions.permissions.requireModule(user, "DUE-DILIGENCE");
  if (
    !serverFunctions.permissions.pageAccess(
      await dashboardRoles(),
      "create-due-diligence-application",
    ).read
  )
    throw new AppError(
      "FORBIDDEN",
      "Creating Due Diligence applications is not enabled for this account.",
      403,
    );
}
async function options(type: string) {
  return serverFunctions.choices
    .statusChoices(await lookups.codes({ types: type }), type)
    .filter((choice) => choice.value !== "");
}
export async function dueDiligenceCreateSetup() {
  await requireCreate();
  const [orgs, types, formTypes, rows] = await Promise.all([
    organizations(),
    options("DUE_DILIGENCE_TYPE"),
    options("DUE_DILIGENCE_FORM_TYPE"),
    resources(),
  ]);
  const t = (group: string, key: string, fallback: string) =>
    serverFunctions.resources.label(
      rows,
      "due_diligence",
      group,
      key,
      fallback,
    );
  return {
    orgs: orgs.map((org) => ({ value: String(org.id), label: org.name })),
    types,
    formTypes,
    labels: {
      heading: t(
        "button-labels",
        "new-due-diligence-application",
        "New Due Diligence Application",
      ),
      save: t("button-labels", "save", "Save draft"),
      overview: t("page-name", "duediligence-general-overview", "Setup"),
      title: t("labels", "dd-project-title", "Project title"),
      org: t("labels", "org-unit", "Org Unit"),
      expiry: t("labels", "expiry-date", "Expiry Date"),
      deadline: t("labels", "deadline-date", "Deadline Date"),
      formType: t("labels", "form-type", "Form Type"),
      type: t("labels", "application-type", "Application type"),
      participants: t("labels", "participants", "Participants"),
      supervisor: t("labels", "supervisor", "Supervisor"),
      list: t("button-labels", "list", "List"),
      cancel: t("button-labels", "cancel", "Cancel"),
    },
  };
}
export async function dueDiligenceCreatePeople(org: string) {
  await requireCreate();
  if (!/^[1-9]\d{0,14}$/.test(org))
    throw new AppError("BAD_REQUEST", "Invalid Org Unit.", 400);
  serverFunctions.permissions.scopeOrganization(org, await organizations());
  const rows = personRows.parse(await people.inOrg({ orgId: org })).items;
  return rows.map((person) => ({
    value: keyOf(person),
    label: person.full_name ?? String(person.person_id),
    detail: person.org_unit_name ?? "",
  }));
}
export async function dueDiligenceCreateSupervisors() {
  await requireCreate();
  const rows = personRows.parse(await dueDiligence.supervisors()).items;
  return rows.map((person) => ({
    value: keyOf(person),
    label: person.full_name ?? String(person.person_id),
  }));
}
export async function dueDiligenceCreateForm(formType: string) {
  await requireCreate();
  const setup = await dueDiligenceCreateSetup();
  if (!setup.formTypes.some((option) => option.value === formType))
    throw new AppError("BAD_REQUEST", "Unknown Due Diligence form type.", 400);
  const forms = definition.safeParse(await dueDiligence.form({ formType }));
  if (!forms.success || !forms.data.length || !forms.data[0].sections.length)
    throw new AppError(
      "CONTRACT",
      "Due Diligence form metadata is unavailable.",
    );
  return {
    formId: forms.data[0].formId,
    sections: forms.data[0].sections.map((section) => ({
      id: String(section.sectionId),
      enabled:
        section.enabled === true ||
        section.enabled === "true" ||
        section.isMandatory === "Y",
    })),
  };
}
export async function createDueDiligence(raw: unknown) {
  const value = input.safeParse(raw);
  if (!value.success)
    throw new AppError(
      "BAD_REQUEST",
      "Invalid Due Diligence application.",
      400,
    );
  await requireCreate();
  const setup = await dueDiligenceCreateSetup();
  const {
    title,
    org,
    formType,
    dueDiligenceType,
    deadline,
    expiry,
    participants,
    supervisor,
  } = value.data;
  serverFunctions.permissions.scopeOrganization(org, await organizations());
  if (
    !setup.types.some((option) => option.value === dueDiligenceType) ||
    !setup.formTypes.some((option) => option.value === formType)
  )
    throw new AppError("BAD_REQUEST", "Unknown Due Diligence type.", 400);
  const form = await dueDiligenceCreateForm(formType);
  const [availablePeople, availableSupervisors] = await Promise.all([
    participants.length
      ? personRows.parse(await people.inOrg({ orgId: org })).items
      : Promise.resolve([]),
    supervisor
      ? personRows.parse(await dueDiligence.supervisors()).items
      : Promise.resolve([]),
  ]);
  const personByKey = new Map(
    availablePeople.map((person) => [keyOf(person), person]),
  );
  const supervisorByKey = new Map(
    availableSupervisors.map((person) => [keyOf(person), person]),
  );
  if (
    participants.some((key) => !personByKey.has(key)) ||
    (supervisor && !supervisorByKey.has(supervisor))
  )
    throw new AppError(
      "BAD_REQUEST",
      "Selected participant or supervisor is unavailable.",
      400,
    );
  for (const key of participants)
    serverFunctions.permissions.scopeOrganization(
      String(personByKey.get(key)!.org_unit_id),
      await organizations(),
    );
  const selectedSupervisor = supervisor
    ? supervisorByKey.get(supervisor)!
    : null;
  const sections = form.sections
    .filter((section) => section.enabled)
    .map((section) => ({
      section_id: Number(section.id),
      enabled_by: "DUE_DILIGENCE_ADMIN",
      setup_id: null,
    }));
  if (!sections.length)
    throw new AppError(
      "BAD_REQUEST",
      "The selected Due Diligence form has no enabled sections.",
      400,
    );
  const result = saved.safeParse(
    await dueDiligence.save({
      body: {
        setup_description: title,
        application_number: null,
        action_type: "SAVE",
        approver: null,
        enabled_by: "DUE_DILIGENCE_ADMIN",
        form_id: form.formId,
        obj_ref_id: null,
        obj_ref_type: null,
        org_unit_id: Number(org),
        expiry_date: expiry || null,
        deadline_date: deadline || null,
        ethics_type: dueDiligenceType,
        reviewer: selectedSupervisor
          ? [
              {
                id: selectedSupervisor.person_id,
                type: "INDIVIDUAL",
                org_unit_id: selectedSupervisor.org_unit_id,
              },
            ]
          : null,
        sections,
        object_type: "DUE_DILIGENCE",
        setup_flow_id: null,
        stakeholders: participants.map((key) => {
          const person = personByKey.get(key)!;
          return {
            form_id: form.formId,
            obj_ref_id: null,
            obj_ref_type: null,
            p_id: person.person_id,
            org_unit_name: person.org_unit_name,
            org_unit_id: person.org_unit_id,
          };
        }),
        reference_objects: [],
        ethics_form_type: formType,
      },
    }),
  );
  if (!result.success)
    throw new AppError(
      "CONTRACT",
      "Oracle returned an invalid Due Diligence application.",
    );
  return { id: String(result.data.setup_flow_id) };
}

const rows = z.object({
  items: z.array(
    z.object({
      setup_flow_id: z.coerce.number().int().positive(),
      application_number: z.string(),
      setup_description: z.string().nullish(),
      status: z.string().nullish(),
      org_unit_id: z.coerce.number().int().positive(),
      org_unit_name: z.string().nullish(),
      parent_proposal_id: z.coerce.number().nullish(),
    }),
  ),
});
async function access() {
  const view = await dueDiligenceListView();
  if (!view.actions.recycle || !view.tabs.length)
    throw new AppError(
      "FORBIDDEN",
      "Due Diligence recycle access has not been granted.",
      403,
    );
}
export async function deletedDueDiligence() {
  await access();
  const [body, orgs] = await Promise.all([
    dueDiligence.deleted(),
    organizations(),
  ]);
  const allowed = new Set(orgs.map((org) => String(org.id)));
  return rows
    .parse(body)
    .items.filter((row) => allowed.has(String(row.org_unit_id)))
    .map((row) => ({
      id: String(row.setup_flow_id),
      number: row.application_number,
      title: row.setup_description ?? "",
      status: row.status ?? "",
      org: row.org_unit_name ?? "",
      canRestore: !row.parent_proposal_id,
    }));
}
export async function restoreDueDiligence(raw: unknown) {
  const { id } = z.object({ id: z.string() }).strict().parse(raw);
  const recordId = z.coerce.number().int().positive().parse(id);
  const found = (await deletedDueDiligence()).find(
    (row) => row.id === String(recordId) && row.canRestore,
  );
  if (!found)
    throw new AppError(
      "FORBIDDEN",
      "Due Diligence application not found or access denied.",
      403,
    );
  await dueDiligence.restore({ id: String(recordId) });
  return { restored: true };
}
