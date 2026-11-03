import "server-only";
import { z } from "zod";
import { awards, lookups, people } from "@/server/oracle/api";
import {
  resources,
  type Resources,
} from "@/server/platform/configuration/resources";
import { AppError } from "@/lib/errors";
import { pageOf } from "@/shared/awards/award-record";
import {
  HEADER_FIELDS,
  HEADER_LISTS,
  type HeaderField,
  type HeaderView,
} from "@/features/modules/awards/record/header-model";
import {
  awardPageLock,
  awardRecordRead,
  isDraft,
  type AwardRecordContext,
} from "../record";
import { serverFunctions } from "@/server/functions";

const BUNDLE = "award";
const numeric = z.coerce.number().int().positive();
const items = <T extends z.ZodTypeAny>(row: T) =>
  z.object({ items: z.array(row) });
const sponsorRows = items(
  z.object({ sponsor_party_id: numeric, party_name: z.string() }),
);
const currencyRows = items(
  z.object({
    lookup_type_code: z.string().nullish(),
    lookup_code: z.string(),
    lookup_code_descr: z.string().nullish(),
  }),
);
const str = (v: unknown) => (v === null || v === undefined ? "" : String(v));
const day = (v: unknown) => str(v).slice(0, 10);

/** The choice lists (legacy app-level person and GLOBAL org lists, GetSponsorList, CURRENCY_CODES). */
async function headerChoices() {
  const [persons, orgs, sponsors, currencies] = await Promise.all([
    people.all(),
    lookups.orgUnits({}).then(serverFunctions.organizations.orgUnitRows),
    lookups.sponsors().then((raw) => sponsorRows.parse(raw).items),
    lookups
      .codes({ types: "CURRENCY_CODES" })
      .then((raw) =>
        currencyRows
          .parse(raw)
          .items.filter(
            (r) =>
              (r.lookup_type_code ?? "CURRENCY_CODES") === "CURRENCY_CODES",
          ),
      ),
  ]);
  return {
    people: persons.flatMap((p) =>
      p.full_name ? [{ value: String(p.person_id), label: p.full_name }] : [],
    ),
    orgs: orgs.map((o) => ({
      value: o.id,
      label: " ".repeat(o.depth) + o.name,
    })),
    sponsors: sponsors.map((s) => ({
      value: String(s.sponsor_party_id),
      label: s.party_name,
    })),
    currencies: currencies.map((c) => ({
      value: c.lookup_code,
      label: c.lookup_code_descr || c.lookup_code,
    })),
  };
}

/** Each field's gates: visible on 'Y' (fail closed), required from the RB flag, Award Number and Billing Party rules. */
function headerFields(rows: Resources, context: AwardRecordContext) {
  const billingEdit =
    context.access.roles.get("awards-header-billing-party")?.edit === true;
  return Object.fromEntries(
    HEADER_FIELDS.map(([field, key, fallback]) => [
      field,
      {
        show: serverFunctions.resources.resourceVisible(
          rows,
          BUNDLE,
          "labels",
          key,
        ),
        required: serverFunctions.resources.resourceRequired(
          rows,
          BUNDLE,
          "labels",
          key,
          false,
        ),
        label: serverFunctions.resources.label(
          rows,
          BUNDLE,
          "labels",
          key,
          fallback,
        ),
        maxLength: serverFunctions.resources.resourcePreference(
          rows,
          BUNDLE,
          "labels",
          key,
          "maxLength",
        ),
        readOnly:
          field === "number" || (field === "billingParty" && !billingEdit),
      },
    ]),
  ) as HeaderView["fields"];
}
function headerValues(context: AwardRecordContext): HeaderView["values"] {
  const a = context.award,
    raw = context.raw;
  return {
    pi: str(a.pi_pid),
    org: str(a.org_id),
    sponsor: str(a.sponsor_id),
    fullTitle: str(a.full_title),
    name: str(a.award_name),
    number: str(a.award_number),
    actualDate: day(a.actual_award_date),
    currency: str(a.currency),
    period: str(raw.period),
    billingParty: str(a.billing_party_id),
    billingCycle: str(raw.billing_cycle),
    billingRule: str(raw.billing_distribution_rule),
    revenueRule: str(raw.revenue_distribution_rule),
    assignedTo: str(raw.assigned_to),
  };
}
const attributeValues = (raw: Record<string, unknown>) =>
  Object.fromEntries(
    Object.entries(raw).flatMap(([k, v]) =>
      /^attribute_\d{1,2}$/.test(k) && v !== null && v !== undefined && v !== ""
        ? [[k, String(v)]]
        : [],
    ),
  );

export async function headerView(id: string): Promise<HeaderView> {
  const context = await awardRecordRead(id, "header");
  const [rows, choices, lock] = await Promise.all([
    resources(),
    headerChoices(),
    awardPageLock(context, "header"),
  ]);
  const t = (group: string, key: string, fallback: string) =>
    serverFunctions.resources.label(rows, BUNDLE, group, key, fallback);
  const period = (key: string, fallback: string) => ({
    label: t("labels", key, fallback),
    required: serverFunctions.resources.resourceRequired(
      rows,
      BUNDLE,
      "labels",
      key,
      false,
    ),
    help: serverFunctions.resources.resourceDescription(
      rows,
      BUNDLE,
      "labels",
      key,
    ),
  });
  const a = context.award;
  return {
    awardId: id,
    number: str(a.award_number),
    fields: headerFields(rows, context),
    values: headerValues(context),
    choices,
    attributes: attributeValues(context.raw),
    showAttributes: serverFunctions.resources.resourceVisible(
      rows,
      BUNDLE,
      "labels",
      "show-attributes",
    ),
    periods: context.periods.map((p, i) => ({
      key: str(p.proposal_id) || String(i),
      start: day(p.award_start_date),
      end: day(p.award_end_date),
      amount: str(p.amount),
      editable: Number(p.is_editable) === 1,
    })),
    canEditPeriods:
      isDraft(context) &&
      !lock.locked &&
      context.access.roles.get(pageOf("header"))?.edit === true,
    periodFields: {
      start: period("header-award-start-date", "Award Start Date"),
      end: period("header-award-end-date", "Award End Date"),
      amount: period("header-award-amount", "Award Amount"),
    },
    proposalRange:
      a.proposal_start_date || a.proposal_end_date
        ? { start: day(a.proposal_start_date), end: day(a.proposal_end_date) }
        : null,
    texts: {
      required: t(
        "error-msg",
        "required-fields",
        "Please fill all the required fields",
      ),
      updated: t("success-msg", "updated", "Updated"),
      periodsTitle: t("header-labels", "award-periods", "Award Periods"),
      periodEditTitle: t("labels", "edit-award-summary", "Edit Award Summary"),
      periodOutside: t(
        "warning-messages",
        "award-dates-outside-proposal",
        "Award dates extend outside the Proposal date range.",
      ),
      save: t("button-labels", "save", "Save"),
      cancel: t("button-labels", "cancel", "Cancel"),
      edit: t("button-labels", "edit", "Edit"),
      noPeriods: t("helper-texts", "no-data", "No data to display."),
    },
  };
}

/** Edits need the header page's edit right, an editable draft award and an open lock (legacy Edit Award Header). */
async function editableHeader(id: string) {
  const context = await awardRecordRead(id, "header");
  const lock = await awardPageLock(context, "header");
  const editable =
    context.award.is_editable === true ||
    Number(context.award.is_editable) === 1;
  if (
    context.access.roles.get(pageOf("header"))?.edit !== true ||
    !editable ||
    !isDraft(context)
  )
    throw new AppError(
      "FORBIDDEN",
      "This award's header cannot be changed.",
      403,
    );
  if (lock.locked)
    throw new AppError(
      "FORBIDDEN",
      "This page is finalized; unlock it to make changes.",
      403,
    );
  return context;
}

const fieldValue = z.string().max(4000);
const headerInput = z
  .object({
    values: z
      .object(
        Object.fromEntries(
          HEADER_FIELDS.map(([f]) => [f, fieldValue.optional()]),
        ) as Record<HeaderField, z.ZodOptional<typeof fieldValue>>,
      )
      .strict(),
    attributes: z
      .record(
        z.string().regex(/^attribute_\d{1,2}$/),
        z.union([z.string().max(4000), z.number(), z.null()]),
      )
      .default({}),
  })
  .strict();

/**
 * WRITES: the award header (legacy prepareAwardPayload, PascalCase). Only shown, editable fields come from the
 * browser; everything else is the award as read. Legacy defects fixed: the billing party is no longer the funder
 * when none is set, and the proposal is the award's own, not the URL's.
 */
export async function saveHeader(id: string, raw: unknown) {
  const input = headerInput.parse(raw);
  const context = await editableHeader(id);
  const [rows, choices] = await Promise.all([resources(), headerChoices()]);
  const fields = headerFields(rows, context);
  const current = headerValues(context);
  const value = (f: HeaderField) =>
    fields[f].show && !fields[f].readOnly
      ? (input.values[f] ?? current[f]).trim()
      : current[f];
  const v = Object.fromEntries(
    HEADER_FIELDS.map(([f]) => [f, value(f)]),
  ) as Record<HeaderField, string>;
  const missing = HEADER_FIELDS.some(
    ([f]) => fields[f].show && fields[f].required && v[f] === "",
  );
  if (missing)
    throw new AppError(
      "BAD_REQUEST",
      serverFunctions.resources.label(
        rows,
        BUNDLE,
        "error-msg",
        "required-fields",
        "Please fill all the required fields",
      ),
      400,
    );
  if (
    HEADER_FIELDS.some(([f]) => (fields[f].maxLength ?? Infinity) < v[f].length)
  )
    throw new AppError("BAD_REQUEST", "A field is longer than allowed.", 400);
  for (const [f, list] of Object.entries(HEADER_LISTS) as [
    HeaderField,
    keyof typeof choices,
  ][])
    if (
      v[f] !== "" &&
      v[f] !== current[f] &&
      !choices[list].some((o) => o.value === v[f])
    )
      throw new AppError("BAD_REQUEST", "A chosen value is not offered.", 400);
  if (v.actualDate !== "" && !/^\d{4}-\d{2}-\d{2}$/.test(v.actualDate))
    throw new AppError("BAD_REQUEST", "Invalid date.", 400);
  const n = (s: string) => (s === "" ? null : Number(s));
  const a = context.award,
    r = context.raw;
  const assigned = choices.people.find((p) => p.value === v.assignedTo);
  // Legacy prepareAwardPayload: attribute_N only when it has a value.
  const attributes = Object.fromEntries(
    Object.entries(input.attributes).filter(
      ([, value]) => value !== null && value !== "",
    ),
  );
  const body = {
    ActualAwardDate: v.actualDate || null,
    assigned_to: n(v.assignedTo),
    assigned_to_name: assigned?.label ?? r.assigned_to_name ?? null,
    AwardAmount: a.award_amount ?? null,
    AwardEndDate: a.award_end_date ?? null,
    AwardStartDate: a.award_start_date ?? null,
    AwardID: a.award_id,
    AwardName: v.name,
    AwardNumber: v.number,
    AwardOwningOrganizationName: r.award_owning_org_name ?? null,
    AwardStatus: a.award_status ?? null,
    AwardTemplateID: r.award_template_id ?? null,
    BillingCycle: v.billingCycle || null,
    BillingDistributionRule: v.billingRule || null,
    RevenueDistributionRule: v.revenueRule || null,
    BillingPartyId: n(v.billingParty),
    BusinessUnitName: r.business_unit ?? null,
    Currency: v.currency || null,
    ERPAwardID: a.erp_award_id ?? null,
    Faculty: r.faculty ?? null,
    FullTitle: v.fullTitle,
    OrgID: n(v.org),
    Period: n(v.period),
    PIPID: n(v.pi),
    ProposalID:
      a.proposal_id === null || a.proposal_id === undefined
        ? null
        : Number(a.proposal_id),
    SponsorId: n(v.sponsor),
    ...attributes,
  };
  await awards.create({ body });
  return { saved: true };
}

const day10 = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const periodInput = z
  .object({
    key: z.string().min(1).max(40),
    start: day10.or(z.literal("")),
    end: day10.or(z.literal("")),
    amount: z.number().finite().min(0).nullable(),
  })
  .strict();
/** WRITES: one award period (legacy SaveButtonActionChain: { award_amount, award_end_date, award_id, award_start_date, proposal_id }). */
export async function savePeriod(id: string, raw: unknown) {
  const input = periodInput.parse(raw);
  const context = await awardRecordRead(id, "header");
  const lock = await awardPageLock(context, "header");
  if (
    !isDraft(context) ||
    lock.locked ||
    context.access.roles.get(pageOf("header"))?.edit !== true
  )
    throw new AppError(
      "FORBIDDEN",
      "This award's periods cannot be changed.",
      403,
    );
  const row = context.periods.find(
    (p, i) => (str(p.proposal_id) || String(i)) === input.key,
  );
  if (!row || Number(row.is_editable) !== 1)
    throw new AppError("BAD_REQUEST", "That period cannot be changed.", 400);
  if (input.start && input.end && input.end < input.start)
    throw new AppError(
      "BAD_REQUEST",
      "End date cannot be before start date.",
      400,
    );
  const rows = await resources();
  const required = (key: string) =>
    serverFunctions.resources.resourceRequired(
      rows,
      BUNDLE,
      "labels",
      key,
      false,
    );
  if (
    (required("header-award-start-date") && !input.start) ||
    (required("header-award-end-date") && !input.end) ||
    (required("header-award-amount") && input.amount === null)
  )
    throw new AppError(
      "BAD_REQUEST",
      "Please fill all the required fields",
      400,
    );
  await awards.savePeriod({
    body: {
      award_amount: input.amount,
      award_end_date: input.end || null,
      award_id: context.award.award_id,
      award_start_date: input.start || null,
      proposal_id:
        row.proposal_id === null || row.proposal_id === undefined
          ? null
          : Number(row.proposal_id),
    },
  });
  return { saved: true };
}
