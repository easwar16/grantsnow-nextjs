import "server-only";
import { z } from "zod";
import { AppError } from "@/lib/errors";
import { dueDiligenceRecord } from "./record";
import { proposalPage } from "@/server/modules/proposals/record";
import { recordIdentity } from "@/features/modules/proposals/record";
import { awardRecordRead } from "@/server/modules/awards/record";
import { dueDiligenceListView, listDueDiligence } from "./listing";
import { defaultDueDiligenceFilters } from "@/features/modules/due-diligence/listing/schema";
import { authenticate } from "@/server/identity/session/service";
import {
  applications,
  configuration,
  dynamicForm,
  lookups,
  people,
} from "@/server/oracle/api";
import {
  dashboardRoles,
  organizations,
} from "@/server/platform/configuration/service";
import { serverFunctions } from "@/server/functions";
import { resources } from "@/server/platform/configuration/resources";

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
  const rows = copyRows.parse(
    await applications.copyOptions({ objectType: "DUE_DILIGENCE" }),
  ).items;
  return rows.map((row) => ({
    value: row.r,
    label: row.d || row.r,
    selected: row.default_value === true,
  }));
}
export async function cloneDueDiligence(raw: unknown) {
  const { input } = await allowed(raw, "clone");
  const selected = body.parse(input);
  const available = copyRows.parse(
    await applications.copyOptions({ objectType: "DUE_DILIGENCE" }),
  ).items;
  const names = new Set(available.map((row) => row.r));
  if (selected.objects.some((name) => !names.has(name)))
    throw new AppError(
      "BAD_REQUEST",
      "Invalid Due Diligence clone selection.",
      400,
    );
  await applications.copy({
    objectType: "DUE_DILIGENCE",
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
  await applications.remove({ id: selected.id });
  return { deleted: true };
}
const input = z
  .object({
    title: z.string().trim().min(1).max(400),
    action: z.enum(["draft", "submit"]).default("draft"),
    org: z.string().regex(/^[1-9]\d{0,14}$/),
    formType: z.string().regex(/^[A-Z0-9_]{1,40}$/),
    dueDiligenceType: z.string().regex(/^[A-Z0-9_]{1,40}$/),
    deadline: z.union([z.iso.date(), z.literal("")]).nullish(),
    expiry: z.union([z.iso.date(), z.literal("")]).nullish(),
    participants: z
      .array(z.string().regex(/^[1-9]\d{0,14}:[1-9]\d{0,14}$/))
      .max(100)
      .default([]),
    parent: z
      .object({
        type: z.enum(["PROPOSAL", "AWARD"]),
        id: z.string().regex(/^[1-9]\d{0,14}$/),
        proposalType: recordIdentity.shape.type.optional(),
      })
      .strict()
      .optional(),
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
const saved = z.object({
  setup_flow_id: z.coerce.number().int().positive(),
  stakeholders: z
    .array(
      z.object({
        id: z.coerce.number().int().positive(),
        p_id: z.coerce.number().int().positive(),
      }),
    )
    .optional(),
});
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
const supervisorRows = z.object({
  items: z.array(
    z.object({
      person_id: z.coerce.number().int(),
      org_unit_id: z.coerce.number().int().nonnegative().optional(),
      full_name: z.string().nullish(),
      org_unit_name: z.string().nullish(),
    }),
  ),
});
function selectableSupervisors(raw: unknown) {
  return supervisorRows
    .parse(raw)
    .items.flatMap((person) =>
      person.person_id > 0 && person.org_unit_id !== undefined
        ? [{ ...person, org_unit_id: person.org_unit_id }]
        : [],
    );
}
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
  return user;
}
async function requireSetup(id?: string, access?: string) {
  if (!id) return { user: await requireCreate(), record: null };
  if (!/^[1-9]\d{0,14}$/.test(id))
    throw new AppError("BAD_REQUEST", "Invalid Due Diligence record.", 400);
  const [record, { user }] = await Promise.all([
    dueDiligenceRecord(id, access),
    authenticate(),
  ]);
  const overview = "duediligence-general-overview";
  const forceEdit =
    record.rights["due-diligence-change-setup"]?.edit === true &&
    record.respondents.every((row) => row.statusCode === "DRFT");
  if (
    !record.tabs.includes(overview) ||
    !record.rights[overview]?.edit ||
    (record.statusCode !== "DRFT" && !forceEdit)
  )
    throw new AppError(
      "FORBIDDEN",
      "Due Diligence setup editing is unavailable.",
      403,
    );
  return { user, record };
}
async function options(type: string) {
  return serverFunctions.choices
    .statusChoices(await lookups.codes({ types: type }), type)
    .filter((choice) => choice.value !== "");
}
export async function dueDiligenceCreateSetup(id?: string, access?: string) {
  const { user, record } = await requireSetup(id, access);
  const [orgs, types, formTypes, rows, globals] = await Promise.all([
    organizations(),
    options("DUE_DILIGENCE_TYPE"),
    options("DUE_DILIGENCE_FORM_TYPE"),
    resources(),
    configuration.globalVariables(),
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
    currentPersonId: String(user.personId),
    adminAnswer: globals.some(
      (row) =>
        row.var_key === "DUE_DILIGENCE_ADMIN_ANSWER" && row.var_value === "Y",
    ),
    orgs: orgs.map((org) => ({ value: String(org.id), label: org.name })),
    types,
    formTypes,
    labels: {
      heading: t(
        "button-labels",
        "new-due-diligence-application",
        record
          ? "Edit Due Diligence Application"
          : "New Due Diligence Application",
      ),
      save: t("button-labels", "save", "Save draft"),
      submit: t("button-labels", "submit", "Submit"),
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
export async function dueDiligenceCreatePeople(
  org: string,
  id?: string,
  access?: string,
) {
  await requireSetup(id, access);
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
export async function dueDiligenceCreateSupervisors(
  id?: string,
  access?: string,
) {
  await requireSetup(id, access);
  const rows = selectableSupervisors(await applications.approvers());
  return rows.map((person) => ({
    value: keyOf(person),
    label: person.full_name ?? String(person.person_id),
  }));
}
export async function dueDiligenceCreateForm(
  formType: string,
  id?: string,
  access?: string,
) {
  const setup = await dueDiligenceCreateSetup(id, access);
  if (!setup.formTypes.some((option) => option.value === formType))
    throw new AppError("BAD_REQUEST", "Unknown Due Diligence form type.", 400);
  const forms = definition.safeParse(
    await dynamicForm.forms({
      objectId: "",
      objectType: "DUE_DILIGENCE",
      slot: "DUE_DILIGENCE",
      tag: { type: "DUE_DILIGENCE_TYPE", value: formType },
    }),
  );
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
    action,
    org,
    formType,
    dueDiligenceType,
    deadline,
    expiry,
    participants,
    supervisor,
    parent,
  } = value.data;
  serverFunctions.permissions.scopeOrganization(org, await organizations());
  if (parent) await requireParent(parent, "create");
  if (
    !setup.types.some((option) => option.value === dueDiligenceType) ||
    !setup.formTypes.some((option) => option.value === formType)
  )
    throw new AppError("BAD_REQUEST", "Unknown Due Diligence type.", 400);
  if (action === "submit" && (!participants.length || !supervisor))
    throw new AppError(
      "BAD_REQUEST",
      !participants.length
        ? "Select at least one participant before submitting."
        : "Select a supervisor before submitting.",
      400,
    );
  const form = await dueDiligenceCreateForm(formType);
  const [availablePeople, availableSupervisors] = await Promise.all([
    participants.length
      ? personRows.parse(await people.inOrg({ orgId: org })).items
      : Promise.resolve([]),
    supervisor
      ? selectableSupervisors(await applications.approvers())
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
      // Legacy newReference: a referenced create enables its sections as PROPOSAL.
      enabled_by: parent ? "PROPOSAL" : "DUE_DILIGENCE_ADMIN",
      setup_id: null,
    }));
  if (!sections.length)
    throw new AppError(
      "BAD_REQUEST",
      "The selected Due Diligence form has no enabled sections.",
      400,
    );
  const result = saved.safeParse(
    await applications.save({
      body: {
        setup_description: title,
        application_number: null,
        action_type: action === "submit" ? "SUBMIT" : "SAVE",
        approver: null,
        enabled_by: parent ? "PROPOSAL" : "DUE_DILIGENCE_ADMIN",
        form_id: form.formId,
        obj_ref_id: parent ? Number(parent.id) : null,
        obj_ref_type: parent?.type ?? null,
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
        reference_objects: parent
          ? [
              {
                obj_ref_id: Number(parent.id),
                obj_ref_type: parent.type,
                reln_id: null,
              },
            ]
          : [],
        ethics_form_type: formType,
      },
    }),
  );
  if (!result.success)
    throw new AppError(
      "CONTRACT",
      "Oracle returned an invalid Due Diligence application.",
    );
  const creator = await authenticate();
  return {
    id: String(result.data.setup_flow_id),
    respondentId:
      result.data.stakeholders
        ?.find((row) => String(row.p_id) === String(creator.user.personId))
        ?.id.toString() ?? null,
  };
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
    applications.deleted({ objectType: "DUE_DILIGENCE" }),
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
  await applications.restore({ id: String(recordId) });
  return { restored: true };
}

const existingSetup = z.object({
  setup_flow_id: z.coerce.number().int().positive(),
  application_number: z.string(),
  setup_description: z.string().nullish(),
  org_unit_id: z.coerce.number().int().positive(),
  ethics_type: z.string().nullish(),
  ethics_type_lkp_code: z.string().nullish(),
  ethics_form_type: z.string().nullish(),
  deadline_date: z.string().nullish(),
  expiry_date: z.string().nullish(),
  obj_ref_id: z.coerce.number().int().positive().nullish(),
  obj_ref_type: z.string().nullish(),
  sections: z
    .array(
      z.object({
        section_id: z.coerce.number().int().positive(),
        setup_id: z.coerce.number().int().positive().nullish(),
      }),
    )
    .default([]),
  stakeholders: z
    .array(
      z.object({
        id: z.coerce.number().int().positive(),
        p_id: z.coerce.number().int().positive(),
        org_unit_id: z.coerce.number().int().nonnegative().nullish(),
        org_unit_name: z.string().nullish(),
      }),
    )
    .default([]),
  reviewer: z
    .array(
      z.object({
        id: z.coerce.number().int().positive(),
        org_unit_id: z.coerce.number().int().nonnegative().nullish(),
      }),
    )
    .nullish(),
  reference_objects: z
    .array(
      z.object({
        obj_ref_id: z.coerce.number().int().positive(),
        obj_ref_type: z.string().regex(/^[A-Z_]{1,40}$/),
        reln_id: z.coerce.number().int().positive().nullish(),
      }),
    )
    .default([]),
});
const editInput = input
  .extend({
    id: z.string().regex(/^[1-9]\d{0,14}$/),
    access: z.enum(["DDA_ACCESS", "RESPONDENT_ACCESS"]),
  })
  .strict();
const choiceValue = (
  choices: { value: string; label: string }[],
  raw: string,
) =>
  choices.find((choice) => choice.value === raw || choice.label === raw)
    ?.value ?? "";
const dateOnly = (value: string | null | undefined) =>
  value?.slice(0, 10) ?? "";

/** Current setup values and validated choices for the record's Edit / Edit Setup flow. */
export async function dueDiligenceEditSetup(id: string, access?: string) {
  const [auth, setup] = await Promise.all([
    requireSetup(id, access),
    dueDiligenceCreateSetup(id, access),
  ]);
  const record = auth.record!;
  const raw = existingSetup.parse(await applications.setup({ id }));
  if (String(raw.setup_flow_id) !== id)
    throw new AppError(
      "CONTRACT",
      "Oracle returned another Due Diligence setup.",
    );
  const [peopleRows, supervisors] = await Promise.all([
    people.inOrg({ orgId: String(raw.org_unit_id) }),
    applications.approvers(),
  ]);
  const availablePeople = personRows.parse(peopleRows).items;
  const availableSupervisors = selectableSupervisors(supervisors);
  const participantIds = new Set(raw.stakeholders.map((row) => row.p_id));
  const supervisor = availableSupervisors.find(
    (row) => row.person_id === raw.reviewer?.[0]?.id,
  );
  return {
    setup,
    access: record.access,
    initial: {
      title: raw.setup_description ?? "",
      org: String(raw.org_unit_id),
      formType: choiceValue(
        setup.formTypes,
        raw.ethics_form_type ?? record.formType,
      ),
      dueDiligenceType: choiceValue(
        setup.types,
        raw.ethics_type_lkp_code ?? raw.ethics_type ?? record.dueDiligenceType,
      ),
      deadline: dateOnly(raw.deadline_date),
      expiry: dateOnly(raw.expiry_date),
      participants: availablePeople
        .filter((row) => participantIds.has(row.person_id))
        .map(keyOf),
      supervisor: supervisor ? keyOf(supervisor) : "",
    },
  };
}

/** Save an existing Setup with its current section ids, stakeholder ids and full reference set retained. */
export async function updateDueDiligence(raw: unknown) {
  const parsed = editInput.safeParse(raw);
  if (!parsed.success)
    throw new AppError("BAD_REQUEST", "Invalid Due Diligence setup.", 400);
  const value = parsed.data;
  const { record } = await requireSetup(value.id, value.access);
  const setup = await dueDiligenceCreateSetup(value.id, value.access);
  if (
    !setup.orgs.some((row) => row.value === value.org) ||
    !setup.types.some((row) => row.value === value.dueDiligenceType) ||
    !setup.formTypes.some((row) => row.value === value.formType)
  )
    throw new AppError(
      "BAD_REQUEST",
      "Invalid Due Diligence setup choice.",
      400,
    );
  if (
    value.action === "submit" &&
    (!value.participants.length || !value.supervisor)
  )
    throw new AppError(
      "BAD_REQUEST",
      "Submit needs a participant and supervisor.",
      400,
    );
  const previous = existingSetup.parse(
    await applications.setup({ id: value.id }),
  );
  if (String(previous.setup_flow_id) !== value.id)
    throw new AppError(
      "CONTRACT",
      "Oracle returned another Due Diligence setup.",
    );
  const form = await dueDiligenceCreateForm(
    value.formType,
    value.id,
    value.access,
  );
  const [peopleData, supervisorData] = await Promise.all([
    people.inOrg({ orgId: value.org }),
    applications.approvers(),
  ]);
  const chosenPeople = new Map(
    personRows.parse(peopleData).items.map((row) => [keyOf(row), row]),
  );
  const chosenSupervisors = new Map(
    selectableSupervisors(supervisorData).map((row) => [keyOf(row), row]),
  );
  if (
    value.participants.some((key) => !chosenPeople.has(key)) ||
    (value.supervisor && !chosenSupervisors.has(value.supervisor))
  )
    throw new AppError(
      "BAD_REQUEST",
      "Selected participant or supervisor is unavailable.",
      400,
    );
  const existingByPerson = new Map(
    previous.stakeholders.map((row) => [row.p_id, row]),
  );
  const sections = form.sections
    .filter((section) => section.enabled)
    .map((section) => ({
      section_id: Number(section.id),
      setup_id:
        previous.sections.find((row) => row.section_id === Number(section.id))
          ?.setup_id ?? null,
      enabled_by: "DUE_DILIGENCE_ADMIN",
    }));
  if (!sections.length)
    throw new AppError(
      "BAD_REQUEST",
      "No Due Diligence form section is enabled.",
      400,
    );
  const reviewer = value.supervisor
    ? chosenSupervisors.get(value.supervisor)!
    : null;
  const savedSetup = saved.parse(
    await applications.save({
      body: {
        setup_description: value.title,
        application_number: previous.application_number,
        action_type: value.action === "submit" ? "SUBMIT" : "SAVE",
        approver: null,
        enabled_by: "DUE_DILIGENCE_ADMIN",
        form_id: form.formId,
        obj_ref_id: previous.obj_ref_id ?? null,
        obj_ref_type: previous.obj_ref_type ?? null,
        org_unit_id: Number(value.org),
        expiry_date: value.expiry || null,
        deadline_date: value.deadline || null,
        ethics_type: value.dueDiligenceType,
        reviewer: reviewer
          ? [
              {
                id: reviewer.person_id,
                type: "INDIVIDUAL",
                org_unit_id: reviewer.org_unit_id,
              },
            ]
          : null,
        sections,
        object_type: "DUE_DILIGENCE",
        setup_flow_id: Number(value.id),
        stakeholders: value.participants.map((key) => {
          const person = chosenPeople.get(key)!;
          const old = existingByPerson.get(person.person_id);
          return {
            ...(old ? { id: old.id } : {}),
            form_id: form.formId,
            obj_ref_id: previous.obj_ref_id ?? null,
            obj_ref_type: previous.obj_ref_type ?? null,
            p_id: person.person_id,
            org_unit_id: person.org_unit_id,
            org_unit_name: person.org_unit_name,
          };
        }),
        reference_objects: previous.reference_objects.map((ref) => ({
          obj_ref_id: ref.obj_ref_id,
          obj_ref_type: ref.obj_ref_type,
          reln_id: ref.reln_id ?? null,
        })),
        ethics_form_type: value.formType,
      },
    }),
  );
  if (String(savedSetup.setup_flow_id) !== value.id || !record)
    throw new AppError(
      "CONTRACT",
      "Oracle returned another Due Diligence setup.",
    );
  return { id: value.id };
}

const parentInput = z
  .object({
    type: z.enum(["PROPOSAL", "AWARD"]),
    id: z.string().regex(/^[1-9]\d{0,14}$/),
    proposalType: recordIdentity.shape.type.optional(),
  })
  .strict();
type Parent = z.infer<typeof parentInput>;
async function requireParent(parent: Parent, action: "create" | "link") {
  if (parent.type === "PROPOSAL") {
    if (!parent.proposalType)
      throw new AppError("BAD_REQUEST", "Proposal type is required.", 400);
    const context = await proposalPage(
      parent.proposalType,
      parent.id,
      "proposals-due-diligence",
    );
    const key = context.access.get("proposals-link-due-diligence");
    if (action === "link" ? key?.edit !== true : context.rights.edit !== true)
      throw new AppError(
        "FORBIDDEN",
        "Proposal Due Diligence access has not been granted.",
        403,
      );
  } else {
    if (parent.proposalType)
      throw new AppError("BAD_REQUEST", "Invalid Award reference.", 400);
    const context = await awardRecordRead(parent.id, "due-diligence");
    const key = context.access.roles.get("awards-link-due-diligence");
    if (
      action === "link"
        ? key?.edit !== true
        : context.access.roles.get("awards-due-diligence")?.edit !== true
    )
      throw new AppError(
        "FORBIDDEN",
        "Award Due Diligence access has not been granted.",
        403,
      );
  }
}
/** The New page's parent (a Proposal's or Award's Create), checked against the parent's create grant. */
export async function dueDiligenceCreateParent(query: {
  parentType?: string;
  parentId?: string;
  proposalType?: string;
}): Promise<Parent | undefined> {
  if (!query.parentType && !query.parentId && !query.proposalType)
    return undefined;
  const parent = parentInput.safeParse({
    type: query.parentType,
    id: query.parentId,
    proposalType:
      query.parentType === "PROPOSAL"
        ? (query.proposalType ?? "PROPOSAL")
        : query.proposalType,
  });
  if (!parent.success)
    throw new AppError("BAD_REQUEST", "Invalid Due Diligence parent.", 400);
  await requireParent(parent.data, "create");
  return parent.data;
}
const linkedInput = z
  .object({
    parent: parentInput,
    id: z.string().regex(/^[1-9]\d{0,14}$/),
  })
  .strict();
/** Available DD records for a parent Link dialog; each page is the user's normal access-scoped listing. */
export async function dueDiligenceLinkCandidates(raw: URLSearchParams) {
  const parent = parentInput.safeParse({
    type: raw.get("type"),
    id: raw.get("id"),
    proposalType: raw.get("proposalType") ?? undefined,
  });
  if (!parent.success)
    throw new AppError("BAD_REQUEST", "Invalid linked record request.", 400);
  await requireParent(parent.data, "link");
  const view = await dueDiligenceListView();
  const page = Number(raw.get("offset") ?? "0");
  if (!Number.isInteger(page) || page < 0 || page > 100000)
    throw new AppError("BAD_REQUEST", "Invalid page.", 400);
  const rows = await listDueDiligence({
    ...defaultDueDiligenceFilters,
    access: view.tabs[0]?.value,
    number: (raw.get("number") ?? "").slice(0, 200),
    title: (raw.get("title") ?? "").slice(0, 200),
    offset: page,
  });
  return rows;
}
/** LINK replaces the reference set; re-read and preserve every existing relation id before writing. */
export async function linkDueDiligence(raw: unknown) {
  const parsed = linkedInput.safeParse(raw);
  if (!parsed.success)
    throw new AppError("BAD_REQUEST", "Invalid Due Diligence link.", 400);
  const { parent, id } = parsed.data;
  await requireParent(parent, "link");
  await dueDiligenceRecord(id);
  const setup = existingSetup.parse(await applications.setup({ id }));
  if (String(setup.setup_flow_id) !== id)
    throw new AppError(
      "CONTRACT",
      "Oracle returned another Due Diligence setup.",
    );
  if (
    setup.reference_objects.some(
      (row) =>
        String(row.obj_ref_id) === parent.id &&
        row.obj_ref_type === parent.type,
    )
  )
    return { linked: false, alreadyLinked: true };
  const refs = setup.reference_objects.map((row) => ({
    obj_ref_id: row.obj_ref_id,
    obj_ref_type: row.obj_ref_type,
    reln_id: row.reln_id ?? null,
  }));
  refs.push({
    obj_ref_id: Number(parent.id),
    obj_ref_type: parent.type,
    reln_id: null,
  });
  const result = saved.parse(
    await applications.save({
      body: {
        action_type: "LINK",
        setup_flow_id: Number(id),
        reference_objects: refs,
      },
    }),
  );
  if (String(result.setup_flow_id) !== id)
    throw new AppError(
      "CONTRACT",
      "Oracle linked another Due Diligence setup.",
    );
  return { linked: true, alreadyLinked: false };
}
