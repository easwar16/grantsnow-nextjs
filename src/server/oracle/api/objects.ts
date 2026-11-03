import "server-only";
import { z } from "zod";
import { read, write } from "../client";
import { figureOperations } from "./home";

/**
 * A record's shared panels besides comments: its audit trail, status history and delegations. Record data, so every
 * read is held for the request only.
 */
const value = z
  .union([z.string(), z.number()])
  .nullish()
  .transform((v) => (v === null || v === undefined ? "" : String(v)));
const auditRows = z.object({
  items: z.array(
    z.object({
      date_time: value,
      event: value,
      name: value,
      field_values: z
        .array(
          z.object({
            field_name: value,
            field_value: value,
            old_value: value,
          }),
        )
        .nullish(),
    }),
  ),
});
export type AuditRow = z.infer<typeof auditRows>["items"][number];
type Target = { objectType: string; objectId: string };
/** One page's audit trail (getObjectAudits); `event` empty for ALL, as the drawer's tab chain sends it. */
export const audits = read<
  Target & { page: string; event: string },
  AuditRow[]
>({
  op: "getSharedGetObjectAudits2",
  headers: (p) => ({
    p_obj_id: p.objectId,
    p_obj_type: p.objectType,
    p_page_name: p.page,
    p_event: p.event,
  }),
  parse: (b) => auditRows.parse(b).items,
});

const text = z.string().nullish();
const key = z.union([z.string(), z.number()]).nullish();
const statusRows = z.object({
  items: z.array(
    z.object({
      object_id: key,
      object_status_lkp_code: text,
      object_status: text,
      status_process_mode_lkp_code: text,
      status_process_mode: text,
      comments: text,
      created_by: key,
      created_by_name: text,
      creation_date: text,
    }),
  ),
});
export type StatusRow = z.infer<typeof statusRows>["items"][number];
/** The record's status history (objectStatus). */
export const statuses = read<Target, StatusRow[]>({
  op: "getSharedObjectStatus",
  headers: (p) => ({ p_obj_id: p.objectId, p_obj_type: p.objectType }),
  parse: (b) => statusRows.parse(b).items,
});
const nextRows = z.object({
  items: z.array(z.object({ STATUS: z.string(), STATUS_CODE: z.string() })),
});
/** The statuses the record may move to next (getNextObjectStatus). */
export const nextStatuses = read<
  Target,
  z.infer<typeof nextRows>["items"][number][]
>({
  op: "getSharedGetNextObjectStatus",
  headers: (p) => ({
    p_object_id: p.objectId,
    p_object_type: p.objectType,
  }),
  parse: (b) => nextRows.parse(b).items,
});
/** WRITES: a new status (insertStatus); `body` is the status row built by the history rules. */
export const addStatus = write<{ body: unknown }>({
  op: "postSharedObjectStatus",
  identity: ["legal_id", "org_id", "user_id"],
  body: (p) => p.body,
  // A status change can change the record roles held for this session.
  // A new status changes the record's roles and status, and Home's queues and counts.
  invalidates: [
    "getSecurityUser_roles",
    "getDynamicFormsGetRequestDetails",
    ...figureOperations,
  ],
});

const id = z.union([z.number(), z.string().regex(/^\d+$/)]).transform(String);
const flag = z.enum(["Y", "N"]).nullish();
const delegationRows = z.object({
  items: z.array(
    z.object({
      id,
      pid: id,
      page_name: z.string(),
      page_desc: text,
      component_type: text,
      read_access: flag,
      edit_access: flag,
      delete_access: flag,
      start_date: text,
      end_date: text,
    }),
  ),
});
export type DelegationRow = z.infer<typeof delegationRows>["items"][number];
/** The record's delegations, one row per delegate and page. */
export const delegations = read<Target, DelegationRow[]>({
  op: "getProposalDelegationsProposal_id",
  headers: (p) => ({ object_id: p.objectId, object_type: p.objectType }),
  parse: (b) => delegationRows.parse(b).items,
});
/** WRITES: adds or re-grants a delegation (submitDelegation); `body` is built by the delegation rules. */
export const delegate = write<{ body: unknown }>({
  op: "postProposalDelegations",
  identity: ["legal_id", "org_id"],
  body: (p) => p.body,
});
/** WRITES: one delegated page's rights (accessChange); the row id is in the path. */
export const setAccess = write<{
  delegationId: string;
  read: boolean;
  edit: boolean;
  delete: boolean;
}>({
  op: "postProposalDelegationsDelegation_id",
  identity: ["legal_id", "org_id"],
  body: (p) => ({ delete: p.delete, edit: p.edit, read: p.read }),
  path: (p) => ({ delegation_id: p.delegationId }),
});
/** WRITES: removes one delegated page (`delegationId`) or, without it, every page of the person (removeAccess). */
export const undelegate = write<
  Target & { personId: string; delegationId?: string }
>({
  op: "deleteProposalDelegations",
  headers: (p) => ({
    object_id: p.objectId,
    object_type: p.objectType,
    person_id: p.personId,
    delegation_id: p.delegationId,
  }),
});
/** The records linked to an object (shared objectLinked): `ObjectLinks` rows by MODULE_NAME, each with its legacy link. */
export const linked = read<{ objectType: string; objectId: number }>({
  op: "getSharedObjectLinked2",
  headers: (p) => ({ object_type: p.objectType, object_id: p.objectId }),
});
