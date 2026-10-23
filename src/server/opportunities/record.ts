import "server-only";
import { cache } from "react";
import { z, ZodError } from "zod";
import { authenticate } from "@/server/session/service";
import {
  finalizedOf,
  objectAccessOf,
  requireModule,
} from "@/server/permissions/policy";
import { oracle, oracleWrite } from "@/server/api/transport";
import { fixtureMode } from "@/server/configuration/environment";
import { dashboardRoles } from "@/server/configuration/service";
import { canCreate } from "@/features/opportunities/display";
import { AppError } from "@/lib/errors";
import { label, resources } from "@/server/configuration/resources";
import { displayFormat } from "@/server/configuration/formatting";
import { dateDisplay } from "@/lib/format";
import type { SummaryActionContext } from "@/features/opportunities/eoi/types";
import { afterCheck, opportunityGlobals, pageAccess } from "./gates";
import { referenceRead } from "./reference";
import {
  EDITABLE_STATUSES,
  ATTACHMENT_STATUSES,
  EOI_MODULE,
  eoiTabs,
  headerConverts,
  pageOf,
  visibleTabs,
  type EoiTab,
  type PageLock,
} from "./eoi-record/model";
import {
  allows,
  readOpportunityRecord,
  summaryRoles,
  summaryView,
} from "./eoi-record/opportunity";
import { cachedRead } from "@/server/cache/reads";
import { TTL } from "@/server/cache/memo";
import type { AttachmentHost } from "@/server/files/attachments";
export { eoiTabs, type EoiTab };
const recordId = z.string().regex(/^[1-9]\d{0,14}$/);
export const eoiRecordIdentity = z.object({
  id: recordId,
  tab: z.enum(eoiTabs),
});
const text = z.string().nullish();
const pageId = z
  .union([z.number(), z.string().regex(/^\d+$/)])
  .nullish()
  .transform((v) => (v === null || v === undefined ? null : Number(v)));
const roleSchema = z.object({
  items: z.array(
    z.object({
      page_id: pageId,
      page_name: z.string(),
      read_access: text.transform((v) => v ?? null),
      edit_access: text,
      delete_access: text,
    }),
  ),
});
const detailsSchema = z.object({
  items: z.array(
    z.object({
      request_id: z.number().int().positive(),
      request_number: z.string(),
      request_type: z.literal("OPPORTUNITIES-EOI"),
      status: text,
      status_code: text,
      created_by: z.union([z.string(), z.number()]).nullish(),
      creation_date: text,
      last_update_date: text,
      ref_object_type: text,
      ref_object_id: z.number().int().positive().nullish(),
    }),
  ),
});
/** A secondary read that degrades the page instead of failing it; a dead session still signs out. */
async function orNull<T>(read: Promise<T>): Promise<T | null> {
  try {
    return await read;
  } catch (e) {
    if (e instanceof AppError && e.status === 401) throw e;
    if (e instanceof AppError || e instanceof ZodError) return null;
    throw e;
  }
}
async function requestDetails(token: string, id: string) {
  const b = detailsSchema.parse(
    await oracle("getDynamicFormsGetRequestDetails", {
      token,
      request_id: id,
    }),
  );
  const record = b.items[0];
  if (b.items.length !== 1 || String(record.request_id) !== id)
    throw new AppError("CONTRACT", "Oracle returned a different application.");
  return record;
}
const pageNames = z.object({
  items: z.array(z.object({ page_name: z.string() })),
});
const lockRows = z.object({
  items: z.array(z.object({ id: z.number(), page_id: z.number() })),
});
const people = z.object({
  items: z.array(
    z.object({ person_id: z.coerce.number(), full_name: z.string() }),
  ),
});
/**
 * One AOI / EOI record (GN-Angular EoiRecordState), read once per request and shared by the layout and the tab:
 * the request, the user's rights on it (no readable page denies it), the finalize state, the opportunity (found
 * from the request's `ref_object_id`, so a link without it works) and the creator's name.
 */
export const eoiRecordContext = cache(async (id: string) => {
  if (!recordId.safeParse(id).success)
    throw new AppError("BAD_REQUEST", "Invalid application identity.", 400);
  const { session, user } = await authenticate();
  // "opportunities-eoi" is an RB bundle, not a module_access id: VBCS findModuleAccess derives it from the group.
  requireModule(user, "opportunities-group");
  const token = session.token;
  // The person list is reference data, so it loads alongside the access check; no record data is read before it.
  const staffRead = orNull(
    referenceRead("getPre_awardGetPersonListAll", { token }).then(
      (raw) => people.parse(raw).items,
    ),
  );
  staffRead.catch(() => undefined);
  const access = objectAccessOf(
    roleSchema.parse(
      // Every tab of the record reads these; held as briefly as the dashboard roles (VBCS reads them once per record).
      await cachedRead(
        "getSecurityUser_roles",
        { token, p_obj_id: id, p_obj_type: EOI_MODULE },
        TTL.access,
      ),
    ).items,
  );
  if (![...access.roles.values()].some((a) => a.read))
    throw new AppError("FORBIDDEN", "You don't have access to this AOI", 403);
  // Only the opportunity needs the request (its ref_object_id); the finalize and lock reads start with it.
  const requestRead = requestDetails(token, id);
  const [request, opportunity, finalizable, locks, staff] = await Promise.all([
    requestRead,
    requestRead.then((request) => {
      const opportunityId =
        (request.ref_object_type ?? "OPPORTUNITIES") === "OPPORTUNITIES"
          ? (request.ref_object_id ?? null)
          : null;
      return opportunityId === null
        ? null
        : orNull(readOpportunityRecord(token, opportunityId));
    }),
    // request_type is always OPPORTUNITIES-EOI (the details schema's literal).
    orNull(
      oracle("getSharedFinalizablePages", {
        token,
        p_obj_type: EOI_MODULE,
        p_obj_id: id,
      }).then((raw) =>
        pageNames.parse(raw).items.map((p) => p.page_name.toLowerCase()),
      ),
    ),
    orNull(
      oracle(
        "getProposalGetLockedModules",
        { token, module_name: EOI_MODULE },
        new URLSearchParams({ prop_id: id }),
      ).then((raw) => lockRows.parse(raw).items),
    ),
    staffRead,
  ]);
  const finalized = finalizedOf(access.pages, locks ?? []);
  return {
    session,
    user,
    id,
    access,
    request,
    opportunity,
    createdBy:
      staff?.find((p) => String(p.person_id) === String(request.created_by))
        ?.full_name ?? null,
    finalizable,
    finalized,
    tabs: visibleTabs(access, finalizable, new Set(finalized.keys())),
  };
});
export type EoiRecordContext = Awaited<ReturnType<typeof eoiRecordContext>>;
/** A tab the record does not show (no read, no request, Workflow not yet reachable) is denied, as getTabs hides it. */
export async function eoiRecordRead(id: string, tab: EoiTab) {
  const context = await eoiRecordContext(id);
  if (!context.tabs.includes(tab))
    throw new AppError(
      "FORBIDDEN",
      "You do not have access to this page.",
      403,
    );
  return context;
}
const lockSchema = z.object({
  status: text,
  lock_module_id: z.number().nullish(),
});
async function lockStatus(token: string, id: string, page: number) {
  const b = lockSchema.parse(
    await oracle("getProposalGetLockStatus", {
      token,
      prop_id: id,
      lock_level: String(page),
      module_name: EOI_MODULE,
    }),
  );
  return { locked: b.status !== "UNLOCK", lockId: b.lock_module_id ?? null };
}
/**
 * The tab's lock (getLockStatus, `lock_level` = the page id). A tab that is not one of the record's pages has none;
 * a lock that could not be read is unknown and treated as locked (read-only), never as open.
 */
// Per request: the tab and the attachments panel it hosts read the same lock once.
export const eoiPageLock = cache(
  async (context: EoiRecordContext, tab: EoiTab): Promise<PageLock> => {
    const page = context.access.pages.find((p) => p.name === pageOf(tab));
    if (!page) return { known: false, locked: false };
    const lock = await orNull(
      lockStatus(context.session.token, context.id, page.id),
    );
    return lock
      ? { known: true, locked: lock.locked }
      : { known: false, locked: true };
  },
);
/**
 * The Attachments tab as an attachments host. Legacy passes `true` for every EOI edit flag (no RBAC gate, any status);
 * here a change needs the page's edit right, an open lock (finalized or unreadable refuses) and a draft or rework status.
 * `read` checks only the tab; `view` and `edit` also settle `canEdit`, and `edit` refuses without it.
 */
export async function eoiAttachmentHost(
  id: string,
  mode: "read" | "view" | "edit",
): Promise<AttachmentHost> {
  const context = await eoiRecordRead(id, "attachments");
  const page = pageOf("attachments");
  let canEdit = false;
  if (mode !== "read") {
    const lock = await eoiPageLock(context, "attachments");
    const finalized = lock.locked || context.finalized.has(page),
      open = ATTACHMENT_STATUSES.includes(context.request.status_code ?? "");
    canEdit =
      context.access.roles.get(page)?.edit === true && !finalized && open;
    if (mode === "edit" && !canEdit)
      throw new AppError(
        "FORBIDDEN",
        finalized
          ? "This page is finalized, so its attachments cannot be changed."
          : !open
            ? "Attachments can be changed only while the application is a draft or in rework."
            : "You do not have access to change these attachments.",
        403,
      );
  }
  return {
    objectType: EOI_MODULE,
    objectId: id,
    // Legacy files EOI documents under the request id, not its number.
    objectNumber: id,
    pathSegment: EOI_MODULE,
    bundle: "opportunities-eoi",
    token: context.session.token,
    user: context.user,
    canEdit,
  };
}
export const finalizeInput = z
  .object({ tab: z.enum(eoiTabs), finalize: z.boolean() })
  .strict();
/**
 * WRITES: finalizes or unlocks the tab's page (insertModuleLock). Only a draft's readable, finalizable page; the
 * page and lock ids come from Oracle, never the browser; `created_by` carries the session token as the contract has it.
 */
export async function eoiSetFinalized(id: string, raw: unknown) {
  const input = finalizeInput.parse(raw);
  const context = await eoiRecordRead(id, input.tab);
  const page = context.access.pages.find((p) => p.name === pageOf(input.tab));
  if (
    !page ||
    !EDITABLE_STATUSES.includes(context.request.status_code ?? "") ||
    !context.finalizable?.includes(page.name)
  )
    throw new AppError("FORBIDDEN", "This page cannot be finalized.", 403);
  const token = context.session.token;
  const { lockId } = await lockStatus(token, id, page.id);
  const body = {
    proposal_id: Number(id),
    created_by: token,
    status: input.finalize ? "FINALIZE" : "UNLOCK",
    page_id: page.id,
    id: lockId,
    module_name: EOI_MODULE,
  };
  if (fixtureMode())
    (await import("@/test-support/eoi-writes")).fixtureModuleLock(body);
  else
    await oracleWrite(
      "postProposalInsertModuleLock",
      {
        token,
        legal_id: context.user.legalId ?? "",
        org_id: context.user.organizationId,
      },
      body,
    );
  return { finalized: input.finalize };
}
/** The header's converts: an approved application and the record role for the kind; its opportunity id. */
export async function eoiConvertSource(
  id: string,
  kind: "OUTLINE_PROPOSAL" | "PROPOSAL",
) {
  const context = await eoiRecordContext(id);
  const converts = headerConverts(context.request.status_code, context.access);
  const opportunityId = context.request.ref_object_id;
  if (
    !(kind === "PROPOSAL" ? converts.full : converts.outline) ||
    !opportunityId
  )
    throw new AppError(
      "FORBIDDEN",
      "This application cannot be converted.",
      403,
    );
  return { session: context.session, user: context.user, opportunityId };
}
/**
 * A new application (no request yet). The original read every tab as open; here it fails closed: the finder's
 * module, `apply-opportunities` read, the opportunity's `create_application_of_interest` flag and an open status.
 */
export const newApplicationContext = cache(async (opportunityId: string) => {
  if (!recordId.safeParse(opportunityId).success)
    throw new AppError("BAD_REQUEST", "Invalid opportunity identity.", 400);
  const { session, user } = await authenticate();
  requireModule(user, "opportunities-finder");
  const rolesRead = dashboardRoles();
  const check = rolesRead.then((roles) => {
    if (!pageAccess(roles, "apply-opportunities").read)
      throw new AppError(
        "FORBIDDEN",
        "This action is not enabled for your account.",
        403,
      );
  });
  const opportunity = await afterCheck(
    check,
    readOpportunityRecord(session.token, Number(opportunityId)),
  );
  const roles = await rolesRead;
  if (!opportunity)
    throw new AppError("BAD_REQUEST", "The opportunity was not found.", 404);
  if (
    !allows(opportunity).apply ||
    !canCreate(opportunity.opportunity_status ?? "")
  )
    throw new AppError(
      "FORBIDDEN",
      "Applications are not open for this opportunity.",
      403,
    );
  return { session, user, roles, opportunity };
});
/**
 * More Info (the original's `isDetailPage`): the opportunity's summary with its actions bar. The finder's module is
 * enough to read it; each action carries its own gate, and the server checks it again when it runs.
 */
export async function opportunityDetail(opportunityId: string) {
  if (!recordId.safeParse(opportunityId).success)
    throw new AppError("BAD_REQUEST", "Invalid opportunity identity.", 400);
  const { session, user } = await authenticate();
  requireModule(user, "opportunities-finder");
  const [opportunity, rows, format, roles, deadlineWarningDays] =
    await Promise.all([
      readOpportunityRecord(session.token, Number(opportunityId)),
      resources(),
      displayFormat(),
      summaryRoles(),
      opportunityGlobals(),
    ]);
  if (!opportunity)
    throw new AppError("BAD_REQUEST", "The opportunity was not found.", 404);
  const t = (group: string, key: string, fallback: string) =>
    label(rows, "opportunities-eoi", group, key, fallback);
  const closing = opportunity.closing_date ?? undefined;
  const actionContext: SummaryActionContext = {
    opportunityId,
    closingAt: closing,
    closingDisplay: closing ? dateDisplay(closing, format) : undefined,
    deadlineWarningDays,
    texts: {
      deadlineTitle: t(
        "dialog-titles",
        "deadline-warning",
        "Application deadline approaching",
      ),
      deadlineMessage: t(
        "warning-messages",
        "deadline-warning",
        "You are applying close to the application deadline. Please ensure you have enough time to complete your submission.",
      ),
      closingDate: t("labels", "closing-date", "Closing Date"),
      continue: t("button-labels", "continue", "Continue"),
      cancel: t("button-labels", "cancel", "Cancel"),
    },
  };
  return {
    view: summaryView(opportunity, rows, roles, format, true),
    actionContext,
  };
}
export const createInput = z
  .object({
    opportunityId: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
  })
  .strict();
/**
 * WRITES: creates the application (insertRequest, a GET that inserts) once its form has validated, and reads its
 * number for the answers' file folder. A number that cannot be read comes back null, so the caller never saves
 * files under an unknown folder (legacy wrote `/undefined/`).
 */
export async function createEoiApplication(raw: unknown) {
  const { opportunityId } = createInput.parse(raw);
  const { session } = await newApplicationContext(String(opportunityId));
  const created = z
    .object({ request_id: z.coerce.number().int().positive().optional() })
    .parse(
      // Fixture writes answer `{}`; the labelled development store stands in for the created request there.
      fixtureMode()
        ? (await import("@/test-support/eoi-writes")).fixtureInsertRequest()
        : await oracleWrite("getDynamicFormsInsertRequest", {
            token: session.token,
            P_REF_OBJECT_ID: String(opportunityId),
            P_REF_OBJECT_TYPE: "OPPORTUNITIES",
            P_REQUEST_TYPE: EOI_MODULE,
          }),
    );
  if (created.request_id === undefined)
    throw new AppError("CONTRACT", "The application was not created.");
  const requestId = String(created.request_id);
  const details = await orNull(requestDetails(session.token, requestId));
  return { requestId, number: details?.request_number ?? null };
}
