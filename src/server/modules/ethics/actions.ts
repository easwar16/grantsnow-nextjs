import "server-only";
import { z } from "zod";
import { AppError } from "@/lib/errors";
import { authenticate } from "@/server/identity/session/service";
import { ethics, lookups } from "@/server/oracle/api";
import {
  dashboardRoles,
  organizations,
} from "@/server/platform/configuration/service";
import { serverFunctions } from "@/server/functions";
import { resources } from "@/server/platform/configuration/resources";
import { ethicsListView } from "./listing";

const input = z
  .object({
    title: z.string().trim().min(1).max(400),
    org: z.string().regex(/^[1-9]\d{0,14}$/),
    formType: z.string().regex(/^[A-Z0-9_]{1,40}$/),
    ethicsType: z.string().regex(/^[A-Z0-9_]{1,40}$/),
    deadline: z.union([z.iso.date(), z.literal("")]).nullish(),
    expiry: z.union([z.iso.date(), z.literal("")]).nullish(),
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
async function options(type: string) {
  return serverFunctions.choices
    .statusChoices(await lookups.codes({ types: type }), type)
    .filter((choice) => choice.value !== "");
}
export async function ethicsCreateSetup() {
  await requireCreate();
  const [orgs, types, formTypes, rows] = await Promise.all([
    organizations(),
    options("ETHICS_TYPE"),
    options("ETHICS_FORM_TYPE"),
    resources(),
  ]);
  const t = (group: string, key: string, fallback: string) =>
    serverFunctions.resources.label(rows, "ethics", group, key, fallback);
  return {
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
      overview: t("page-name", "ethics-general-overview", "General Overview"),
      title: t("labels", "setup-project-title", "Project title"),
      org: t("labels", "org-unit", "Org Unit"),
      expiry: t("labels", "expiry-date", "Expiry Date"),
      deadline: t("labels", "deadline-date", "Deadline Date"),
      formType: t("labels", "form-type", "Form Type"),
      type: t("labels", "application-type", "Application type"),
      list: t("button-labels", "list", "List"),
      cancel: t("button-labels", "cancel", "Cancel"),
    },
  };
}
export async function ethicsCreateForm(formType: string) {
  await requireCreate();
  const setup = await ethicsCreateSetup();
  if (!setup.formTypes.some((option) => option.value === formType))
    throw new AppError("BAD_REQUEST", "Unknown Ethics form type.", 400);
  const forms = definition.safeParse(await ethics.form({ formType }));
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
  const setup = await ethicsCreateSetup();
  const { title, org, formType, ethicsType, deadline, expiry } = value.data;
  serverFunctions.permissions.scopeOrganization(org, await organizations());
  if (
    !setup.types.some((option) => option.value === ethicsType) ||
    !setup.formTypes.some((option) => option.value === formType)
  )
    throw new AppError("BAD_REQUEST", "Unknown Ethics type.", 400);
  const form = await ethicsCreateForm(formType);
  const sections = form.sections
    .filter((section) => section.enabled)
    .map((section) => ({
      section_id: Number(section.id),
      enabled_by: "ETHICAL_ADMIN",
      setup_id: null,
    }));
  if (!sections.length)
    throw new AppError(
      "BAD_REQUEST",
      "The selected Ethics form has no enabled sections.",
      400,
    );
  const result = saved.safeParse(
    await ethics.save({
      body: {
        setup_description: title,
        application_number: null,
        action_type: "SAVE",
        approver: null,
        enabled_by: "ETHICAL_ADMIN",
        form_id: form.formId,
        obj_ref_id: null,
        obj_ref_type: null,
        org_unit_id: Number(org),
        expiry_date: expiry || null,
        deadline_date: deadline || null,
        ethics_type: ethicsType,
        reviewer: null,
        sections,
        object_type: "ETHICS",
        setup_flow_id: null,
        stakeholders: [],
        reference_objects: [],
        ethics_form_type: formType,
      },
    }),
  );
  if (!result.success)
    throw new AppError(
      "CONTRACT",
      "Oracle returned an invalid Ethics application.",
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
  const view = await ethicsListView();
  if (!view.actions.recycle || !view.tabs.length)
    throw new AppError(
      "FORBIDDEN",
      "Ethics recycle access has not been granted.",
      403,
    );
}
export async function deletedEthics() {
  await access();
  const [body, orgs] = await Promise.all([ethics.deleted(), organizations()]);
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
  await ethics.restore({ id: String(recordId) });
  return { restored: true };
}
