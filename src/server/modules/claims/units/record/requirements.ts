import "server-only";
import { z } from "zod";
import { claims } from "@/server/oracle/api";
import { resources } from "@/server/platform/configuration/resources";
import { serverFunctions } from "@/server/functions";
import { AppError } from "@/lib/errors";
import type { UnitRequirementsView } from "@/features/modules/claims/units/listing/types";
import { BUNDLE, label } from "../listing";
import { unitRecordRead, type UnitRecordContext } from "../record";
import { summaryOf } from "./activities";
import { assuranceRequirement, requirementRow } from "./assurance";
import { summaryEditable } from "./sign-off";
import { appFundsOf, fundOf, items } from "./goals";
import { available, statusConfig, type StatusConfig } from "./status";

const text = (v: unknown) => (v === null || v === undefined ? "" : String(v));
/** Legacy: the person responsible and the survey are editable, and Submit shown, while the fund allows a user edit. */
const editableIn = (
  config: StatusConfig,
  fundStatus: string | null | undefined,
) => available(config, ["CLAIM_FUNDS", "CLAIM_FUNDS_AMENDMENT"], fundStatus);
/** The fund's saved requirements (legacy loadRequirements: getRequirements `app-fund-id`). */
const savedOf = async (context: UnitRecordContext, appFundId: number) =>
  items(
    requirementRow,
    await claims.requirements({
      appId: Number(context.id),
      orgId: context.user.organizationId,
      appFundId,
    }),
  );
async function fundContext(id: string, rawFund: unknown) {
  const context = await unitRecordRead(id, "activities");
  const fund = fundOf(await appFundsOf(context), rawFund);
  return { context, appFundId: Number(fund.app_fund_id) };
}

/**
 * The Fund Summary's requirements (legacy `activitySummary.requirements`, each a collapsible survey): the fund's
 * configured forms, with the saved row's person responsible and id (legacy getRequirementsLookup, keyed by form).
 */
export async function requirementsView(
  id: string,
  rawFund: unknown,
): Promise<UnitRequirementsView> {
  const { context, appFundId } = await fundContext(id, rawFund);
  const [rows, summary, saved, config] = await Promise.all([
    resources(),
    summaryOf(context, appFundId),
    savedOf(context, appFundId),
    statusConfig().catch((): StatusConfig => ({})),
  ]);
  const t = (group: string, key: string, fallback: string) =>
    label(rows, group, key, fallback);
  return {
    editable: editableIn(config, summary?.fund_status_code),
    items: (summary?.requirements ?? []).flatMap((r) => {
      const type = text(r.req_type_code),
        slot = text(r.reference_module);
      if (!slot || r.form_id === null || r.form_id === undefined) return [];
      const row = saved.find((s) => text(s.form_id) === text(r.form_id));
      return [
        {
          key: text(r.req_id),
          form: text(r.form_id),
          slot,
          heading: t("header-labels", type.toLowerCase(), type),
          requirementId: row?.app_requirement_id
            ? String(row.app_requirement_id)
            : null,
          name: text(row?.person_responsible_name),
          email: text(row?.person_responsible_email),
        },
      ];
    }),
    // Legacy's keys, misspelling included.
    labels: {
      name: t("labels", "person-reponsible-name", "Person Responsible Name"),
      email: t("labels", "person-reponsible-email", "Person Responsible Email"),
    },
    texts: {
      submit: t("button-labels", "submit", "Submit"),
      // Legacy submitSurvey's literal toast.
      saved: "Response saved",
      audit: serverFunctions.resources.resourceVisible(
        rows,
        BUNDLE,
        "button-labels",
        "audit-trail",
      )
        ? t("button-labels", "audit-trail", "Audit Trail")
        : null,
    },
  };
}

const saveInput = z
  .object({
    fund: z.string().regex(/^\d{1,15}$/),
    form: z.string().regex(/^\d{1,15}$/),
    name: z.string().trim().min(1).max(240),
    email: z.string().trim().min(1).max(240),
  })
  .strict();
/**
 * WRITES: legacy submitSurvey's first step, before the form's answers (saved against `app_requirement_id`): the
 * fund's configured requirement, put back as read with the person responsible, or created; returns its id.
 */
export async function saveRequirement(id: string, raw: unknown) {
  const parsed = saveInput.safeParse(raw);
  if (!parsed.success)
    throw new AppError(
      "BAD_REQUEST",
      "Please fill all the required fields!",
      400,
    );
  const input = parsed.data;
  const { context, appFundId } = await fundContext(id, input.fund);
  const [summary, saved, config] = await Promise.all([
    summaryOf(context, appFundId),
    savedOf(context, appFundId),
    statusConfig(),
  ]);
  if (!editableIn(config, summary?.fund_status_code))
    throw new AppError(
      "FORBIDDEN",
      "This fund's requirements cannot be changed in its current status.",
      403,
    );
  const configured = (summary?.requirements ?? []).find(
    (r) => text(r.form_id) === input.form,
  );
  if (!configured)
    throw new AppError(
      "FORBIDDEN",
      "This requirement is not configured for the fund.",
      403,
    );
  const row = saved.find((s) => text(s.form_id) === input.form);
  const person = {
    person_responsible_name: input.name,
    person_responsible_email: input.email,
    app_fund_id: appFundId,
  };
  if (row?.app_requirement_id) {
    await claims.updateRequirement({
      id: Number(row.app_requirement_id),
      body: { ...row, ...person },
    });
    return { requirementId: String(row.app_requirement_id) };
  }
  // Legacy's new row: the type and the person responsible, on the fund.
  await claims.createRequirement({
    appId: Number(context.id),
    body: { req_type_code: configured.req_type_code ?? null, ...person },
  });
  const created = (await savedOf(context, appFundId)).find(
    (s) => text(s.form_id) === input.form,
  );
  if (!created?.app_requirement_id)
    throw new AppError("CONTRACT", "The requirement was not created.");
  return { requirementId: String(created.app_requirement_id) };
}

/** A requirement of this application, for its audit trail (legacy loadAuditTrail `DYN`): its id and module. */
export async function requirementOf(
  context: UnitRecordContext,
  page: string,
  requirementId: string | undefined,
) {
  const row = items(
    requirementRow,
    await claims.requirements({
      appId: Number(context.id),
      orgId: context.user.organizationId,
    }),
  ).find(
    (r) =>
      text(r.app_requirement_id) === requirementId &&
      text(r.reference_module).toLowerCase() === page,
  );
  return row?.reference_module ? row : null;
}

/**
 * The unit record's dynamic forms (the shared form's CLAIMS host): the Summary's Assurance (SUMMARY-ASSURANCE) and the
 * Fund Summary's surveys (the requirement's reference module). Read: the record's page; a saved form must be this
 * application's requirement of that module. Edit: a saved requirement, and the summary (Assurance) or the
 * requirement's fund (a survey) open to a user edit. Returns the user and the form's record (its files' folder).
 */
export async function unitFormAccess(
  parentId: string,
  slot: string,
  objectId: string | undefined,
  mode: "read" | "edit",
) {
  const assurance = slot === "SUMMARY-ASSURANCE";
  const context = await unitRecordRead(
    parentId,
    assurance ? "summary" : "activities",
  );
  if (objectId === undefined) {
    if (mode === "edit")
      throw new AppError("BAD_REQUEST", "Save the application first.", 400);
    return { user: context.user, record: null };
  }
  const denied = (message: string) => new AppError("FORBIDDEN", message, 403);
  const config = mode === "edit" ? await statusConfig() : {};
  if (assurance) {
    const requirement = await assuranceRequirement(context);
    if (text(requirement?.app_requirement_id) !== objectId)
      throw denied("This assurance is not on the application.");
    if (mode === "edit" && !(await summaryEditable(context, config)))
      throw denied("This assurance can no longer be changed.");
  } else {
    const requirement = await requirementOf(
      context,
      slot.toLowerCase(),
      objectId,
    );
    if (!requirement)
      throw denied("This requirement is not on the application.");
    if (mode === "edit") {
      const summary = await summaryOf(context, Number(requirement.app_fund_id));
      if (!editableIn(config, summary?.fund_status_code))
        throw denied("This requirement can no longer be changed.");
    }
  }
  return { user: context.user, record: { id: objectId, number: parentId } };
}
