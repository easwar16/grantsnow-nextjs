import "server-only";
import { z } from "zod";
import { AppError } from "@/lib/errors";
import { authenticate } from "@/server/identity/session/service";
import { ethics, lookups, people } from "@/server/oracle/api";
import { resources } from "@/server/platform/configuration/resources";
import {
  dashboardRoles,
  organizations,
} from "@/server/platform/configuration/service";
import { serverFunctions } from "@/server/functions";
import { containsClause } from "@/server/oracle/where";
import { ethicsAccess } from "@/server/modules/home/ethics-access";
import type { EthicsFilters } from "@/features/modules/ethics/listing/schema";

const ACCESS = ["EA_ACCESS", "RESPONDENT_ACCESS", "APPROVER_ACCESS"] as const;
type Access = (typeof ACCESS)[number];
const roleFor: Record<Access, string> = {
  EA_ACCESS: "ethics-administration",
  RESPONDENT_ACCESS: "ethics-participent-view",
  APPROVER_ACCESS: "ethics-approver-view",
};

const optional = z.union([z.string(), z.number()]).nullish();
const row = z.object({
  setup_flow_id: z.coerce.number().int().positive(),
  application_number: z.string(),
  setup_description: z.string().nullish(),
  access_type: z.string().nullish(),
  status_lkp_code: z.string().nullish(),
  status: z.string().nullish(),
  response_status: z.string().nullish(),
  risk_code: z.string().nullish(),
  risk_desc: z.string().nullish(),
  created_by: z.string().nullish(),
  last_updated_by: z.string().nullish(),
  creation_date: z.string().nullish(),
  last_update_date: z.string().nullish(),
  deadline_date: z.string().nullish(),
  expiry_date: z.string().nullish(),
  ethics_type: z.string().nullish(),
  ethics_form_type: z.string().nullish(),
  org_unit_name: z.string().nullish(),
  reviewer_name: z.string().nullish(),
  person_id: optional,
  org_unit_id: optional,
  my_approval: z.string().nullish(),
});
const body = z.object({
  items: z.array(row),
  hasMore: z.union([z.boolean(), z.string()]).optional(),
});
export type EthicsRow = ReturnType<typeof mapRow>;
const value = (s: string | null | undefined) => s ?? "";
const mapRow = (r: z.infer<typeof row>) => ({
  id: String(r.setup_flow_id),
  number: r.application_number,
  title: value(r.setup_description),
  access: value(r.access_type),
  status: value(r.status),
  statusCode: value(r.status_lkp_code),
  responseStatus: value(r.response_status),
  risk: value(r.risk_desc),
  riskCode: value(r.risk_code),
  createdBy: value(r.created_by),
  updatedBy: value(r.last_updated_by),
  created: value(r.creation_date),
  updated: value(r.last_update_date),
  deadline: value(r.deadline_date),
  expiry: value(r.expiry_date),
  ethicsType: value(r.ethics_type),
  formType: value(r.ethics_form_type),
  org: value(r.org_unit_name),
  reviewer: value(r.reviewer_name),
  currentApprover: r.my_approval === "Y",
});

const filterKeys = {
  number: "list-ethics-number",
  createdBy: "list-created-by",
  type: "list-ethics-type",
  responseStatus: "list-response-status",
  formType: "list-form-type",
  org: "list-org-unit",
  title: "list-title",
  risk: "list-risk",
  sort: "list-date-sort",
  created: "list-creation-date",
  deadline: "list-deadline-date",
  expiry: "list-expiry-date",
} as const;
const fieldKeys = {
  createdBy: "list-created-by",
  updatedBy: "list-last-updated-by",
  created: "list-creation-date",
  updated: "list-last-updated-date",
  deadline: "list-deadline-date",
  expiry: "list-expiry-date",
  ethicsType: "list-ethics-type",
  formType: "list-form-type",
  org: "list-org-unit",
  reviewer: "list-supervisor-name",
} as const;
const label = (
  rows: Awaited<ReturnType<typeof resources>>,
  group: string,
  key: string,
  fallback: string,
) => serverFunctions.resources.label(rows, "ethics", group, key, fallback);
const visible = (
  rows: Awaited<ReturnType<typeof resources>>,
  group: string,
  key: string,
) => serverFunctions.resources.resourceVisible(rows, "ethics", group, key);

/** The three legacy access tabs are role-gated; no granted tab means no listing read. */
export async function ethicsListView() {
  const { user } = await authenticate();
  serverFunctions.permissions.requireModule(user, "ETHICS");
  const [roles, bundle, approver] = await Promise.all([
    dashboardRoles(),
    resources(),
    ethicsAccess().catch(() => false),
  ]);
  const tabs = ACCESS.filter((access) =>
    access === "APPROVER_ACCESS"
      ? approver
      : serverFunctions.permissions.pageAccess(roles, roleFor[access]).read,
  ).map((access) => ({
    value: access,
    label: label(
      bundle,
      "option-keys",
      {
        EA_ACCESS: "admin-view",
        RESPONDENT_ACCESS: "participant-view",
        APPROVER_ACCESS: "approver-view",
      }[access],
      access,
    ),
  }));
  const gates = Object.fromEntries(
    Object.entries(filterKeys).map(([key, name]) => [
      key,
      visible(bundle, "labels", name),
    ]),
  ) as Record<keyof typeof filterKeys, boolean>;
  const fields = Object.fromEntries(
    Object.entries(fieldKeys).map(([key, name]) => [
      key,
      visible(bundle, "labels", name),
    ]),
  ) as Record<keyof typeof fieldKeys, boolean>;
  const texts = Object.fromEntries(
    Object.entries({ ...filterKeys, ...fieldKeys }).map(([key, name]) => [
      key,
      label(
        bundle,
        "labels",
        name,
        key === "responseStatus" ? "Response Status" : key,
      ),
    ]),
  ) as Record<keyof typeof filterKeys | keyof typeof fieldKeys, string>;
  return {
    tabs,
    gates,
    fields,
    texts,
    actions: {
      create: serverFunctions.permissions.pageAccess(
        roles,
        "create-ethics-application",
      ).read,
      recycle: serverFunctions.permissions.pageAccess(
        roles,
        "ethics-recycle-bin",
      ).read,
      view: visible(bundle, "button-labels", "list-view-record"),
      link: visible(bundle, "button-labels", "list-link"),
      clone:
        visible(bundle, "button-labels", "list-clone") &&
        serverFunctions.permissions.pageAccess(roles, "ethics-clone").read,
      delete:
        visible(bundle, "button-labels", "list-delete") &&
        serverFunctions.permissions.pageDeleteAccess(
          roles,
          "ethics-listing-delete",
        ),
    },
    labels: {
      create: label(
        bundle,
        "button-labels",
        "new-ethics-application",
        "New Ethics Application",
      ),
      recycle: label(bundle, "button-labels", "recycle-bin", "Recycle bin"),
      clear: label(bundle, "button-labels", "clear", "Clear"),
      total: label(bundle, "labels", "total-count", "Total"),
    },
  };
}
export type EthicsListView = Awaited<ReturnType<typeof ethicsListView>>;

const literal = (v: string) => `'${v.replaceAll("'", "''")}'`;
/** Legacy getCriterion through services/transforms.js: only configured, visible filters reach Oracle. */
export function ethicsWhereClause(
  f: EthicsFilters,
  gates: EthicsListView["gates"],
) {
  const columns: [
    keyof typeof filterKeys,
    string,
    "$eq" | "$co" | "$ge" | "$le",
  ][] = [
    ["org", "org_unit_id", "$eq"],
    ["formType", "ethics_form_type_code", "$eq"],
    ["number", "application_number", "$co"],
    ["responseStatus", "response_status_lkp_code", "$co"],
    ["createdBy", "person_id", "$eq"],
    ["title", "setup_description", "$co"],
    ["risk", "risk_code", "$co"],
    ["type", "ethics_type_code", "$eq"],
    ["expiry", "expiry_date", "$eq"],
    ["created", "creation_date", "$ge"],
    ["deadline", "deadline_date", "$le"],
  ];
  const parts = [f.status ? `"status_lkp_code"=${literal(f.status)}` : ""];
  for (const [key, column, op] of columns) {
    const v = f[key];
    if (!gates[key] || !v) continue;
    if (op === "$co") parts.push(containsClause(`"${column}"`, v));
    else
      parts.push(
        `"${column}"${{ $eq: "=", $ge: ">=", $le: "<=" }[op]}${literal(/^(created|deadline|expiry)$/.test(key) ? `${v} ${op === "$le" ? "23:59:59" : "00:00:00"}` : v)}`,
      );
  }
  const active = parts.filter(Boolean);
  return active.length ? `(${active.join(" AND ")})` : "";
}

export async function listEthics(f: EthicsFilters, signal?: AbortSignal) {
  const view = await ethicsListView();
  const access = f.access ?? view.tabs[0]?.value;
  if (!access || !view.tabs.some((tab) => tab.value === access))
    throw new AppError(
      "FORBIDDEN",
      "Ethics listing access has not been granted.",
      403,
    );
  if (f.org)
    serverFunctions.permissions.scopeOrganization(f.org, await organizations());
  const sorts = view.gates.sort
    ? serverFunctions.choices.objectDateChoices(
        await lookups.objectDates({ objectType: "ETHICS" }),
      )
    : [];
  if (f.sort && !sorts.some((s) => s.value === f.sort))
    throw new AppError("BAD_REQUEST", "Unknown Ethics sort column.", 400);
  const clause = ethicsWhereClause(f, view.gates);
  const raw = await ethics.applications(
    {
      accessType: access,
      query: {
        p_offset: String(f.offset),
        p_limit: "10",
        ...(clause ? { p_where_clause: clause } : {}),
        ...(f.sort
          ? {
              p_order_by: `"${f.sort}"`,
              p_sort_order: f.direction === "ascending" ? "ASC" : "DESC",
            }
          : {}),
      },
    },
    { signal },
  );
  const result = body.safeParse(raw);
  if (!result.success)
    throw new AppError(
      "CONTRACT",
      "Oracle returned invalid Ethics applications.",
    );
  return {
    rows: result.data.items.map(mapRow),
    hasMore: result.data.hasMore === true || result.data.hasMore === "true",
  };
}

export async function ethicsChoices(kind: string, access?: string) {
  const view = await ethicsListView();
  if (
    !view.tabs.length ||
    (access && !view.tabs.some((tab) => tab.value === access))
  )
    throw new AppError(
      "FORBIDDEN",
      "Ethics listing access has not been granted.",
      403,
    );
  if (
    kind !== "status" &&
    (!Object.hasOwn(view.gates, kind) ||
      !view.gates[kind as keyof typeof view.gates])
  )
    throw new AppError("FORBIDDEN", "Ethics filter is not visible.", 403);
  if (kind === "responseStatus" && access !== "EA_ACCESS")
    throw new AppError(
      "FORBIDDEN",
      "Response status is only available in administration view.",
      403,
    );
  if (kind === "sort")
    return serverFunctions.choices.objectDateChoices(
      await lookups.objectDates({ objectType: "ETHICS" }),
    );
  const lookupTypes: Record<string, string> = {
    status: access === "EA_ACCESS" ? "DYN_FORM_SETUP_STATUS" : "ETHICS_STATUS",
    type: "ETHICS_TYPE",
    responseStatus: "ETHICS_STATUS",
    formType: "ETHICS_FORM_TYPE",
    risk: "RISK",
  };
  if (kind === "org")
    return (await organizations()).map((o) => ({ value: o.id, label: o.name }));
  if (kind === "createdBy")
    return (await people.all()).map((person) => ({
      value: String(person.person_id),
      label: person.full_name ?? String(person.person_id),
    }));
  if (!Object.hasOwn(lookupTypes, kind))
    throw new AppError("BAD_REQUEST", "Unknown Ethics choice list.", 400);
  const choices = serverFunctions.choices.statusChoices(
    await lookups.codes({ types: lookupTypes[kind] }),
    lookupTypes[kind],
  );
  return kind === "status"
    ? choices
    : choices.filter((choice) => choice.value !== "");
}
