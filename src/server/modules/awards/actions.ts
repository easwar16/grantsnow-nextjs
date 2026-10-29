import "server-only";
import { cache } from "react";
import { z } from "zod";
import uniqBy from "lodash/uniqBy";
import { authenticate } from "@/server/identity/session/service";
import { attributes, awards, lookups, people } from "@/server/oracle/api";
import {
  resources,
  type Resources,
} from "@/server/platform/configuration/resources";
import { dashboardRoles } from "@/server/platform/configuration/service";
import { linkedObjects } from "@/server/record/linked/linked";
import { AppError } from "@/lib/errors";
import { memo, memoKey } from "@/server/oracle/cache";
import { fixtureMode } from "@/server/platform/configuration/environment";
import {
  AWARD_OPERATORS,
  type AwardCondition,
} from "@/features/modules/awards/listing/schema";
import type {
  AwardActionGates,
  AwardAttribute,
  CreateAwardField,
  CreateAwardSetup,
} from "@/features/modules/awards/listing/actions";
import { serverConstants } from "@/server/constants";
import { serverFunctions } from "@/server/functions";

const BUNDLE = "award";
const DRAWER = "awards";
const numeric = z.coerce.number().int().positive();
const text = z.string().nullish();
const items = <T extends z.ZodTypeAny>(row: T) =>
  z.object({ items: z.array(row) });

/** The listing's action gates: RB everywhere, and Clone also needs the `award-clone` role (legacy dashboard_access). */
export function awardActionGates(
  rows: Resources,
  roles: Parameters<typeof serverFunctions.permissions.pageAccess>[0],
): AwardActionGates {
  const button = (key: string) =>
    serverFunctions.resources.resourceVisible(
      rows,
      BUNDLE,
      "button-labels",
      key,
    );
  return {
    create: button("create-award"),
    link: button("list-link"),
    clone:
      button("list-clone") &&
      button("clone") &&
      serverFunctions.permissions.pageAccess(roles, "award-clone").read,
    advanced: button("advanced-query"),
  };
}
async function actor() {
  const { user } = await authenticate();
  serverFunctions.permissions.requireDrawerAccess(user, DRAWER);
  const [rows, roles] = await Promise.all([resources(), dashboardRoles()]);
  return { user, rows, gates: awardActionGates(rows, roles) };
}
function requireGate(open: boolean) {
  if (!open)
    throw new AppError(
      "FORBIDDEN",
      "This action is not enabled for your account.",
      403,
    );
}

const awardRow = items(
  z.object({
    award_id: numeric,
    proposal_id: z.union([z.number(), z.string()]).nullish(),
  }),
);
/** The award as the listing shows it to this user (AwardHeader by id); one the user cannot list does not exist. */
async function visibleAward(awardId: number) {
  const row = awardRow.parse(
    await awards.list({
      query: {
        p_offset: "0",
        p_limit: "1",
        p_where_clause: `("award_id"='${awardId}')`,
      },
    }),
  ).items[0];
  if (!row) throw new AppError("BAD_REQUEST", "The award was not found.", 404);
  const proposalId = Number(row.proposal_id);
  return {
    awardId: row.award_id,
    proposalId:
      Number.isSafeInteger(proposalId) && proposalId > 0 ? proposalId : null,
  };
}

// ── Create ───────────────────────────────────────────────────────────────────

/** The create dialog's fields in legacy order (awards-start-page.html dialogCreateAward), each RB-gated. */
const CREATE_FIELDS: [CreateAwardField, string, string][] = [
  ["proposal", "award-proposal", "Proposal"],
  ["pi", "award-pi-name", "Principal Investigator Name"],
  ["org", "award-org-unit", "Org Unit"],
  ["sponsor", "award-sponsor", "Sponsor"],
  ["fullTitle", "award-full-title", "Full Title"],
  ["name", "award-name", "Award Name"],
  ["start", "award-start-date", "Award Start Date"],
  ["end", "award-end-date", "Award End Date"],
  ["amount", "award-amount", "Award Amount"],
  ["currency", "award-currency", "Currency"],
  ["period", "award-period", "Period"],
];
function createFields(rows: Resources) {
  return Object.fromEntries(
    CREATE_FIELDS.map(([field, key, fallback]) => [
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
      },
    ]),
  ) as CreateAwardSetup["fields"];
}

const proposalRows = items(
  z.object({
    object_id: numeric,
    object_number: text,
    object_title: text,
  }),
);
const personRows = items(
  z.object({
    person_id: numeric,
    full_name: z.string(),
    org_unit_name: text,
    org_unit_id: z.union([z.number(), z.string()]).nullish(),
  }),
);
const sponsorRows = items(
  z.object({ sponsor_party_id: numeric, party_name: z.string() }),
);
const currencyRows = items(
  z.object({
    lookup_type_code: text,
    lookup_code: z.string(),
    lookup_code_descr: text,
  }),
);
/** The dialog's lists: proposals open for an award, everyone (legacy app-level getPersonList), funders, currencies. */
const createLists = cache(async () => {
  const [proposals, persons, sponsors, currencies] = await Promise.all([
    awards.proposals().then((raw) => proposalRows.parse(raw).items),
    people.inOrg({}).then((raw) => personRows.parse(raw).items),
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
  return { proposals, persons, sponsors, currencies };
});

export async function createSetup(): Promise<CreateAwardSetup> {
  const { rows, gates } = await actor();
  requireGate(gates.create);
  const lists = await createLists();
  const t = (group: string, key: string, fallback: string) =>
    serverFunctions.resources.label(rows, BUNDLE, group, key, fallback);
  return {
    fields: createFields(rows),
    texts: {
      title: t("dialog-titles", "create-award", "Create New Award"),
      // Legacy's Save reads the opportunities-eoi bundle's Create.
      create: serverFunctions.resources.label(
        rows,
        "opportunities-eoi",
        "button-labels",
        "create",
        "Create",
      ),
      required: t(
        "error-msg",
        "required-fields",
        "Please fill all the required fields",
      ),
      created: t("success-msg", "created", "Created"),
    },
    proposals: lists.proposals.map((p) => ({
      value: String(p.object_id),
      label: p.object_number ?? String(p.object_id),
      detail: p.object_title ?? "",
    })),
    // A person can repeat per org unit; the save takes the first row's org, so the list offers that one.
    pis: uniqBy(lists.persons, (p) => p.person_id).map((p) => ({
      value: String(p.person_id),
      label: p.full_name,
      detail: p.org_unit_name ?? "",
      orgUnitId:
        p.org_unit_id === null || p.org_unit_id === undefined
          ? ""
          : String(p.org_unit_id),
      orgUnitName: p.org_unit_name ?? "",
    })),
    sponsors: lists.sponsors.map((s) => ({
      value: String(s.sponsor_party_id),
      label: s.party_name,
    })),
    currencies: lists.currencies.map((c) => ({
      value: c.lookup_code,
      label: c.lookup_code_descr || c.lookup_code,
    })),
  };
}

const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const createInput = z
  .object({
    proposalId: numeric.nullable(),
    piId: numeric.nullable(),
    sponsorId: numeric.nullable(),
    fullTitle: z.string().max(4000),
    name: z.string().max(4000),
    start: day.or(z.literal("")),
    end: day.or(z.literal("")),
    amount: z.number().finite().nullable(),
    currency: z.string().max(10),
    period: z.number().finite().nullable(),
  })
  .strict();

/**
 * Creates an award (legacy createAward). With a proposal that has no award yet, the backend generates the primary award
 * from it (GenerateAward, from the proposal alone, as legacy); otherwise the header is posted. The org unit is the
 * chosen PI's (read-only in the dialog), never the browser's.
 */
export async function createAward(raw: unknown) {
  const input = createInput.parse(raw);
  const { rows, gates } = await actor();
  requireGate(gates.create);
  const fields = createFields(rows);
  const lists = await createLists();
  const pi =
    input.piId === null
      ? null
      : lists.persons.find((p) => p.person_id === input.piId);
  const value = {
    proposal: input.proposalId,
    pi: input.piId,
    org: pi?.org_unit_id ?? null,
    sponsor: input.sponsorId,
    fullTitle: input.fullTitle.trim(),
    name: input.name.trim(),
    start: input.start,
    end: input.end,
    amount: input.amount,
    currency: input.currency,
    period: input.period,
  };
  const missing = CREATE_FIELDS.some(
    ([f]) =>
      fields[f].show &&
      fields[f].required &&
      (value[f] === null || value[f] === ""),
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
  const tooLong = (["fullTitle", "name"] as const).some(
    (f) => (fields[f].maxLength ?? Infinity) < value[f].length,
  );
  if (tooLong)
    throw new AppError("BAD_REQUEST", "A field is longer than allowed.", 400);
  if (input.start && input.end && input.end < input.start)
    throw new AppError(
      "BAD_REQUEST",
      "End date cannot be before start date.",
      400,
    );
  const unknown =
    pi === undefined ||
    (input.proposalId !== null &&
      !lists.proposals.some((p) => p.object_id === input.proposalId)) ||
    (input.sponsorId !== null &&
      !lists.sponsors.some((s) => s.sponsor_party_id === input.sponsorId)) ||
    (input.currency !== "" &&
      !lists.currencies.some((c) => c.lookup_code === input.currency));
  if (unknown)
    throw new AppError("BAD_REQUEST", "A chosen value is not offered.", 400);
  if (input.proposalId !== null) {
    const made = z
      .object({ count: z.coerce.number().nullish() })
      .parse(await awards.hierarchy({ proposalId: input.proposalId }));
    if (!((made.count ?? 0) > 0)) {
      await awards.generate({ proposalId: input.proposalId });
      return { created: true };
    }
  }
  // Legacy preparePayload; empty values are left out, as legacy's undefined ones were.
  const body = Object.fromEntries(
    Object.entries({
      AwardAmount: value.amount,
      AwardEndDate: value.end,
      AwardName: value.name,
      AwardStartDate: value.start,
      Currency: value.currency,
      FullTitle: value.fullTitle,
      OrgID: value.org === null ? null : Number(value.org),
      Period: value.period,
      PIPID: value.pi,
      ProposalID: value.proposal,
      SponsorId: value.sponsor,
    }).filter(([, v]) => v !== null && v !== ""),
  );
  await awards.create({ body });
  return { created: true };
}

// ── Clone ────────────────────────────────────────────────────────────────────

const copyRows = items(
  z.object({
    r: z.string().min(1),
    d: text,
    parent_object: text,
    default_value: z.union([z.boolean(), z.string()]).nullish(),
  }),
);
const cloneParts = cache(
  async () => copyRows.parse(await awards.copyObjects()).items,
);

/** The parts Clone can copy, with legacy's tree (`parent_object`) and the parts always copied (`default_value`). */
export async function cloneSetup(params: URLSearchParams) {
  const awardId = numeric.parse(params.get("awardId"));
  const { rows, gates } = await actor();
  requireGate(gates.clone);
  const [parts] = await Promise.all([cloneParts(), visibleAward(awardId)]);
  const t = (group: string, key: string, fallback: string) =>
    serverFunctions.resources.label(rows, BUNDLE, group, key, fallback);
  return {
    parts: parts.map((p) => ({
      value: p.r,
      label: p.d ?? p.r,
      parent: p.parent_object ?? null,
      fixed: p.default_value === true || p.default_value === "true",
    })),
    texts: {
      title: t("dialog-titles", "clone-award", "Clone Award"),
      entire: t("option-keys", "entire-award", "Entire Award"),
      cancel: t("button-labels", "cancel", "Cancel"),
      clone: t("button-labels", "clone", "Clone"),
    },
  };
}

const cloneInput = z
  .object({
    awardId: numeric,
    parts: z.array(z.string().min(1).max(100)).max(200),
  })
  .strict();
/** WRITES: clones an award with the chosen parts (legacy preparePayloadCopyAward), only parts the list offers. */
export async function cloneAward(raw: unknown) {
  const input = cloneInput.parse(raw);
  const { gates } = await actor();
  requireGate(gates.clone);
  const [parts] = await Promise.all([
    cloneParts(),
    visibleAward(input.awardId),
  ]);
  const offered = new Set(parts.map((p) => p.r));
  if (!input.parts.every((p) => offered.has(p)))
    throw new AppError("BAD_REQUEST", "A chosen part is not offered.", 400);
  const reply = z
    .object({ award_id: z.union([z.number(), z.string()]).nullish() })
    .passthrough()
    .parse(
      fixtureMode()
        ? (await import("@/test-support/awards-writes")).fixtureCopyAward()
        : await awards.copy({
            body: {
              award_id: input.awardId,
              objects: [...new Set(input.parts)].map((object_name) => ({
                object_name,
                object_val: "true",
              })),
            },
          }),
    );
  if (reply.award_id === null || reply.award_id === undefined)
    throw new AppError("CONTRACT", "The award was not cloned.");
  return { cloned: true };
}

// ── Link ─────────────────────────────────────────────────────────────────────

/** The award's linked records and, for an award with no proposal, the proposals it can be linked to. */
export async function awardLinks(params: URLSearchParams) {
  const awardId = numeric.parse(params.get("awardId"));
  const { rows, gates } = await actor();
  requireGate(gates.link);
  const award = await visibleAward(awardId);
  const [linked, lists] = await Promise.all([
    linkedObjects(
      { module: "AWARD", id: awardId },
      {
        bundle: BUNDLE,
        key: "no-linked-data-found",
        fallback: "No Linked Data Found",
      },
    ),
    award.proposalId === null ? createLists() : null,
  ]);
  return {
    ...linked,
    link:
      lists === null
        ? null
        : {
            label: serverFunctions.resources.label(
              rows,
              BUNDLE,
              "labels",
              "award-proposal",
              "Proposal",
            ),
            button: serverFunctions.resources.label(
              rows,
              BUNDLE,
              "button-labels",
              "link-object",
              "Link Object",
            ),
            proposals: lists.proposals.map((p) => ({
              value: String(p.object_id),
              label: p.object_number ?? String(p.object_id),
              detail: p.object_title ?? "",
            })),
          },
  };
}

const linkInput = z.object({ awardId: numeric, proposalId: numeric }).strict();
/** WRITES: links an award with no proposal to an offered one (legacy linkObject). */
export async function linkAward(raw: unknown) {
  const input = linkInput.parse(raw);
  const { gates } = await actor();
  requireGate(gates.link);
  const [award, lists] = await Promise.all([
    visibleAward(input.awardId),
    createLists(),
  ]);
  if (award.proposalId !== null)
    throw new AppError("BAD_REQUEST", "The award already has a proposal.", 400);
  if (!lists.proposals.some((p) => p.object_id === input.proposalId))
    throw new AppError("BAD_REQUEST", "That proposal is not offered.", 400);
  await awards.linkProposal({
    awardId: input.awardId,
    proposalId: input.proposalId,
  });
  return { linked: true };
}

// ── Advanced Query ───────────────────────────────────────────────────────────

const attributeFields = z.object({
  fields: z
    .array(z.object({ attributeName: text, description: text }))
    .nullish(),
});
const titleCase = (key: string) =>
  key
    .toLowerCase()
    .replace(/_/g, " ")
    .replace(/(?: |\b)(\w)/g, (m) => m.toUpperCase());
/**
 * Legacy getAttributes: every column of a one-row advanced-search probe, title-cased; `attribute_N` columns only when
 * the AWARD attribute set describes them. These columns are the only ones an Advanced Query may name.
 */
export const advancedAttributes = cache(async (): Promise<AwardAttribute[]> => {
  const { session } = await authenticate();
  // Held as the attribute definitions are (serverConstants.ttl.config): every filtered read checks its rows against these columns.
  return memo(
    memoKey("award-advanced-columns", session.token),
    serverConstants.ttl.config,
    () => probeAttributes(),
  );
});
async function probeAttributes(): Promise<AwardAttribute[]> {
  const [fieldsRaw, probe] = await Promise.all([
    attributes.fields({ objectType: "AWARD", objectId: "" }),
    awards.advancedSearch({ query: { p_offset: "0", p_limit: "1" } }),
  ]);
  const described = attributeFields.parse(fieldsRaw).fields ?? [];
  const first = z
    .object({ items: z.array(z.record(z.string(), z.unknown())) })
    .parse(probe).items[0];
  return Object.keys(first ?? {}).flatMap((key) => {
    if (!/^[A-Za-z][A-Za-z0-9_]{0,62}$/.test(key)) return [];
    if (!key.includes("attribute"))
      return [{ value: key, label: titleCase(key) }];
    const name = described.find((f) => f.attributeName === key)?.description;
    return name ? [{ value: key, label: name }] : [];
  });
}

export async function advancedSetup() {
  const { rows, gates } = await actor();
  requireGate(gates.advanced);
  const t = (group: string, key: string, fallback: string) =>
    serverFunctions.resources.label(rows, BUNDLE, group, key, fallback);
  return {
    attributes: await advancedAttributes(),
    operators: [
      { value: "$eq", label: "Equals (=)" },
      { value: "$co", label: "Contains (LIKE)" },
      { value: "$gt", label: "Greater than (>)" },
      { value: "$lt", label: "Less than (<)" },
      { value: "$ge", label: "Greater than or equals (>=)" },
      { value: "$le", label: "Less than or equals (<=)" },
    ] satisfies { value: (typeof AWARD_OPERATORS)[number]; label: string }[],
    texts: {
      title: t("button-labels", "advanced-query", "Advanced Query"),
      attribute: t("labels", "attribute", "Attribute"),
      operator: t("labels", "operator", "Operator"),
      value: t("labels", "value", "Value"),
      add: t("button-labels", "add-condition", "Add Condition"),
      edit: t("button-labels", "edit", "Edit"),
      remove: t("button-labels", "delete", "Delete"),
      save: t("button-labels", "save", "Save"),
      cancel: t("button-labels", "cancel", "Cancel"),
      close: t("button-labels", "close", "Close"),
      editTitle: t("dialog-titles", "edit-condition", "Edit Condition"),
    },
  };
}

/** Every condition names a column the probe offered; anything else is refused before SQL is built. */
export async function checkConditions(conditions: AwardCondition[]) {
  if (conditions.length === 0) return;
  const offered = new Set((await advancedAttributes()).map((a) => a.value));
  if (!conditions.every((c) => offered.has(c.attribute)))
    throw new AppError("BAD_REQUEST", "Unknown Advanced Query attribute.", 400);
}
