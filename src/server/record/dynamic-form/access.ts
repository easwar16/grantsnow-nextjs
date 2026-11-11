import "server-only";
import { z } from "zod";
import { authenticate } from "@/server/identity/session/service";
import {
  awards,
  eoi,
  locks,
  opportunities,
  roles as recordRoles,
} from "@/server/oracle/api";
import { dashboardRoles } from "@/server/platform/configuration/service";
import { canCreate } from "@/features/modules/opportunities/display";
import { AppError } from "@/lib/errors";
import { unitFormAccess } from "@/server/modules/claims/units/record/requirements";
import { loadContract } from "@/server/modules/contracts/service";
import { serverFunctions } from "@/server/functions";
import {
  proposalDynamicFormEditable,
  proposalPage,
} from "@/server/modules/proposals/record";
import { dueDiligenceRecord } from "@/server/modules/due-diligence/record";
import { dueDiligenceCreateForm } from "@/server/modules/due-diligence/actions";
import {
  ethicsRecord,
  ethicsStakeholder,
} from "@/server/modules/ethics/record";
import { ethicsCreateForm } from "@/server/modules/ethics/actions";
import { ethicsEditableStatus } from "@/server/modules/ethics/record/status";
import { proposalEditContext } from "@/server/modules/proposals/edit";
import { proposalCreateAccess } from "@/server/modules/proposals/create";
import { recordIdentity } from "@/features/modules/proposals/record";
/**
 * Who may read or change a dynamic form (and its files), decided on the server and failing closed.
 */
const recordId = z.string().regex(/^[1-9]\d{0,14}$/);
export const formTarget = z
  .object({
    objectType: z.string().regex(/^[A-Z_-]{1,40}$/),
    slot: z.string().regex(/^[A-Z0-9_-]{1,80}$/),
    parentId: recordId.optional(),
    objectId: recordId.optional(),
    formType: z
      .string()
      .regex(/^[A-Z0-9_]{1,40}$/)
      .optional(),
    version: z.coerce.number().int().positive().optional(),
  })
  .strict();
export type FormTarget = z.infer<typeof formTarget>;
/** Query params (empty means absent) → a target; anything malformed is a 400. */
export function targetFromQuery(q: URLSearchParams): FormTarget {
  const value = (k: string) => {
    const v = q.get(k);
    return v === null || v === "" ? undefined : v;
  };
  const parsed = formTarget.safeParse({
    objectType: value("objectType"),
    slot: value("slot"),
    parentId: value("parentId"),
    objectId: value("objectId"),
    formType: value("formType"),
    version: value("version"),
  });
  if (!parsed.success)
    throw new AppError("BAD_REQUEST", "Invalid form request.", 400);
  return parsed.data;
}
const denied = (message = "You do not have access to this page.") =>
  new AppError("FORBIDDEN", message, 403);
/** The record's role page for the slot (`opportunities-eoi-<tab>`, GN-Angular eoi.ts); null for an unsupported host. */
export function pageOf(t: Pick<FormTarget, "objectType" | "slot">) {
  if (
    recordIdentity.shape.type.safeParse(t.objectType).success &&
    /^PROPOSALS-(SUMMARY|DYNAMIC-FORM-[1-5])$/.test(t.slot)
  )
    return t.slot.toLowerCase();
  if (t.objectType === "CONTRACT" && t.slot === "CONTRACTS-SUMMARY")
    return "contracts-summary";
  if (
    t.objectType === "OPPORTUNITIES" &&
    t.slot === "OPPORTUNITIES-EOI-APPLICATION"
  )
    return "opportunities-eoi-application";
  if (
    t.objectType === "OPPORTUNITIES-EOI" &&
    /^OPPORTUNITIES-EOI-DYNAMIC-FORM-[1-5]$/.test(t.slot)
  )
    return t.slot.toLowerCase();
  // The award record: Dynamic Form 1–5, the Header's form (legacy moduleName AWARDS-HEADER) and the Add Milestone
  // dialog's form (AWARDS-MILESTONES).
  if (
    t.objectType === "AWARD" &&
    /^AWARDS-(HEADER|MILESTONES|DYNAMIC-FORM-[1-5])$/.test(t.slot)
  )
    return t.slot.toLowerCase();
  if (t.objectType === "DUE_DILIGENCE" && t.slot === "DUE_DILIGENCE")
    return "duediligence-responses";
  if (t.objectType === "ETHICS" && t.slot === "ETHICS")
    return "ethics-responses";
  // The Claims unit record: the Summary's Assurance (SUMMARY-ASSURANCE) and the Fund Summary's surveys (the
  // requirement's reference module), checked against the requirement by the Claims host.
  if (t.objectType === "CLAIMS" && /^[A-Z0-9_-]{1,60}$/.test(t.slot))
    return t.slot === "SUMMARY-ASSURANCE"
      ? "claims-unit-summary"
      : "claims-unit-activities";
  return null;
}
const rolesSchema = z.object({
  items: z.array(
    z.object({
      page_id: z
        .union([z.number(), z.string().regex(/^\d+$/)])
        .nullish()
        .transform((v) => (v === null || v === undefined ? null : Number(v))),
      page_name: z.string(),
      read_access: z
        .string()
        .nullish()
        .transform((v) => v ?? null),
      edit_access: z.string().nullish(),
    }),
  ),
});
const detailsSchema = z.object({
  items: z.array(
    z.object({
      request_id: z.coerce.number().int().positive(),
      request_number: z.string().min(1),
      request_type: z.string(),
      status_code: z.string().nullish(),
      ref_object_id: z.coerce.number().int().positive().nullish(),
    }),
  ),
});
const opportunitySchema = z.object({
  items: z.array(
    z.object({
      opportunities_id: z.coerce.number().int().positive(),
      opportunity_status: z.string().nullish(),
      create_application_of_interest: z.string().nullish(),
    }),
  ),
});
/** A new application's form: the Apply rules (apply-opportunities read, the opportunity's flag, an open status). */
async function requireApply(opportunityId: string | undefined) {
  if (opportunityId === undefined)
    throw new AppError("BAD_REQUEST", "Invalid form request.", 400);
  // Read together; the role check still decides first, and nothing is returned before both pass.
  const opportunity = serverFunctions.async.early(
    opportunities.byId(Number(opportunityId)),
  );
  if (
    !serverFunctions.permissions.pageAccess(
      await dashboardRoles(),
      "apply-opportunities",
    ).read
  )
    throw denied("This action is not enabled for your account.");
  const o = opportunitySchema
    .parse(await opportunity)
    .items.find((r) => String(r.opportunities_id) === opportunityId);
  if (
    !o ||
    o.create_application_of_interest !== "Y" ||
    !canCreate(o.opportunity_status ?? "")
  )
    throw denied("Applications are not open for this opportunity.");
}
export interface FormRecord {
  id: string;
  /** The record number (`AOI_513`), the storage folder; read here, never taken from the browser. */
  number: string;
}
/**
 * Read: the record's role rows grant the page. Edit: every row also grants edit and the application is a draft.
 * Without a record only a new application's form can be read, under the Apply rules.
 */
const lockSchema = z.object({ status: z.string().nullish() });
/** Whether the page is locked (finalized). A page without an id, or a lock that cannot be read, counts as locked. */
async function pageLocked(
  requestId: string,
  roles: z.infer<typeof rolesSchema>["items"],
  page: string,
  module = "OPPORTUNITIES-EOI",
) {
  const pageRow = roles.find((r) => r.page_name === page && r.page_id !== null);
  if (!pageRow) return true;
  try {
    const b = lockSchema.parse(
      await locks.lockStatus({
        recordId: requestId,
        pageId: pageRow.page_id!,
        module,
      }),
    );
    return b.status !== "UNLOCK";
  } catch {
    return true;
  }
}
export async function authorizeForm(t: FormTarget, mode: "read" | "edit") {
  if (
    t.version !== undefined &&
    t.objectType !== "ETHICS" &&
    t.objectType !== "DUE_DILIGENCE"
  )
    throw new AppError(
      "BAD_REQUEST",
      "Versions are unavailable for this form.",
      400,
    );
  if (t.version !== undefined && mode === "edit")
    throw denied("Historical responses are read-only.");
  const { user } = await authenticate();
  const page = pageOf(t);
  if (page === null)
    throw denied("Forms are not available for this record type.");
  const proposalType = recordIdentity.shape.type.safeParse(t.objectType);
  if (proposalType.success) {
    if (t.objectId === undefined) {
      if (
        mode === "edit" ||
        page !== "proposals-summary" ||
        t.parentId ||
        (t.objectType !== "PROPOSAL" && t.objectType !== "OUTLINE_PROPOSAL")
      )
        throw new AppError(
          "BAD_REQUEST",
          "Invalid Proposal form request.",
          400,
        );
      const user = await proposalCreateAccess(t.objectType);
      return { user, page, record: null };
    }
    if (t.parentId && t.parentId !== t.objectId)
      throw new AppError("BAD_REQUEST", "Invalid Proposal form request.", 400);
    const context =
      mode === "edit" && page === "proposals-summary"
        ? await proposalEditContext(proposalType.data, t.objectId)
        : await proposalPage(proposalType.data, t.objectId, page);
    if (
      !context ||
      (mode === "edit" &&
        page !== "proposals-summary" &&
        !proposalDynamicFormEditable(context, page))
    )
      throw denied("Proposal form editing is unavailable.");
    return {
      user: context.user,
      page,
      record: { id: context.summary.id, number: context.summary.reference },
    };
  }
  if (t.objectType === "CONTRACT") {
    serverFunctions.permissions.requireModule(user, "CONTRACTS");
    if (t.objectId === undefined || (t.parentId && t.parentId !== t.objectId))
      throw new AppError("BAD_REQUEST", "Invalid Contract form request.", 400);
    if (mode === "edit") throw denied("Contract form editing is unavailable.");
    const contract = await loadContract(t.objectId);
    return { user, page, record: { id: contract.id, number: contract.number } };
  }
  if (t.objectType === "DUE_DILIGENCE") {
    if (!t.objectId) {
      if (mode === "edit" || t.parentId || !t.formType)
        throw new AppError(
          "BAD_REQUEST",
          "Invalid Due Diligence form target.",
          400,
        );
      await dueDiligenceCreateForm(t.formType);
      return { user, page, record: null, formType: t.formType };
    }
    return authorizeDueDiligenceForm(t, mode, user);
  }
  if (t.objectType === "ETHICS") return authorizeEthicsForm(t, mode, user);
  if (t.objectType === "AWARD") return authorizeAwardForm(t, mode, user, page);
  if (t.objectType === "CLAIMS") {
    if (t.parentId === undefined)
      throw new AppError("BAD_REQUEST", "Invalid form request.", 400);
    return {
      page,
      ...(await unitFormAccess(t.parentId, t.slot, t.objectId, mode)),
    };
  }
  serverFunctions.permissions.requireModule(user, "opportunities-group");
  if (t.objectId === undefined) {
    if (mode === "edit" || t.objectType !== "OPPORTUNITIES")
      throw new AppError("BAD_REQUEST", "Save the application first.", 400);
    await requireApply(t.parentId);
    return { user, page, record: null };
  }
  // Read together; the role check still decides first, and nothing is returned before every check passes.
  const requestDetails = serverFunctions.async.early(
    eoi.details({ requestId: t.objectId }),
  );
  const roles = rolesSchema.parse(
    // The same held answer the EOI record reads (one roles read per record, as VBCS).
    await recordRoles.record({
      objectType: "OPPORTUNITIES-EOI",
      objectId: t.objectId,
    }),
  ).items;
  const access = serverFunctions.permissions.pageAccess(roles, page);
  if (!access.read || (mode === "edit" && !access.edit)) throw denied();
  // A finalized page is read-only on the server too, not only on screen (VBCS getLockStatus, lock_level = page id).
  const lock =
    mode === "edit"
      ? serverFunctions.async.early(pageLocked(t.objectId, roles, page))
      : null;
  const details = detailsSchema.parse(await requestDetails).items;
  const r = details[0];
  if (
    details.length !== 1 ||
    String(r.request_id) !== t.objectId ||
    r.request_type !== "OPPORTUNITIES-EOI"
  )
    throw new AppError("CONTRACT", "Oracle returned a different application.");
  // The Application tab's opportunity must be the one the record was made from.
  if (
    t.objectType === "OPPORTUNITIES" &&
    t.parentId !== undefined &&
    String(r.ref_object_id ?? "") !== t.parentId
  )
    throw new AppError(
      "BAD_REQUEST",
      "The application does not belong to this opportunity.",
      400,
    );
  if (mode === "edit" && r.status_code !== "DRFT")
    throw denied("Only a draft application can be changed.");
  if (lock && (await lock))
    throw denied("This page is finalized; unlock it to make changes.");
  const record: FormRecord = { id: t.objectId, number: r.request_number };
  return { user, page, record };
}

const awardSchema = z.object({
  award_id: z.coerce.number().int().positive(),
  award_number: z.string().nullish(),
  award_status: z.string().nullish(),
});
/**
 * An award's form: the Awards grant, the award's roles on the page (edit for a change), a draft award and an open
 * page lock. Legacy checked only the tab's read; the edit rules are the record's own (Header and Dynamic Form tabs).
 */
async function authorizeAwardForm(
  t: FormTarget,
  mode: "read" | "edit",
  user: Awaited<ReturnType<typeof authenticate>>["user"],
  page: string,
) {
  serverFunctions.permissions.requireDrawerAccess(user, "awards");
  if (t.objectId === undefined)
    throw new AppError("BAD_REQUEST", "Invalid form request.", 400);
  const details = serverFunctions.async.early(
    awards.details({ awardId: t.objectId }),
  );
  const roles = rolesSchema.parse(
    await recordRoles.record({ objectType: "AWARD", objectId: t.objectId }),
  ).items;
  const access = serverFunctions.permissions.pageAccess(roles, page);
  if (!access.read || (mode === "edit" && !access.edit)) throw denied();
  const lock =
    mode === "edit"
      ? serverFunctions.async.early(
          pageLocked(t.objectId, roles, page, "AWARD"),
        )
      : null;
  const a = awardSchema.parse(await details);
  if (String(a.award_id) !== t.objectId)
    throw new AppError("CONTRACT", "Oracle returned a different award.");
  if (mode === "edit" && a.award_status !== "DRFT")
    throw denied("Only a draft award can be changed.");
  if (lock && (await lock))
    throw denied("This page is finalized; unlock it to make changes.");
  // Legacy files award form documents under the award number.
  const record: FormRecord = {
    id: t.objectId,
    number: a.award_number ?? t.objectId,
  };
  return { user, page, record };
}

/** Respondent answers are scoped by the setup and the exact stakeholder row, never by a browser person id. */
async function authorizeDueDiligenceForm(
  t: FormTarget,
  mode: "read" | "edit",
  user: Awaited<ReturnType<typeof authenticate>>["user"],
) {
  if (!t.parentId || !t.objectId)
    throw new AppError(
      "BAD_REQUEST",
      "Invalid Due Diligence form target.",
      400,
    );
  const application = await dueDiligenceRecord(
    t.parentId,
    mode === "edit" ? "RESPONDENT_ACCESS" : undefined,
  );
  const page = "duediligence-responses";
  if (!application.tabs.includes(page)) throw denied();
  const respondent = application.respondents.find(
    (row) => row.id === t.objectId,
  );
  if (!respondent || !respondent.personId) throw denied();
  if (
    application.access === "RESPONDENT_ACCESS" &&
    respondent.personId !== String(user.personId)
  )
    throw denied();
  if (mode === "edit") {
    if (
      !application.rights[page]?.edit ||
      application.access !== "RESPONDENT_ACCESS" ||
      respondent.personId !== String(user.personId) ||
      respondent.statusCode !== "DRFT"
    )
      throw denied("This response can no longer be changed.");
    const roles = rolesSchema.parse(
      await recordRoles.record({
        objectType: "DUE_DILIGENCE",
        objectId: t.parentId,
      }),
    ).items;
    if (await pageLocked(respondent.id, roles, page, "DUE_DILIGENCE"))
      throw denied("This page is finalized; unlock it to make changes.");
  }
  return {
    user,
    page,
    record: { id: respondent.id, number: respondent.id },
    formType: application.formType,
    setupId: application.id,
    personId: respondent.personId,
  };
}

/** The setup and selected stakeholder are re-read for every Ethics form and file request. */
async function authorizeEthicsForm(
  t: FormTarget,
  mode: "read" | "edit",
  user: Awaited<ReturnType<typeof authenticate>>["user"],
) {
  if (!t.parentId && !t.objectId && mode === "read" && t.formType) {
    await ethicsCreateForm(t.formType);
    return {
      user,
      page: "ethics-responses",
      record: null,
      formType: t.formType,
      setupId: null,
      personId: String(user.personId),
    };
  }
  if (!t.parentId || !t.objectId)
    throw new AppError("BAD_REQUEST", "Invalid Ethics form target.", 400);
  const application = await ethicsRecord(
    t.parentId,
    mode === "edit" ? "RESPONDENT_ACCESS" : undefined,
  );
  const page = "ethics-responses";
  if (!application.tabs.includes(page)) throw denied();
  const respondent = ethicsStakeholder(application, user.personId, t.objectId);
  if (!respondent?.personId) throw denied();
  if (mode === "edit") {
    if (
      !application.rights[page]?.edit ||
      application.access !== "RESPONDENT_ACCESS" ||
      respondent.personId !== String(user.personId) ||
      !(await ethicsEditableStatus(respondent.statusCode).catch(() => false))
    )
      throw denied("This response can no longer be changed.");
    const roles = rolesSchema.parse(
      await recordRoles.record({
        objectType: "ETHICS",
        objectId: t.parentId,
      }),
    ).items;
    if (await pageLocked(respondent.id, roles, page, "ETHICS"))
      throw denied("This page is finalized; unlock it to make changes.");
  }
  return {
    user,
    page,
    record: { id: respondent.id, number: respondent.id },
    formType: application.formType,
    setupId: application.id,
    personId: respondent.personId,
  };
}
