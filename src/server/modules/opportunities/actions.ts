import "server-only";
import { z } from "zod";
import { authenticate } from "@/server/identity/session/service";
import { requireModule } from "@/server/platform/permissions";
import {
  dynamicForm,
  lookups,
  opportunities,
  people as peopleApi,
} from "@/server/oracle/api";
import {
  dashboardRoles,
  organizations,
} from "@/server/platform/configuration/service";
import {
  label,
  resourcePreference,
  resources,
  resourceVisible,
} from "@/server/platform/configuration/resources";
import { formattingConfiguration } from "@/server/platform/configuration/formatting";
import { sanitizeHtml } from "@/server/platform/sanitize";
import {
  canCreate,
  splitFunders,
} from "@/features/modules/opportunities/display";
import { AppError } from "@/lib/errors";
import { eoiConvertSource } from "./record";
import {
  afterCheck,
  bundleOf,
  convertGates,
  pageAccess,
  type ConvertKind,
  type Opener,
} from "./gates";
import {
  applyInput,
  bookmarkInput,
  convertInput,
  defaultFormResponse,
  dynFormsSchema,
  matchSponsor,
  notesInput,
  proposalPayload,
  shareInput,
  sharePayload,
} from "./payloads";
const DEFAULT_MAX_COMMENT = 2500;
const SHARE_BUNDLE = "opportunities-eoi";
const items = <T extends z.ZodTypeAny>(row: T) =>
  z.object({ items: z.array(row) });
const text = z.string().nullish();
const numeric = z.coerce.number().int().positive();
/** Card actions need the finder's module grant, as both lists that show the card do. */
async function actor() {
  const { user } = await authenticate();
  requireModule(user, "opportunities-finder");
  return { user };
}
async function requireAccess(page: string, kind: "read" | "edit") {
  if (!pageAccess(await dashboardRoles(), page)[kind])
    throw new AppError(
      "FORBIDDEN",
      "This action is not enabled for your account.",
      403,
    );
}
const opportunityRow = items(
  z.object({
    opportunities_id: z.number().int().positive(),
    opp_heading: z.string(),
    opportunity_status: z.string().nullish(),
    funders: text,
    deadline_date: text,
    closing_date: text,
    call: text,
    programme: text,
    activity_type: text,
    create_application_of_interest: text,
    create_outline_application: text,
    create_grant_application: text,
  }),
);
/** The opportunity as Oracle has it now: writes never trust the card's copy. */
async function readOpportunity(id: number) {
  const row = opportunityRow
    .parse(await opportunities.byId(id))
    .items.find((r) => r.opportunities_id === id);
  if (!row)
    throw new AppError("BAD_REQUEST", "The opportunity was not found.", 404);
  return row;
}
export async function setBookmark(raw: unknown) {
  const input = bookmarkInput.parse(raw);
  await actor();
  // Only an opportunity this user can read (the card's id is the browser's word).
  await readOpportunity(input.opportunityId);
  await (input.bookmarked ? opportunities.bookmark : opportunities.unbookmark)({
    opportunityId: input.opportunityId,
  });
  return { bookmarked: input.bookmarked };
}
export async function saveNotes(raw: unknown) {
  const input = notesInput.parse(raw);
  await actor();
  await afterCheck(
    requireAccess("opportunity-notes", "edit"),
    readOpportunity(input.opportunityId),
  );
  const notes = sanitizeHtml(input.notes);
  await opportunities.saveNotes({ opportunityId: input.opportunityId, notes });
  return { notes };
}
const SHARE_TEXTS = {
  title: ["dialog-titles", "share-opportunity-with", "Share opportunity with"],
  sendTo: ["labels", "send-to", "Send To"],
  sendToValue: ["labels", "send-to-value", "Send To Value"],
  fullName: ["labels", "full-name", "Full Name"],
  comment: ["labels", "share-comment", "Comment (optional)"],
  commentHelp: [
    "labels",
    "share-comment-help",
    "Included in the notification email to recipients.",
  ],
  share: ["button-labels", "share", "Share"],
  cancel: ["button-labels", "cancel", "Cancel"],
  sendToRequired: ["validation", "send-to-required", "Send To is required"],
  sendToValueRequired: [
    "validation",
    "send-to-value-required",
    "Send To Value is required",
  ],
  fullNameRequired: [
    "validation",
    "full-name-required",
    "At least one person is required",
  ],
  tooLong: [
    "warning-messages",
    "share-comment-too-long",
    "Comment cannot exceed {num} characters",
  ],
  truncated: [
    "warning-messages",
    "share-comment-truncated",
    "Pasted text was trimmed to the {num} character limit",
  ],
} as const;
function shareLimit(rows: Awaited<ReturnType<typeof resources>>) {
  return (
    resourcePreference(
      rows,
      SHARE_BUNDLE,
      "labels",
      "share-comment",
      "maxLength",
    ) ?? DEFAULT_MAX_COMMENT
  );
}
/** The 8516 dialog always reads the opportunities-eoi bundle, wherever it opens. */
export async function shareDialog() {
  await actor();
  const rows = await resources();
  const maxLength = shareLimit(rows);
  return {
    maxLength,
    texts: Object.fromEntries(
      Object.entries(SHARE_TEXTS).map(([key, [group, name, fallback]]) => [
        key,
        label(rows, SHARE_BUNDLE, group, name, fallback).replaceAll(
          "{num}",
          String(maxLength),
        ),
      ]),
    ) as Record<keyof typeof SHARE_TEXTS, string>,
  };
}
const people = items(
  z.object({
    person_id: numeric,
    full_name: z.string(),
    org_unit_name: text,
    employee_number: text,
  }),
);
const groupsAndRoles = items(
  z.object({ value: z.string(), description: text }),
);
/** Share recipients: roles or groups (getGroupsAndRoles), or everyone (getPersonListAll), as the original lists them. */
export async function shareValues(type: string) {
  await actor();
  if (type === "INDIVIDUAL") {
    const [all, rows] = await Promise.all([peopleApi.all(), resources()]);
    const withNumber = resourceVisible(
      rows,
      SHARE_BUNDLE,
      "labels",
      "share-person-emp-number",
    );
    // Live's oj-select-many rows: the name, then "org unit (employee number)" beneath it.
    return people.parse({ items: all }).items.map((p) => ({
      value: String(p.person_id),
      label: p.full_name,
      detail: [
        p.org_unit_name ?? "",
        withNumber && p.employee_number ? `(${p.employee_number})` : "",
      ]
        .filter(Boolean)
        .join(" "),
    }));
  }
  if (type !== "ROLE" && type !== "GROUP")
    throw new AppError("BAD_REQUEST", "Unknown share recipient type.", 400);
  return groupsAndRoles
    .parse(await lookups.groupsAndRoles({ shareTo: type }))
    .items.map((v) => ({ value: v.value, label: v.description || v.value }));
}
export async function share(raw: unknown) {
  const input = shareInput.parse(raw);
  await actor();
  // Settled only after the comment check below, which still fails first.
  const recipients = shareValues(input.sendTo),
    opportunity = readOpportunity(input.opportunityId);
  recipients.catch(() => undefined);
  opportunity.catch(() => undefined);
  const limit = shareLimit(await resources());
  if (input.comment.trim().length > limit)
    throw new AppError(
      "BAD_REQUEST",
      `Comment cannot exceed ${limit} characters`,
      400,
    );
  // Recipients must be ones the dialog offered.
  const offered = new Set((await recipients).map((v) => v.value));
  const chosen =
    input.sendTo === "INDIVIDUAL"
      ? input.personIds.map(String)
      : [input.sendToValue];
  if (chosen.some((v) => !offered.has(v)))
    throw new AppError("BAD_REQUEST", "Unknown share recipient.", 400);
  await opportunity;
  await opportunities.share({ body: sharePayload(input) });
  return { shared: true };
}
/**
 * Apply: checks the gates and returns the new application's page. Nothing is created here: the request is inserted
 * only on the form's Create, once its answers validate (an empty request could never be filled in).
 */
export async function apply(raw: unknown) {
  const input = applyInput.parse(raw);
  await actor();
  const o = await afterCheck(
    requireAccess("apply-opportunities", "read"),
    readOpportunity(input.opportunityId),
  );
  if (
    o.create_application_of_interest !== "Y" ||
    !canCreate(o.opportunity_status ?? "")
  )
    throw new AppError(
      "FORBIDDEN",
      "Applications are not open for this opportunity.",
      403,
    );
  return {
    href: `/opportunities/eoi/new/${o.opportunities_id}/${input.tab}`,
  };
}
const accessFor = (kind: ConvertKind) =>
  kind === "PROPOSAL"
    ? "convert-opportunity-to-proposal"
    : "convert-opportunity";
const flagFor = (kind: ConvertKind) =>
  kind === "PROPOSAL"
    ? "create_grant_application"
    : "create_outline_application";
async function convertible(kind: ConvertKind, id: number) {
  const o = await afterCheck(
    requireAccess(accessFor(kind), "read"),
    readOpportunity(id),
  );
  if (o[flagFor(kind)] !== "Y" || !canCreate(o.opportunity_status ?? ""))
    throw new AppError(
      "FORBIDDEN",
      "This opportunity cannot be converted.",
      403,
    );
  return o;
}
/**
 * Who converts what: from a card, the finder's module and the opportunity's own gates; from the EOI record
 * (`requestId`), an approved application with the record role, converting the opportunity it applied to.
 */
async function convertSource(
  kind: ConvertKind,
  opportunityId: number,
  requestId: number | undefined,
) {
  if (requestId === undefined) {
    const { user } = await actor();
    return { user, o: await convertible(kind, opportunityId) };
  }
  const sourceRead = eoiConvertSource(String(requestId), kind).then(
    (source) => {
      if (source.opportunityId !== opportunityId)
        throw new AppError(
          "BAD_REQUEST",
          "The opportunity is not the application's.",
          400,
        );
      return source;
    },
  );
  const [source, o] = await Promise.all([
    sourceRead,
    afterCheck(sourceRead, readOpportunity(opportunityId)),
  ]);
  return { user: source.user, o };
}
const personRows = items(
  z.object({
    person_id: numeric,
    full_name: z.string(),
    employee_number: text,
    org_unit_id: z.coerce.number().int().nullish(),
    org_unit_name: text,
    is_pi_flag: z.union([z.string(), z.boolean()]).nullish(),
  }),
);
/** Only people flagged as PIs can lead a proposal (the app-level list of the user's first org unit). */
async function principalInvestigators() {
  const [first] = await organizations();
  if (!first)
    throw new AppError(
      "FORBIDDEN",
      "No organisation is assigned to this user.",
      403,
    );
  return personRows
    .parse(await peopleApi.inOrg({ orgId: first.id }))
    .items.filter((p) => String(p.is_pi_flag) === "true");
}
/** The PI's org units (VBCS fetchOrgUnitsData), each name indented by its depth. */
async function orgUnitsFor(personId: number) {
  const raw = z
    .object({ items: z.array(z.record(z.string(), z.unknown())) })
    .parse(await lookups.orgUnits({ personId: String(personId) }));
  return raw.items.flatMap((row) => {
    const r = Object.fromEntries(
      Object.entries(row).map(([k, v]) => [k.toLowerCase(), v]),
    );
    const id = Number(r.org_unit_id);
    if (
      !Number.isSafeInteger(id) ||
      id <= 0 ||
      typeof r.org_unit_name !== "string"
    )
      return [];
    const depth = Math.max(0, Number(r.num_spaces) || 0);
    return [{ id, name: " ".repeat(depth) + r.org_unit_name }];
  });
}
const sponsorRows = items(
  z.object({ sponsor_party_id: numeric, party_name: z.string() }),
);
async function sponsors() {
  return sponsorRows
    .parse(await lookups.sponsors())
    .items.map((s) => ({ id: s.sponsor_party_id, name: s.party_name }));
}
const lookupRows = items(
  z.object({
    lookup_type_code: text,
    lookup_code: z.string(),
    lookup_code_value: text,
    lookup_code_descr: text,
  }),
);
/** ACTIVITY_TYPE and PROPOSAL_STAGE, listed by description as the finder's dialog does. */
async function convertLookups() {
  const rows = lookupRows.parse(
    await lookups.codes({ types: "ACTIVITY_TYPE,PROPOSAL_STAGE" }),
  ).items;
  const of = (type: string) =>
    rows
      .filter((r) => r.lookup_type_code === type)
      .map((r) => ({
        value: r.lookup_code,
        label: r.lookup_code_descr || r.lookup_code_value || r.lookup_code,
      }));
  return { activities: of("ACTIVITY_TYPE"), stages: of("PROPOSAL_STAGE") };
}
function convertTexts(
  rows: Awaited<ReturnType<typeof resources>>,
  opener: Opener,
  kind: ConvertKind,
  application = false,
) {
  const t = (group: string, key: string, fallback: string) =>
    label(rows, bundleOf(opener), group, key, fallback);
  const title = application
    ? kind === "PROPOSAL"
      ? t(
          "dialog-titles",
          "eoi-convert-to-full-proposal",
          "Convert to Full Proposal",
        )
      : t("dialog-titles", "eoi-convert-to-outline", "Convert to Outline")
    : kind === "PROPOSAL"
      ? t("dialog-titles", "convert-to-proposal", "Convert to Proposal")
      : t("dialog-titles", "convert-to-outline", "Convert to Outline Proposal");
  return {
    title,
    cancel: t("button-labels", "cancel", "Cancel"),
    create: t("button-labels", "create", "Create"),
    yes: t("option-keys", "yes", "Yes"),
    no: t("option-keys", "no", "No"),
    required: t(
      "error-msg",
      "required-fields",
      "Please fill all the required fields",
    ),
    warningTitle: t("dialog-titles", "warning", "Warning"),
    funderWarning: t(
      "warning-messages",
      "funder-warning",
      "The selected funder differs from the opportunity funder. Continue?",
    ),
  };
}
/** Everything the convert dialog shows, prefilled as the original: the user as PI when they are one, the auto-matched sponsor. */
export async function convertDialog(params: URLSearchParams) {
  const { opener, kind, opportunityId, requestId } = z
    .object({
      opener: z.enum(["finder", "dashboard"]),
      kind: z.enum(["OUTLINE_PROPOSAL", "PROPOSAL"]),
      opportunityId: z.coerce.number().int().positive(),
      requestId: z.coerce.number().int().positive().optional(),
    })
    .parse(Object.fromEntries(params));
  // The reference reads need only the session, so they run alongside the access check and opportunity read.
  const { user } = await authenticate();
  const source = convertSource(kind, opportunityId, requestId);
  const piList = principalInvestigators();
  const mine = piList.then((pis) =>
    pis.find((p) => String(p.person_id) === user.personId),
  );
  // The defaulted PI's org units are preloaded, so its org unit is never posted as 0 (pitfall 4).
  const units = mine.then((me) => (me ? orgUnitsFor(me.person_id) : []));
  const [rows, pis, me, orgUnits, funders, lookups, formatting] =
    await afterCheck(
      source,
      Promise.all([
        resources(),
        piList,
        mine,
        units,
        sponsors(),
        convertLookups(),
        formattingConfiguration(),
      ]),
    );
  const { o } = await source;
  const application = requestId !== undefined;
  const matched = matchSponsor(funders, splitFunders(o.funders)[0]);
  const defaultUnit =
    orgUnits.find((u) => u.id === me?.org_unit_id) ?? orgUnits[0];
  return {
    texts: convertTexts(rows, opener, kind, application),
    gates: convertGates(rows, opener, kind, application),
    decimals: formatting.decimals ?? 2,
    heading: o.opp_heading,
    pis: pis.map((p) => ({
      value: String(p.person_id),
      label: p.full_name,
      detail: p.org_unit_name ?? "",
      employeeNumber: p.employee_number ?? "",
      orgUnitId: p.org_unit_id ? String(p.org_unit_id) : "",
    })),
    sponsors: funders.map((s) => ({ value: String(s.id), label: s.name })),
    activities: lookups.activities,
    stages: lookups.stages,
    initial: {
      piId: me ? String(me.person_id) : "",
      orgUnits: orgUnits.map((u) => ({ value: String(u.id), label: u.name })),
      orgUnitId: defaultUnit ? String(defaultUnit.id) : "",
      sponsorId: matched ? String(matched.id) : "",
      activityType: lookups.activities.some((a) => a.value === o.activity_type)
        ? (o.activity_type ?? "")
        : "",
    },
  };
}
/** A PI's org units, for the dialog; only for someone the PI list offers. */
export async function orgUnitChoices(personId: string) {
  const id = numeric.parse(personId);
  await actor();
  if (!(await principalInvestigators()).some((p) => p.person_id === id))
    throw new AppError("BAD_REQUEST", "Unknown principal investigator.", 400);
  return (await orgUnitsFor(id)).map((u) => ({
    value: String(u.id),
    label: u.name,
  }));
}
/**
 * Creates the outline or full proposal, then seeds its summary dynamic form as PROPOSALS-SUMMARY (for both kinds;
 * the VBCS full-proposal "PROPOSAL-SUMMARY" disagreed with the summary page). Identity, title and deadlines are
 * the server's, never the browser's.
 */
export async function convert(raw: unknown) {
  const input = convertInput.parse(raw);
  const { user, o } = await convertSource(
    input.kind,
    input.opportunityId,
    input.requestId,
  );
  const application = input.requestId !== undefined;
  // Settled only after the required-field checks below, which still fail first.
  const offered = Promise.all([
    principalInvestigators(),
    sponsors(),
    convertLookups(),
    formattingConfiguration(),
  ]);
  offered.catch(() => undefined);
  const rows = await resources();
  const gates = convertGates(rows, input.opener, input.kind, application);
  const empty = (v: unknown) => v === null || v === "";
  const missing = (
    [
      ["full-name", input.piId],
      ["org-unit", input.orgUnitId],
      ["activity-type", input.activityType],
      ["start-date", input.start],
      ["end-date", input.end],
      ["primary-sponsor", input.sponsorId],
      ["stage", input.stage],
    ] as const
  ).some(([f, v]) => gates[f].required && empty(v));
  if (missing)
    throw new AppError(
      "BAD_REQUEST",
      convertTexts(rows, input.opener, input.kind, application).required,
      400,
    );
  if (input.start && input.end && input.end < input.start)
    throw new AppError(
      "BAD_REQUEST",
      "End date cannot be before start date.",
      400,
    );
  const [pis, funders, lookups, formatting] = await offered;
  const pi =
    input.piId === null ? null : pis.find((p) => p.person_id === input.piId);
  const units = pi ? await orgUnitsFor(pi.person_id) : [];
  const unknown =
    pi === undefined ||
    (input.orgUnitId !== null &&
      !units.some((u) => u.id === input.orgUnitId)) ||
    (input.sponsorId !== null &&
      !funders.some((s) => s.id === input.sponsorId)) ||
    (input.activityType !== null &&
      !lookups.activities.some((a) => a.value === input.activityType)) ||
    (input.stage !== null &&
      !lookups.stages.some((s) => s.value === input.stage));
  if (unknown)
    throw new AppError("BAD_REQUEST", "A chosen value is not offered.", 400);
  const created = z
    .object({
      proposal: numeric.optional(),
      Prop_id: z.union([z.number(), z.string()]).nullish(),
    })
    .parse(
      await opportunities.createProposal({
        body: proposalPayload({
          kind: input.kind,
          opportunity: {
            id: o.opportunities_id,
            heading: o.opp_heading,
            deadline: o.deadline_date,
            closing: o.closing_date,
            call: o.call,
            programme: o.programme,
          },
          pi: pi
            ? {
                personId: pi.person_id,
                employeeNumber: pi.employee_number ?? null,
                orgUnitId: input.orgUnitId,
              }
            : null,
          activityType: input.activityType,
          stage: input.stage,
          start: input.start,
          end: input.end,
          sponsorId: input.sponsorId,
          confidential: input.confidential,
          createdBy: Number(user.personId),
          currency: formatting.currency ?? null,
          requestId: input.requestId,
        }),
      }),
    );
  if (created.proposal === undefined)
    throw new AppError("CONTRACT", "The proposal was not created.");
  const proposalId = created.proposal;
  // The finder opens the proposal by Prop_id; any non-numeric value falls back to the created id.
  const openId = /^[1-9]\d{0,14}$/.test(String(created.Prop_id ?? ""))
    ? String(created.Prop_id)
    : String(proposalId);
  let seedError: string | undefined;
  // The EOI record's convert seeds no summary form (CreateProposalAction); only the opportunity converts do.
  if (!application)
    try {
      const forms = dynFormsSchema.parse(
        await dynamicForm.forms({
          objectId: String(proposalId),
          objectType: input.kind,
          slot: "PROPOSALS-SUMMARY",
        }),
      );
      if (forms.length > 0)
        await dynamicForm.save({
          formId: forms[0].formId,
          objectId: String(proposalId),
          slot: "PROPOSALS-SUMMARY",
          body: defaultFormResponse(forms),
        });
    } catch (e) {
      // The proposal exists: report the seed failure instead of inviting a second convert.
      seedError =
        e instanceof AppError
          ? e.message
          : "The proposal summary form could not be prepared.";
    }
  return {
    href: `/proposals/${input.kind}/${openId}`,
    message: label(
      rows,
      input.kind.toLowerCase(),
      "success-msg",
      "created",
      "Proposal Created Successfully",
    ),
    ...(seedError ? { seedError } : {}),
  };
}
