import "server-only";
import { z } from "zod";
import { claims } from "@/server/oracle/api";
import { resources } from "@/server/platform/configuration/resources";
import { AppError } from "@/lib/errors";
import type { UnitRosterView } from "@/features/modules/claims/units/listing/types";
import { label, numberish, optionalText } from "../listing";
import { unitRecordRead, type UnitRecordContext } from "../record";
import { appFundsOf, fundOf, items } from "./goals";
import { available, statusConfig, type StatusConfig } from "./status";

const text = (v: unknown) => (v === null || v === undefined ? "" : String(v));
const rosterRow = z.object({
  roster_id: numberish,
  first_name: optionalText,
  last_name: optionalText,
  certified_teacher_flag: optionalText,
  certified_parapro_flag: optionalText,
  local_fund_flag: optionalText,
  pri_app_fund_id: numberish,
  pri_fund_job_title: optionalText,
  pri_file_name: optionalText,
  pri_cred_doc_id: numberish,
  sec_app_fund_id: numberish,
  sec_fund_job_title: optionalText,
  sec_file_name: optionalText,
  sec_cred_doc_id: numberish,
  roster_status: optionalText,
  roster_status_descr: optionalText,
});
const titleRow = z.object({
  job_title: optionalText,
  job_title_descr: optionalText,
  lookup_code: optionalText,
  lookup_code_value: optionalText,
});
/** Legacy: Add with `activity-roster` edit; a member's Edit / Delete also by its status (CLAIM_ROSTER). */
const canEdit = (context: UnitRecordContext) =>
  context.access.roles.get("activity-roster")?.edit === true;
const memberOpen = (config: StatusConfig, status: string) =>
  status === "" || available(config, ["CLAIM_ROSTER"], status);
const listOf = async (context: UnitRecordContext) =>
  items(
    rosterRow,
    await claims.roster({
      appId: Number(context.id),
      orgId: context.user.organizationId,
    }),
  );

/** The Roster (legacy rosterSection, read when it opens): members, funds, the gates. */
export async function rosterView(id: string): Promise<UnitRosterView> {
  const context = await unitRecordRead(id, "activities");
  const [rows, list, funds, config] = await Promise.all([
    resources(),
    listOf(context),
    appFundsOf(context),
    statusConfig().catch(() => ({})),
  ]);
  const t = (group: string, key: string, fallback: string) =>
    label(rows, group, key, fallback);
  const fundName = (v: unknown) =>
    funds.find((f) => text(f.app_fund_id) === text(v))?.full_fund_display ?? "";
  const edit = canEdit(context);
  return {
    canAdd: edit,
    funds: funds.map((f) => ({
      value: text(f.app_fund_id),
      label: f.full_fund_display ?? f.fund_name ?? "",
    })),
    rows: list.map((r) => ({
      key: text(r.roster_id),
      firstName: text(r.first_name),
      lastName: text(r.last_name),
      teacher: r.certified_teacher_flag === "Y",
      parapro: r.certified_parapro_flag === "Y",
      localFund: r.local_fund_flag === "Y",
      primaryFund: text(r.pri_app_fund_id),
      primaryFundName: fundName(r.pri_app_fund_id),
      primaryTitle: text(r.pri_fund_job_title),
      primaryFile: text(r.pri_file_name),
      secondaryFund: text(r.sec_app_fund_id),
      secondaryFundName: fundName(r.sec_app_fund_id),
      secondaryTitle: text(r.sec_fund_job_title),
      secondaryFile: text(r.sec_file_name),
      status: text(r.roster_status_descr),
      editable: edit && memberOpen(config, text(r.roster_status)),
    })),
    headers: Object.fromEntries(
      (
        [
          ["roster-number", "No"],
          ["first-name", "First Name"],
          ["last-name", "Last Name"],
          ["certified-teacher", "Certified Teacher"],
          ["certified-parapro", "Certified Paraprofessional"],
          ["primary-fund-type", "Primary Fund"],
          ["primary-job-title", "Primary Job Title"],
          ["primary-credential", "Primary Credential"],
          ["secondary-fund-type", "Secondary Fund"],
          ["secondary-job-title", "Secondary Job Title"],
          ["secondary-credential", "Secondary Credential"],
          ["local-fund", "Local Fund"],
          ["roster-status", "Status"],
        ] as const
      ).map(([k, fallback]) => [k, t("table-headers", k, fallback)]),
    ),
    labels: Object.fromEntries(
      (
        [
          ["roster-first-name", "First Name"],
          ["roster-last-name", "Last Name"],
          ["primary-funder-type", "Primary Fund"],
          ["primary-job-title", "Primary Job Title"],
          ["secondary-funder-type", "Secondary Fund"],
          ["secondary-job-title", "Secondary Job Title"],
          ["certified-teacher", "Certified Teacher"],
          ["certified-parapro", "Certified Paraprofessional"],
          ["local-fund", "Local Fund"],
        ] as const
      ).map(([k, fallback]) => [k, t("labels", k, fallback)]),
    ),
    texts: {
      heading: t("labels", "roster", "Roster"),
      add: t("button-labels", "add-roster", "Add Roster"),
      approvals: t("button-labels", "approvals", "Approvals"),
      approvalTitle: t("dialog-titles", "approval-details", "Approval Details"),
      title: t("dialog-titles", "roster-details", "Roster Details"),
      submit: t("button-labels", "submit", "Submit"),
      edit: t("button-labels", "edit", "Edit"),
      delete: t("button-labels", "delete", "Delete"),
      yes: t("option-keys", "yes", "Yes"),
      no: t("option-keys", "no", "No"),
      deleteTitle: t("dialog-titles", "warning", "Warning"),
      deleteText: t(
        "warning-messages",
        "permanent-delete",
        "This will permanently delete the record. Do you want to continue?",
      ),
      empty: t("helper-texts", "no-data", "No data to display."),
    },
  };
}

/** A fund's job titles for the roster dialog (legacy loadRosterJobTitles). */
export async function rosterTitles(id: string, rawFund: unknown) {
  const context = await unitRecordRead(id, "activities");
  const fund = fundOf(await appFundsOf(context), rawFund);
  return items(
    titleRow,
    await claims.rosterJobTitles({
      appId: Number(context.id),
      appFundId: Number(fund.app_fund_id),
    }),
  ).map((r) => {
    const value = text(r.job_title ?? r.lookup_code);
    return {
      value,
      label: text(r.job_title_descr ?? r.lookup_code_value) || value,
    };
  });
}

const fundId = z.union([z.literal(""), z.string().regex(/^\d{1,15}$/)]);
const saveInput = z
  .object({
    roster: z.coerce.number().int().positive().optional(),
    firstName: z.string().trim().min(1).max(120),
    lastName: z.string().trim().min(1).max(120),
    primaryFund: z.string().regex(/^\d{1,15}$/),
    primaryTitle: z.string().max(240),
    secondaryFund: fundId,
    secondaryTitle: z.string().max(240),
    teacher: z.boolean(),
    parapro: z.boolean(),
    localFund: z.boolean(),
  })
  .strict();
/**
 * WRITES: adds or saves a roster member (legacy saveRosterItem: postRoster / putRoster). The funds must be the
 * application's; a fund's job title is required with it; an update keeps the member's credential documents.
 */
export async function saveRoster(id: string, raw: unknown) {
  const parsed = saveInput.safeParse(raw);
  if (!parsed.success)
    throw new AppError(
      "BAD_REQUEST",
      "Please fill all the required fields!",
      400,
    );
  const input = parsed.data;
  if (
    !input.primaryTitle.trim() ||
    (input.secondaryFund !== "" && !input.secondaryTitle.trim())
  )
    throw new AppError(
      "BAD_REQUEST",
      "Please fill all the required fields!",
      400,
    );
  const context = await unitRecordRead(id, "activities");
  if (!canEdit(context))
    throw new AppError(
      "FORBIDDEN",
      "You do not have access to change the roster.",
      403,
    );
  const [list, funds, config] = await Promise.all([
    listOf(context),
    appFundsOf(context),
    statusConfig(),
  ]);
  const existing =
    input.roster === undefined
      ? undefined
      : list.find((r) => Number(r.roster_id) === input.roster);
  if (input.roster !== undefined && !existing)
    throw new AppError("FORBIDDEN", "This member is not on the roster.", 403);
  if (existing && !memberOpen(config, text(existing.roster_status)))
    throw new AppError(
      "FORBIDDEN",
      "This roster member cannot be changed in its current status.",
      403,
    );
  const ours = (v: string) =>
    v === "" || funds.some((f) => text(f.app_fund_id) === v);
  if (!ours(input.primaryFund) || !ours(input.secondaryFund))
    throw new AppError(
      "FORBIDDEN",
      "This fund is not on the application.",
      403,
    );
  const flag = (b: boolean) => (b ? "Y" : "N");
  // Legacy posts the whole record; picked here: the member, the funds and titles, the flags, the documents kept.
  const body = {
    ...(existing ? { roster_id: input.roster } : {}),
    app_id: Number(context.id),
    first_name: input.firstName,
    last_name: input.lastName,
    pri_app_fund_id: Number(input.primaryFund),
    pri_fund_job_title: input.primaryTitle,
    sec_app_fund_id: input.secondaryFund ? Number(input.secondaryFund) : null,
    sec_fund_job_title: input.secondaryFund ? input.secondaryTitle : null,
    certified_teacher_flag: flag(input.teacher),
    certified_parapro_flag: flag(input.parapro),
    local_fund_flag: flag(input.localFund),
    pri_cred_doc_id: existing?.pri_cred_doc_id ?? null,
    sec_cred_doc_id: existing?.sec_cred_doc_id ?? null,
  };
  if (existing) await claims.updateRoster({ rosterId: input.roster!, body });
  else await claims.createRoster({ appId: Number(context.id), body });
  return { saved: true as const };
}

/** WRITES: removes a roster member (legacy deleteRosterItem), with the right and an open status. */
export async function deleteRoster(id: string, raw: unknown) {
  const parsed = z
    .object({ roster: z.coerce.number().int().positive() })
    .strict()
    .safeParse(raw);
  if (!parsed.success)
    throw new AppError("BAD_REQUEST", "Invalid roster.", 400);
  const context = await unitRecordRead(id, "activities");
  const [list, config] = await Promise.all([listOf(context), statusConfig()]);
  const member = list.find((r) => Number(r.roster_id) === parsed.data.roster);
  if (!member)
    throw new AppError("FORBIDDEN", "This member is not on the roster.", 403);
  if (!canEdit(context) || !memberOpen(config, text(member.roster_status)))
    throw new AppError(
      "FORBIDDEN",
      "This roster member cannot be changed in its current status.",
      403,
    );
  await claims.deleteRoster({ rosterId: parsed.data.roster });
  return { deleted: true as const };
}

/** A member of this application's roster (its approval route), refused otherwise. */
export async function rosterMember(context: UnitRecordContext, raw: string) {
  const member = (await listOf(context)).find((r) => text(r.roster_id) === raw);
  if (!member)
    throw new AppError("FORBIDDEN", "This member is not on the roster.", 403);
  return member;
}
