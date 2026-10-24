import "server-only";
import { z } from "zod";
import { objects, people, roles } from "@/server/oracle/api";
import {
  label,
  resourceRequired,
  resources,
  resourceVisible,
  type Resources,
} from "@/server/platform/configuration/resources";
import { plainText } from "@/server/platform/sanitize";
import { AppError } from "@/lib/errors";
import type { UserContext } from "@/shared/auth/types";
import {
  COMPONENT_ORDER,
  type ComponentType,
  type Delegate,
  type DelegatedPage,
  type DelegationTextKey,
  type DelegationView,
} from "@/features/record/objects/types";

/**
 * One host of the shared object delegations (legacy `object-delegations` fragment). Rights are the host's delegation
 * page (legacy defaulted every host but awards to `proposals-delegation` and failed open: KB Shared-Features).
 */
export interface DelegationHost {
  token: string;
  user: UserContext;
  objectType: string;
  objectId: string;
  bundle: string;
  /** The host's default page (legacy `default`): always delegated with read, never removed. */
  defaultPage: string;
  rights: { edit: boolean; delete: boolean };
}
const KEYS: Record<DelegationTextKey, [string, string, string]> = {
  add: ["button-labels", "add-delegation", "Add Delegation"],
  noData: ["helper-texts", "delegation-no-data", "No Data"],
  read: ["button-labels", "delegation-read", "Read"],
  edit: ["button-labels", "delegation-edit", "Edit"],
  delete: ["button-labels", "delegation-delete", "Delete"],
  remove: ["button-labels", "delegation-remove", "Remove"],
  editAccess: ["button-labels", "delegation-edit-access", "Edit Access"],
  from: ["labels", "delegation-from", "From"],
  to: ["labels", "delegation-to", "To"],
  dialogTitle: ["dialog-titles", "add-delegation", "Add Delegation"],
  people: ["labels", "delegation-search-by-name", "Search"],
  privilege: ["labels", "delegation-privilege", "Privileges"],
  startDate: ["labels", "delegation-start-date", "Start Date"],
  endDate: ["labels", "delegation-end-date", "End Date"],
  all: ["option-keys", "delegation-all", "All"],
  submit: ["button-labels", "delegation-submit", "Submit"],
  deleteTitle: ["dialog-titles", "delegation-delete-entity", "Delete"],
  deleteMessage: [
    "warning-messages",
    "delegation-are-you-sure",
    "Are you sure?",
  ],
  deleteYes: ["button-labels", "delegation-delete-yes", "Yes"],
  deleteNo: ["button-labels", "delegation-delete-no", "No"],
  PAGE: ["option-keys", "delegation-pages", "Pages"],
  BUTTON: ["option-keys", "delegation-buttons", "Buttons"],
  PRIVILEGE: ["option-keys", "delegation-privileges", "Privileges"],
  OTHER: ["option-keys", "delegation-others", "Others"],
};
/** The list's group rows, as legacy prepareDatasource names them (no bundle key). */
const GROUP_NAMES: Record<ComponentType, string> = {
  PAGE: "Page",
  BUTTON: "Button",
  PRIVILEGE: "Privilege",
  OTHER: "Other",
};
const componentOf = (v: string | null | undefined): ComponentType =>
  COMPONENT_ORDER.includes(v as ComponentType) ? (v as ComponentType) : "OTHER";
/** RB visibility (fail closed), RB mandatory flags (missing is optional, as legacy) and the host's rights. */
export function delegationGates(rows: Resources, host: DelegationHost) {
  const on = (group: string, key: string) =>
    resourceVisible(rows, host.bundle, group, key);
  const required = (key: string) =>
    resourceRequired(rows, host.bundle, "labels", key, false);
  return {
    edit: host.rights.edit,
    delete: host.rights.delete,
    editAccess: on("button-labels", "delegation-edit-access"),
    deleteDelegate: on("button-labels", "delegation-delete"),
    from: on("labels", "delegation-from"),
    to: on("labels", "delegation-to"),
    peopleRequired: required("delegation-search-by-name"),
    startRequired: required("delegation-start-date"),
    endRequired: required("delegation-end-date"),
  };
}
/** Legacy getPageLabel: the host bundle's `page-name` entry, then any bundle's, then the plain page description. */
function pageLabel(
  rows: Resources,
  bundle: string,
  name: string,
  description: string | null | undefined,
) {
  const named = rows.filter(
    (r) => r.label_type === "page-name" && r.label_name === name,
  );
  return (
    named.find((r) => r.module_name.toLowerCase() === bundle)?.label_value ||
    named.find((r) => r.label_value)?.label_value ||
    plainText(description ?? "") ||
    name
  );
}
const text = z.string().nullish();
const key = z.union([z.number(), z.string().regex(/^\d+$/)]).transform(String);
const flag = z.enum(["Y", "N"]).nullish();
const roleRows = z.object({
  items: z.array(
    z.object({
      page_name: z.string(),
      page_desc: text,
      component_type: text,
      read_access: flag,
    }),
  ),
});
const pickerRows = z.object({
  items: z.array(
    z.object({ person_id: key, full_name: text, org_unit_name: text }),
  ),
});
const isoDay = (v: string | null | undefined) =>
  v?.match(/^\d{4}-\d{2}-\d{2}/)?.[0] ?? "";
/**
 * The pages the user may delegate: their own readable pages on the object (legacy `pagesList`), one per name (8997
 * dedupe), every row for a page granting read.
 */
async function catalogue(host: DelegationHost, rows: Resources) {
  const raw = await roles.record({
    objectType: host.objectType,
    objectId: host.objectId,
  });
  const items = roleRows.parse(raw).items;
  const pages = new Map<
    string,
    { type: ComponentType; label: string; locked: boolean }
  >();
  for (const r of items) {
    if (pages.has(r.page_name)) continue;
    if (
      !items.every((o) => o.page_name !== r.page_name || o.read_access === "Y")
    )
      continue;
    pages.set(r.page_name, {
      type: componentOf(r.component_type),
      label: pageLabel(rows, host.bundle, r.page_name, r.page_desc),
      locked: r.page_name === host.defaultPage,
    });
  }
  return pages;
}
const readDelegations = (host: DelegationHost) =>
  objects.delegations({ objectType: host.objectType, objectId: host.objectId });
/** The delegations grouped person → component type → page, the delegable catalogue, labels and gates. */
export async function delegationView(
  host: DelegationHost,
): Promise<DelegationView> {
  const rows = await resources();
  const [delegations, pages, staff] = await Promise.all([
    readDelegations(host),
    catalogue(host, rows),
    // Everyone, so a delegate outside the picker's list still has a name (legacy a13ba5a81). A missing name degrades
    // to a dash; a dead session still signs out.
    people.all().catch((e: unknown) => {
      if (e instanceof AppError && e.status === 401) throw e;
      return [];
    }),
  ]);
  const texts = Object.fromEntries(
    (Object.keys(KEYS) as DelegationTextKey[]).map((k) => [
      k,
      label(rows, host.bundle, KEYS[k][0], KEYS[k][1], KEYS[k][2]),
    ]),
  ) as Record<DelegationTextKey, string>;
  const delegates = new Map<string, Delegate>();
  for (const d of delegations) {
    let person = delegates.get(d.pid);
    if (!person) {
      person = {
        personId: d.pid,
        name:
          staff.find((p) => String(p.person_id) === d.pid)?.full_name ?? "—",
        start: isoDay(d.start_date),
        end: isoDay(d.end_date),
        groups: [],
      };
      delegates.set(d.pid, person);
    }
    const type = componentOf(d.component_type);
    let group = person.groups.find((g) => g.type === type);
    if (!group) {
      group = { type, label: GROUP_NAMES[type], pages: [] };
      person.groups.push(group);
      person.groups.sort(
        (a, b) =>
          COMPONENT_ORDER.indexOf(a.type) - COMPONENT_ORDER.indexOf(b.type),
      );
    }
    group.pages.push({
      id: d.id,
      name: d.page_name,
      label: pageLabel(rows, host.bundle, d.page_name, d.page_desc),
      read: d.read_access === "Y",
      edit: d.edit_access === "Y",
      delete: d.delete_access === "Y",
      locked: d.page_name === host.defaultPage,
    } satisfies DelegatedPage);
  }
  return {
    texts,
    delegates: [...delegates.values()],
    catalogue: COMPONENT_ORDER.flatMap((type) => {
      const entries = [...pages]
        .filter(([, p]) => p.type === type)
        .map(([name, p]) => ({ name, label: p.label, locked: p.locked }));
      return entries.length
        ? [{ type, label: texts[type], pages: entries }]
        : [];
    }),
    gates: delegationGates(rows, host),
  };
}
/** The add picker's people (legacy getPreAwardGetPersonListADP), each with its org unit beneath the name. */
export async function delegationPeople(host: DelegationHost) {
  if (!host.rights.edit) throw denied();
  return pickerRows.parse(await people.inOrg({})).items.map((p) => ({
    value: p.person_id,
    label: p.full_name ?? p.person_id,
    detail: p.org_unit_name ?? "",
  }));
}
const denied = () =>
  new AppError("FORBIDDEN", "You cannot change these delegations.", 403);
const isoDate = z.union([
  z.literal(""),
  z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
]);
const personId = z.string().regex(/^[1-9]\d{0,14}$/);
export const delegationInput = z
  .object({
    users: z.array(personId).min(1).max(200),
    start: isoDate,
    end: isoDate,
    pages: z.array(z.string().min(1).max(200)).max(1000),
    read: z.boolean(),
    edit: z.boolean(),
    delete: z.boolean(),
  })
  .strict();
const yes = (v: boolean) => (v ? "true" : "false");
/**
 * WRITES: adds or re-grants a delegation (legacy submitDelegation → postProposalDelegations). People must be ones the
 * picker offers or existing delegates; pages must be ones the user may delegate, the default page always included
 * with read. The permission ladder (delete ⇒ edit ⇒ read) is applied here, not trusted from the browser.
 */
export async function submitDelegation(host: DelegationHost, raw: unknown) {
  const input = delegationInput.parse(raw);
  if (!host.rights.edit) throw denied();
  const rows = await resources();
  const gates = delegationGates(rows, host);
  if (
    (gates.startRequired && input.start === "") ||
    (gates.endRequired && input.end === "") ||
    (input.start !== "" && input.end !== "" && input.end < input.start)
  )
    throw new AppError("BAD_REQUEST", "Check the delegation dates.", 400);
  const [pages, offered, delegations] = await Promise.all([
    catalogue(host, rows),
    delegationPeople(host),
    readDelegations(host),
  ]);
  const known = new Set([
    ...offered.map((p) => p.value),
    ...delegations.map((d) => d.pid),
  ]);
  const chosen = new Set(input.pages);
  if (pages.has(host.defaultPage)) chosen.add(host.defaultPage);
  if (
    input.users.some((u) => !known.has(u)) ||
    [...chosen].some((p) => !pages.has(p))
  )
    throw new AppError(
      "BAD_REQUEST",
      "That person or page cannot be delegated here.",
      400,
    );
  const del = input.delete,
    edit = input.edit || del,
    read = input.read || edit;
  await objects.delegate({
    body: {
      object_id: Number(host.objectId),
      object_type: host.objectType,
      start_date: input.start || null,
      end_date: input.end || null,
      users: input.users.map(Number),
      // Legacy's typed delegation variable carries these as strings (openapi example: "true").
      access: [...chosen].map((page) => ({
        page,
        read: yes(page === host.defaultPage || read),
        edit: yes(edit),
        delete: yes(del),
      })),
    },
  });
  return { saved: true };
}
export const accessInput = z
  .object({ type: z.enum(["read", "edit", "delete"]), value: z.boolean() })
  .strict();
const rowId = z.string().regex(/^[1-9]\d{0,14}$/);
async function ownRow(host: DelegationHost, id: string) {
  const row = (await readDelegations(host)).find(
    (d) => d.id === rowId.parse(id),
  );
  if (!row)
    throw new AppError(
      "BAD_REQUEST",
      "That delegation is not on this record.",
      404,
    );
  return row;
}
/**
 * WRITES: one page switch of one delegate (legacy accessChange → postProposalDelegationsDelegation_id), with its ladder:
 * read off clears edit and delete, edit on sets read, edit off clears delete, delete on sets all three. The row must
 * be one of this record's delegations; the default page keeps read.
 */
export async function setDelegationAccess(
  host: DelegationHost,
  id: string,
  raw: unknown,
) {
  const { type, value } = accessInput.parse(raw);
  if (!host.rights.edit) throw denied();
  const row = await ownRow(host, id);
  let read = row.read_access === "Y",
    edit = row.edit_access === "Y",
    del = row.delete_access === "Y";
  if (type === "read") read = value;
  if (type === "edit") edit = value;
  if (type === "delete") del = value;
  if (type === "read" && !read) edit = del = false;
  if (type === "edit") {
    if (edit) read = true;
    else del = false;
  }
  if (type === "delete" && del) read = edit = true;
  if (!read && row.page_name === host.defaultPage)
    throw new AppError("BAD_REQUEST", "The default page keeps read.", 400);
  await objects.setAccess({
    delegationId: row.id,
    delete: del,
    edit,
    read,
  });
  return { read, edit, delete: del };
}
/**
 * WRITES: removes one page of a delegate (`id`) or, with `person`, the whole delegate (legacy removeAccess →
 * deleteProposalDelegations). Both must be on this record; the default page is removed only with its delegate.
 */
export async function removeDelegation(
  host: DelegationHost,
  target: { id: string } | { person: string },
) {
  if (!host.rights.delete) throw denied();
  const record = { objectType: host.objectType, objectId: host.objectId };
  if ("id" in target) {
    const row = await ownRow(host, target.id);
    if (row.page_name === host.defaultPage)
      throw new AppError(
        "BAD_REQUEST",
        "The default page cannot be removed.",
        400,
      );
    await objects.undelegate({
      ...record,
      personId: row.pid,
      delegationId: row.id,
    });
  } else {
    const person = personId.parse(target.person);
    const gates = delegationGates(await resources(), host);
    if (!gates.deleteDelegate) throw denied();
    if (!(await readDelegations(host)).some((d) => d.pid === person))
      throw new AppError(
        "BAD_REQUEST",
        "That person has no delegation on this record.",
        404,
      );
    await objects.undelegate({ ...record, personId: person });
  }
  return { removed: true };
}
