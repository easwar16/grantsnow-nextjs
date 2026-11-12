import "server-only";
import { z } from "zod";
import { AppError } from "@/lib/errors";
import { authenticate } from "@/server/identity/session/service";
import {
  applications,
  attributes,
  dynamicForm,
  locks as lockApi,
  lookups,
  people,
} from "@/server/oracle/api";
import {
  dashboardRoles,
  organizations,
} from "@/server/platform/configuration/service";
import { serverFunctions } from "@/server/functions";
import { resources } from "@/server/platform/configuration/resources";
import { ethicsListView } from "./listing";
import { canDeleteEthics } from "@/shared/ethics/listing";
import { ethicsRecord } from "./record";
import { globalVariables } from "@/server/platform/configuration/formatting";
import { ethicsEditableStatus } from "./record/status";
import type { AttributeValues } from "@/features/record/attributes/model";
import { recordIdentity } from "@/features/modules/proposals/record";
import { proposalPage } from "@/server/modules/proposals/record";

const actionTarget = z
  .object({
    id: z.string().regex(/^[1-9]\d{0,14}$/),
    access: z.enum(["EA_ACCESS", "RESPONDENT_ACCESS"]),
  })
  .strict();
const cloneInput = actionTarget
  .extend({
    objects: z.array(z.string().min(1)).max(100),
  })
  .strict();
const copyRows = z.object({
  items: z.array(
    z.object({
      r: z.string().min(1),
      d: z.string().nullish(),
      default_value: z.boolean().nullish(),
    }),
  ),
});
const deleteRow = z.object({
  items: z.array(
    z.object({
      setup_flow_id: z.coerce.number().int().positive(),
      ethics_type_code: z.string().nullish(),
      status_lkp_code: z.string().nullish(),
      response_status_lkp_code: z.string().nullish(),
    }),
  ),
});
async function requireAction(
  target: z.infer<typeof actionTarget>,
  action: "clone" | "delete",
) {
  const view = await ethicsListView();
  if (
    !view.actions[action] ||
    !view.tabs.some((tab) => tab.value === target.access)
  )
    throw new AppError(
      "FORBIDDEN",
      "Ethics action access has not been granted.",
      403,
    );
  await ethicsRecord(target.id, target.access);
  if (action === "delete") {
    const body = deleteRow.parse(
      await applications.list({
        objectType: "ETHICS",
        accessType: target.access,
        query: {
          p_where_clause: `("setup_flow_id"=${target.id})`,
          p_offset: "0",
          p_limit: "1",
        },
      }),
    );
    const row = body.items.find(
      (item) => String(item.setup_flow_id) === target.id,
    );
    if (
      !row ||
      !canDeleteEthics(
        target.access,
        row.ethics_type_code ?? "",
        row.status_lkp_code ?? "",
        row.response_status_lkp_code ?? "",
      )
    )
      throw new AppError(
        "FORBIDDEN",
        "This Ethics application cannot be deleted.",
        403,
      );
  }
}
export async function ethicsCloneOptions(id: string, access: string) {
  const target = actionTarget.parse({ id, access });
  await requireAction(target, "clone");
  return copyRows
    .parse(await applications.copyOptions({ objectType: "ETHICS" }))
    .items.map((row) => ({
      value: row.r,
      label: row.d || row.r,
      selected: row.default_value === true,
    }));
}
export async function cloneEthics(raw: unknown) {
  const target = cloneInput.parse(raw);
  await requireAction(target, "clone");
  const choices = copyRows.parse(
    await applications.copyOptions({ objectType: "ETHICS" }),
  ).items;
  const known = new Set(choices.map((row) => row.r));
  if (target.objects.some((name) => !known.has(name)))
    throw new AppError("BAD_REQUEST", "Invalid Ethics clone selection.", 400);
  await applications.copy({
    objectType: "ETHICS",
    id: target.id,
    access: target.access,
    objects: [...new Set(target.objects)].map((object_name) => ({
      object_name,
      object_val: true,
    })),
  });
  return { cloned: true };
}
export async function deleteEthics(raw: unknown) {
  const target = actionTarget.parse(raw);
  await requireAction(target, "delete");
  await applications.remove({ id: target.id });
  return { deleted: true };
}

const input = z
  .object({
    title: z.string().trim().min(1).max(400),
    action: z.enum(["draft", "submit"]).default("draft"),
    org: z.string().regex(/^[1-9]\d{0,14}$/),
    formType: z.string().regex(/^[A-Z0-9_]{1,40}$/),
    ethicsType: z.string().regex(/^[A-Z0-9_]{1,40}$/),
    deadline: z.union([z.iso.date(), z.literal("")]).nullish(),
    expiry: z.union([z.iso.date(), z.literal("")]).nullish(),
    participants: z
      .array(z.string().regex(/^[1-9]\d{0,14}:[0-9]\d{0,14}$/))
      .max(100)
      .default([]),
    supervisor: z
      .string()
      .regex(/^([1-9]\d{0,14}:[0-9]\d{0,14})?$/)
      .default(""),
    attributes: z
      .record(
        z.string().regex(/^attribute_(?:[1-9]|1\d|20)$/),
        z.union([z.string(), z.number(), z.array(z.string()), z.null()]),
      )
      .optional(),
    parent: z
      .object({
        type: z.literal("PROPOSAL"),
        id: z.string().regex(/^[1-9]\d{0,14}$/),
        proposalType: recordIdentity.shape.type,
      })
      .strict()
      .optional(),
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
const existingSetup = z
  .object({
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
          obj_ref_type: z.string(),
          reln_id: z.coerce.number().int().positive().nullish(),
        }),
      )
      .default([]),
  })
  .passthrough();
const personRows = z.object({
  items: z.array(
    z.object({
      person_id: z.coerce.number().int().positive(),
      org_unit_id: z.coerce.number().int().nonnegative(),
      full_name: z.string().nullish(),
      org_unit_name: z.string().nullish(),
    }),
  ),
});
const reviewerRows = z.object({
  items: z.array(
    z.object({
      person_id: z.coerce.number().int(),
      org_unit_id: z.coerce.number().int().nonnegative().optional(),
      full_name: z.string().nullish(),
      org_unit_name: z.string().nullish(),
    }),
  ),
});
function reviewerPeople(raw: unknown) {
  return reviewerRows
    .parse(raw)
    .items.flatMap((person) =>
      person.person_id > 0 && person.org_unit_id !== undefined
        ? [{ ...person, org_unit_id: person.org_unit_id }]
        : [],
    );
}
const personKey = (row: z.infer<typeof personRows>["items"][number]) =>
  `${row.person_id}:${row.org_unit_id}`;
const editInput = input
  .extend({
    id: z.string().regex(/^[1-9]\d{0,14}$/),
    access: z.enum(["EA_ACCESS", "RESPONDENT_ACCESS"]),
  })
  .strict();
const selectedChoice = (
  rows: { value: string; label: string }[],
  raw: string,
) => rows.find((row) => row.value === raw || row.label === raw)?.value ?? "";
const dateOnly = (raw?: string | null) => raw?.slice(0, 10) ?? "";
const attributeValues = (raw: Record<string, unknown>): AttributeValues =>
  Object.fromEntries(
    Object.entries(raw).filter(
      ([name, value]) =>
        /^attribute_(?:[1-9]|1\d|20)$/.test(name) &&
        (value === null ||
          typeof value === "string" ||
          typeof value === "number" ||
          (Array.isArray(value) &&
            value.every((item) => typeof item === "string"))),
    ),
  ) as AttributeValues;
async function checkedAttributes(
  objectId: string,
  values?: z.infer<typeof input>["attributes"],
) {
  if (!values || !Object.keys(values).length) return {};
  const rows = await resources();
  if (
    !serverFunctions.resources.resourceVisible(
      rows,
      "ethics",
      "labels",
      "show-attributes",
    )
  )
    throw new AppError("FORBIDDEN", "Ethics attributes are unavailable.", 403);
  const raw = z
    .object({
      fields: z.array(
        z.object({
          attributeName: z.string(),
          isVisible: z.string().nullish(),
          isReadonly: z.string().nullish(),
        }),
      ),
    })
    .parse(await attributes.fields({ objectType: "ETHICS", objectId }));
  const writable = new Set(
    raw.fields
      .filter((field) => field.isVisible !== "N" && field.isReadonly !== "Y")
      .map((field) => field.attributeName.toLowerCase()),
  );
  if (Object.keys(values).some((name) => !writable.has(name)))
    throw new AppError(
      "BAD_REQUEST",
      "Unknown or read-only Ethics attribute.",
      400,
    );
  return values;
}
async function requireEdit(id: string, access?: string) {
  const record = await ethicsRecord(id, access);
  if (!(await canEditEthicsSetup(record)))
    throw new AppError(
      "FORBIDDEN",
      "Ethics setup editing is unavailable.",
      403,
    );
  return record;
}
export async function canEditEthicsSetup(
  record: Awaited<ReturnType<typeof ethicsRecord>>,
) {
  const personId = String((await authenticate()).user.personId);
  const ownStakeholder = record.respondents.some(
    (row) => row.personId === personId,
  );
  if (
    record.rights["ethics-change-setup"]?.read !== true ||
    !ownStakeholder ||
    (record.access === "EA_ACCESS" &&
      record.rights["ethics-general-overview"]?.edit !== true) ||
    (record.access !== "EA_ACCESS" && record.access !== "RESPONDENT_ACCESS")
  )
    return false;
  if (record.statusCode === "DRFT") return true;
  if (
    record.rights["ethics-change-setup"]?.read !== true ||
    !record.respondents.length
  )
    return false;
  const statuses = await Promise.all(
    record.respondents.map((row) =>
      ethicsEditableStatus(row.statusCode).catch(() => false),
    ),
  );
  if (statuses.some((allowed) => !allowed)) return false;
  const participant = record.respondents[0];
  try {
    const [rawPages, rawLocked] = await Promise.all([
      lockApi.finalizablePages({
        objectType: "ETHICS",
        objectId: participant.id,
      }),
      lockApi.lockedModules({ recordId: participant.id, module: "ETHICS" }),
    ]);
    const pages = z
      .object({ items: z.array(z.object({ page_name: z.string() })) })
      .parse(rawPages).items;
    const locked = z
      .object({
        items: z.array(
          z.object({ page_id: z.coerce.number().int().positive() }),
        ),
      })
      .parse(rawLocked).items;
    if (!pages.length) return false;
    const lockedIds = new Set(locked.map((row) => row.page_id));
    return !pages.every((row) => {
      const pageId = record.pageIds[row.page_name.toLowerCase()];
      return pageId && lockedIds.has(pageId);
    });
  } catch {
    return false;
  }
}
export async function ethicsEditSetup(id: string, access?: string) {
  const record = await requireEdit(id, access);
  const [setup, raw] = await Promise.all([
    ethicsCreateSetup(id, access),
    applications.setup({ id }).then((value) => existingSetup.parse(value)),
  ]);
  if (String(raw.setup_flow_id) !== id)
    throw new AppError("CONTRACT", "Oracle returned another Ethics setup.");
  const [peopleData, supervisorData] = await Promise.all([
    people.inOrg({ orgId: String(raw.org_unit_id) }),
    applications.approvers(),
  ]);
  const peopleRows = personRows.parse(peopleData).items;
  const supervisor = reviewerPeople(supervisorData).find(
    (row) => row.person_id === raw.reviewer?.[0]?.id,
  );
  const chosenIds = new Set(raw.stakeholders.map((row) => row.p_id));
  return {
    setup,
    access: record.access,
    forceEdit: record.statusCode !== "DRFT",
    initial: {
      title: raw.setup_description ?? "",
      org: String(raw.org_unit_id),
      formType: selectedChoice(
        setup.formTypes,
        raw.ethics_form_type ?? record.formType,
      ),
      ethicsType: selectedChoice(
        setup.types,
        raw.ethics_type_lkp_code ?? raw.ethics_type ?? record.ethicsType,
      ),
      deadline: dateOnly(raw.deadline_date),
      expiry: dateOnly(raw.expiry_date),
      participants: [
        ...new Set(
          peopleRows
            .filter((row) => chosenIds.has(row.person_id))
            .map(personKey),
        ),
      ],
      supervisor: supervisor ? personKey(supervisor) : "",
      attributes: attributeValues(raw),
    },
  };
}
export async function updateEthics(raw: unknown) {
  const parsed = editInput.safeParse(raw);
  if (!parsed.success)
    throw new AppError("BAD_REQUEST", "Invalid Ethics setup.", 400);
  const value = parsed.data;
  const record = await requireEdit(value.id, value.access);
  if (record.statusCode !== "DRFT" && value.action !== "submit")
    throw new AppError(
      "FORBIDDEN",
      "Ethics setup must be saved through the change-setup action.",
      403,
    );
  const setup = await ethicsCreateSetup(value.id, value.access);
  if (
    !setup.orgs.some((row) => row.value === value.org) ||
    !setup.types.some((row) => row.value === value.ethicsType) ||
    !setup.formTypes.some((row) => row.value === value.formType)
  )
    throw new AppError("BAD_REQUEST", "Invalid Ethics setup choice.", 400);
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
    throw new AppError("CONTRACT", "Oracle returned another Ethics setup.");
  if (
    record.statusCode !== "DRFT" &&
    (value.org !== String(previous.org_unit_id) ||
      value.formType !==
        selectedChoice(
          setup.formTypes,
          previous.ethics_form_type ?? record.formType,
        ))
  )
    throw new AppError(
      "BAD_REQUEST",
      "Org Unit and form type cannot change during Edit Setup.",
      400,
    );
  const form = await ethicsCreateForm(value.formType, value.id, value.access);
  const [peopleData, supervisorData] = await Promise.all([
    people.inOrg({ orgId: value.org }),
    applications.approvers(),
  ]);
  const chosenPeople = new Map(
    personRows.parse(peopleData).items.map((row) => [personKey(row), row]),
  );
  const chosenSupervisors = new Map(
    reviewerPeople(supervisorData).map((row) => [personKey(row), row]),
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
  const byPersonId = new Map(
    previous.stakeholders.map((row) => [row.p_id, row]),
  );
  const sections = form.sections
    .filter((section) => section.enabled)
    .map((section) => ({
      section_id: Number(section.id),
      setup_id:
        previous.sections.find((row) => row.section_id === Number(section.id))
          ?.setup_id ?? null,
      enabled_by: "ETHICAL_ADMIN",
    }));
  if (!sections.length)
    throw new AppError(
      "BAD_REQUEST",
      "No Ethics form section is enabled.",
      400,
    );
  const reviewer = value.supervisor
    ? chosenSupervisors.get(value.supervisor)!
    : null;
  const response = saved.parse(
    await applications.save({
      body: {
        ...(await checkedAttributes(value.id, value.attributes)),
        setup_description: value.title,
        application_number: previous.application_number,
        action_type: value.action === "submit" ? "SUBMIT" : "SAVE",
        approver: null,
        enabled_by: "ETHICAL_ADMIN",
        form_id: form.formId,
        obj_ref_id: previous.obj_ref_id ?? null,
        obj_ref_type: previous.obj_ref_type ?? null,
        org_unit_id: Number(value.org),
        expiry_date: value.expiry || null,
        deadline_date: value.deadline || null,
        ethics_type: value.ethicsType,
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
        object_type: "ETHICS",
        setup_flow_id: Number(value.id),
        stakeholders: value.participants.map((key) => {
          const person = chosenPeople.get(key)!;
          const old = byPersonId.get(person.person_id);
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
        reference_objects: previous.reference_objects.map((row) => ({
          obj_ref_id: row.obj_ref_id,
          obj_ref_type: row.obj_ref_type,
          reln_id: row.reln_id ?? null,
        })),
        ethics_form_type: value.formType,
      },
    }),
  );
  if (String(response.setup_flow_id) !== value.id)
    throw new AppError("CONTRACT", "Oracle returned another Ethics setup.");
  return { id: value.id };
}

async function requireCreate() {
  const { user } = await authenticate();
  serverFunctions.permissions.requireModule(user, "ETHICS");
  if (
    !serverFunctions.permissions.pageAccess(
      await dashboardRoles(),
      "create-ethics-application",
    ).read
  )
    throw new AppError(
      "FORBIDDEN",
      "Creating Ethics applications is not enabled for this account.",
      403,
    );
}
export async function ethicsCreateAllowed() {
  try {
    await requireCreate();
    return true;
  } catch {
    return false;
  }
}
async function options(type: string) {
  return serverFunctions.choices
    .statusChoices(await lookups.codes({ types: type }), type)
    .filter((choice) => choice.value !== "");
}
export async function ethicsCreateSetup(id?: string, access?: string) {
  if (id) await requireEdit(id, access);
  else await requireCreate();
  const [orgs, types, formTypes, rows, globals] = await Promise.all([
    organizations(),
    options("ETHICS_TYPE"),
    options("ETHICS_FORM_TYPE"),
    resources(),
    globalVariables(),
  ]);
  const t = (group: string, key: string, fallback: string) =>
    serverFunctions.resources.label(rows, "ethics", group, key, fallback);
  return {
    currentPersonId: String((await authenticate()).user.personId),
    adminAnswer: globals.some(
      (row) => row.var_key === "ETHICS_ADMIN_ANSWER" && row.var_value === "Y",
    ),
    orgs: orgs.map((org) => ({ value: String(org.id), label: org.name })),
    types,
    formTypes,
    labels: {
      heading: t(
        "button-labels",
        "new-ethics-application",
        "New Ethics Application",
      ),
      save: t("button-labels", "save", "Save draft"),
      submit: t("button-labels", "submit", "Submit"),
      overview: t("page-name", "ethics-general-overview", "General Overview"),
      title: t("labels", "setup-project-title", "Project title"),
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
export async function ethicsCreatePeople(
  org: string,
  id?: string,
  access?: string,
) {
  if (id) await requireEdit(id, access);
  else await requireCreate();
  if (!/^[1-9]\d{0,14}$/.test(org))
    throw new AppError("BAD_REQUEST", "Invalid Org Unit.", 400);
  serverFunctions.permissions.scopeOrganization(org, await organizations());
  return personRows
    .parse(await people.inOrg({ orgId: org }))
    .items.map((person) => ({
      value: personKey(person),
      label: person.full_name ?? String(person.person_id),
      detail: person.org_unit_name ?? "",
    }));
}
export async function ethicsCreateSupervisors(id?: string, access?: string) {
  if (id) await requireEdit(id, access);
  else await requireCreate();
  return reviewerPeople(await applications.approvers()).map((person) => ({
    value: personKey(person),
    label: person.full_name ?? String(person.person_id),
  }));
}
export async function ethicsCreateForm(
  formType: string,
  id?: string,
  access?: string,
) {
  const setup = await ethicsCreateSetup(id, access);
  if (!setup.formTypes.some((option) => option.value === formType))
    throw new AppError("BAD_REQUEST", "Unknown Ethics form type.", 400);
  const forms = definition.safeParse(
    await dynamicForm.forms({
      objectId: "",
      objectType: "ETHICS",
      slot: "ETHICS",
      tag: { type: "ETHICS_TYPE", value: formType },
    }),
  );
  if (!forms.success || !forms.data.length || !forms.data[0].sections.length)
    throw new AppError("CONTRACT", "Ethics form metadata is unavailable.");
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
export async function createEthics(raw: unknown) {
  const value = input.safeParse(raw);
  if (!value.success)
    throw new AppError("BAD_REQUEST", "Invalid Ethics application.", 400);
  await requireCreate();
  const parent = value.data.parent;
  if (parent) {
    const context = await proposalPage(
      parent.proposalType,
      parent.id,
      "proposals-ethics",
    );
    if (context.rights.edit !== true)
      throw new AppError(
        "FORBIDDEN",
        "Proposal Ethics creation is unavailable.",
        403,
      );
  }
  const setup = await ethicsCreateSetup();
  const {
    title,
    action,
    org,
    formType,
    ethicsType,
    deadline,
    expiry,
    participants,
    supervisor,
  } = value.data;
  serverFunctions.permissions.scopeOrganization(org, await organizations());
  if (
    !setup.types.some((option) => option.value === ethicsType) ||
    !setup.formTypes.some((option) => option.value === formType)
  )
    throw new AppError("BAD_REQUEST", "Unknown Ethics type.", 400);
  const form = await ethicsCreateForm(formType);
  if (action === "submit" && (!participants.length || !supervisor))
    throw new AppError(
      "BAD_REQUEST",
      "Submission requires a participant and supervisor.",
      400,
    );
  const [availablePeople, availableSupervisors] = await Promise.all([
    personRows.parse(await people.inOrg({ orgId: org })).items,
    reviewerPeople(await applications.approvers()),
  ]);
  const byPerson = new Map(
    availablePeople.map((person) => [personKey(person), person]),
  );
  const bySupervisor = new Map(
    availableSupervisors.map((person) => [personKey(person), person]),
  );
  if (
    participants.some((key) => !byPerson.has(key)) ||
    (supervisor && !bySupervisor.has(supervisor))
  )
    throw new AppError(
      "BAD_REQUEST",
      "Selected participant or supervisor is unavailable.",
      400,
    );
  const selectedSupervisor = supervisor ? bySupervisor.get(supervisor)! : null;
  const sections = form.sections
    .filter((section) => section.enabled)
    .map((section) => ({
      section_id: Number(section.id),
      enabled_by: parent ? "PROPOSAL" : "ETHICAL_ADMIN",
      setup_id: null,
    }));
  if (!sections.length)
    throw new AppError(
      "BAD_REQUEST",
      "The selected Ethics form has no enabled sections.",
      400,
    );
  const result = saved.safeParse(
    await applications.save({
      body: {
        ...(await checkedAttributes("", value.data.attributes)),
        setup_description: title,
        application_number: null,
        action_type: action === "submit" ? "SUBMIT" : "SAVE",
        approver: null,
        enabled_by: parent ? "PROPOSAL" : "ETHICAL_ADMIN",
        form_id: form.formId,
        obj_ref_id: parent ? Number(parent.id) : null,
        obj_ref_type: parent ? "PROPOSAL" : null,
        org_unit_id: Number(org),
        expiry_date: expiry || null,
        deadline_date: deadline || null,
        ethics_type: ethicsType,
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
        object_type: "ETHICS",
        setup_flow_id: null,
        stakeholders: participants.map((key) => {
          const person = byPerson.get(key)!;
          return {
            form_id: form.formId,
            obj_ref_id: parent ? Number(parent.id) : null,
            obj_ref_type: parent ? "PROPOSAL" : null,
            p_id: person.person_id,
            org_unit_id: person.org_unit_id,
            org_unit_name: person.org_unit_name,
          };
        }),
        reference_objects: parent
          ? [
              {
                obj_ref_id: Number(parent.id),
                obj_ref_type: "PROPOSAL",
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
      "Oracle returned an invalid Ethics application.",
    );
  const { user } = await authenticate();
  return {
    id: String(result.data.setup_flow_id),
    respondentId:
      result.data.stakeholders
        ?.find((row) => String(row.p_id) === String(user.personId))
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
      risk_code: z.string().nullish(),
      risk_desc: z.string().nullish(),
      created_by: z.string().nullish(),
      last_updated_by: z.string().nullish(),
      last_update_date: z.string().nullish(),
      deadline_date: z.string().nullish(),
      expiry_date: z.string().nullish(),
      ethics_type: z.string().nullish(),
      ethics_form_type: z.string().nullish(),
      org_unit_id: z.coerce.number().int().positive(),
      org_unit_name: z.string().nullish(),
      parent_proposal_id: z.coerce.number().nullish(),
    }),
  ),
});
async function access() {
  const view = await ethicsListView();
  if (!view.actions.recycle || !view.tabs.length)
    throw new AppError(
      "FORBIDDEN",
      "Ethics recycle access has not been granted.",
      403,
    );
  return view;
}
export async function deletedEthics() {
  const view = await access();
  const [body, orgs] = await Promise.all([
    applications.deleted({}),
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
      risk: row.risk_desc ?? "",
      riskCode: row.risk_code ?? "",
      createdBy: row.created_by ?? "",
      updatedBy: row.last_updated_by ?? "",
      updated: row.last_update_date ?? "",
      deadline: row.deadline_date ?? "",
      expiry: row.expiry_date ?? "",
      ethicsType: row.ethics_type ?? "",
      formType: row.ethics_form_type ?? "",
      org: row.org_unit_name ?? "",
      canRestore: view.actions.restore && !row.parent_proposal_id,
    }));
}
export async function restoreEthics(raw: unknown) {
  const { id } = z.object({ id: z.string() }).strict().parse(raw);
  const recordId = z.coerce.number().int().positive().parse(id);
  const found = (await deletedEthics()).find(
    (row) => row.id === String(recordId) && row.canRestore,
  );
  if (!found)
    throw new AppError(
      "FORBIDDEN",
      "Ethics application not found or access denied.",
      403,
    );
  await applications.restore({ id: String(recordId) });
  return { restored: true };
}
