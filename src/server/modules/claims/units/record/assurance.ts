import "server-only";
import { z } from "zod";
import { claims } from "@/server/oracle/api";
import { resources } from "@/server/platform/configuration/resources";
import { AppError } from "@/lib/errors";
import { serverFunctions } from "@/server/functions";
import { BUNDLE, label, numberish, optionalText } from "../listing";
import { unitRecordRead, type UnitRecordContext } from "../record";
import { appSummaryOf } from "./shell";
import { summaryEditable } from "./sign-off";
import { statusConfig, type StatusConfig } from "./status";

/** Legacy requirementType: the columns a requirement has, and so what its save sends back. */
const requirementRow = z.object({
  app_requirement_id: numberish,
  app_id: numberish,
  app_fund_id: numberish,
  form_id: numberish,
  fund_type_id: numberish,
  person_responsible_email: optionalText,
  person_responsible_name: optionalText,
  program_type_code: optionalText,
  reference_module: optionalText,
  req_type_code: optionalText,
  status_code: optionalText,
  created_by: numberish,
  creation_date: optionalText,
});
/** The application's ASSURANCE requirement (legacy loadRequirement), if it has one. */
export async function assuranceRequirement(context: UnitRecordContext) {
  const rows =
    z.object({ items: z.array(requirementRow).nullish() }).parse(
      await claims.requirements({
        appId: Number(context.id),
        orgId: context.user.organizationId,
        type: "ASSURANCE",
      }),
    ).items ?? [];
  return rows[0] ?? null;
}

/** The Assurance sign-off tab: the requirement the form's answers belong to, and whether the summary is editable. */
export async function assuranceView(id: string) {
  const context = await unitRecordRead(id, "summary");
  const [rows, requirement, config] = await Promise.all([
    resources(),
    assuranceRequirement(context),
    statusConfig().catch((): StatusConfig => ({})),
  ]);
  return {
    requirementId:
      requirement?.app_requirement_id === null ||
      requirement?.app_requirement_id === undefined
        ? null
        : String(requirement.app_requirement_id),
    editable: await summaryEditable(context, config),
    audit: serverFunctions.resources.resourceVisible(
      rows,
      BUNDLE,
      "button-labels",
      "audit-trail",
    )
      ? label(rows, "button-labels", "audit-trail", "Audit Trail")
      : null,
    texts: {
      submit: label(
        rows,
        "button-labels",
        "submit-assurance",
        "Submit Assurance",
      ),
      // Legacy submitDynForm's literal toast.
      saved: "Response saved",
    },
  };
}

/**
 * WRITES: legacy saveRequirement, run before the form's answers are saved (they are stored against
 * `app_requirement_id`). A missing requirement is created as legacy's default (ASSURANCE on the application's
 * program type); an existing one is put back as read. Only on an editable summary.
 */
export async function saveAssurance(id: string) {
  const context = await unitRecordRead(id, "summary");
  const [requirement, config, summary] = await Promise.all([
    assuranceRequirement(context),
    statusConfig(),
    appSummaryOf(context),
  ]);
  if (!(await summaryEditable(context, config)))
    throw new AppError(
      "FORBIDDEN",
      "You do not have access to change this assurance.",
      403,
    );
  if (requirement && requirement.app_requirement_id) {
    await claims.updateRequirement({
      id: Number(requirement.app_requirement_id),
      body: requirement,
    });
    return { requirementId: String(requirement.app_requirement_id) };
  }
  await claims.createRequirement({
    appId: Number(id),
    body: {
      req_type_code: "ASSURANCE",
      app_fund_id: null,
      program_type_code:
        (summary as { program_type_code?: string | null }).program_type_code ??
        null,
    },
  });
  // The new id is read back, as legacy takes it from the reply's first item.
  const created = await assuranceRequirement(context);
  if (!created?.app_requirement_id)
    throw new AppError("CONTRACT", "The assurance was not created.");
  return { requirementId: String(created.app_requirement_id) };
}
