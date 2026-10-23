import "server-only";
import { z } from "zod";
import { approvals, lookups, objects, people } from "@/server/oracle/api";
import {
  label,
  resources,
  resourceVisible,
  type Resources,
} from "@/server/platform/configuration/resources";
import { displayFormat } from "@/server/platform/configuration/formatting";
import { plainText } from "@/server/platform/sanitize";
import { dateDisplay, type FormatSettings } from "@/lib/format";
import { AppError } from "@/lib/errors";
import type { UserContext } from "@/shared/auth/types";
import {
  ABANDON,
  RESPONSE_DATE_STATUSES,
  type Choice,
  type HistoryTextKey,
  type HistoryView,
} from "@/features/record/objects/types";

/**
 * One host of the shared object history (legacy `object-history` fragment). The host supplies only what it alone
 * knows: identity, its status lookup, its record rights and any label key it names differently; labels, visibility
 * and the response-date gate resolve here from `bundle` (KB Framework-Patterns F2/F3, backlog item 2).
 */
export interface HistoryHost {
  token: string;
  user: UserContext;
  objectType: string;
  objectId: string;
  /** The approval-history transaction number; none skips that read. */
  objectNumber: string | null;
  approvalType: string;
  bundle: string;
  statusLookup: string;
  /** The object's current status code (Add Status and Abandon are disabled once it is ABANDON). */
  statusCode: string | null;
  /** RBAC half of the gates (legacy checkAccess(..., 'edit') on the host's button keys). */
  rights: { addStatus: boolean; abandon: boolean };
  /** Label keys this host names differently from the defaults. */
  keys?: Partial<Record<HistoryTextKey, [string, string]>>;
}
/** The most common key per label across the six legacy hosts, with literal fallbacks (KB Shared-Features label matrix). */
const KEYS: Record<HistoryTextKey, [string, string, string]> = {
  title: ["header-labels", "status-history", "Status History"],
  addStatus: ["button-labels", "history-add-status", "Add Status"],
  abandon: ["button-labels", "history-abandon", "Abandon"],
  status: ["table-headers", "history-status", "Status"],
  mode: ["table-headers", "history-process-mode", "Process Mode"],
  comments: ["table-headers", "history-comments", "Comments"],
  user: ["table-headers", "history-user", "User"],
  date: ["table-headers", "history-date", "Date"],
  noData: ["helper-texts", "no-data", "No data to display."],
  approvalTitle: ["header-labels", "approval-history", "Approval History"],
  // The approval sub-table defaults to the keys approval-workflow seeds in every bundle (KB backlog item 2).
  approvalName: ["table-headers", "approvals-full-name", "Full Name"],
  approvalStatus: ["table-headers", "approval-status", "Status"],
  approvalStage: ["table-headers", "approval-stage", "Stage"],
  approvalComments: [
    "table-headers",
    "approval-user-comments",
    "User Comments",
  ],
  approvalUpdated: [
    "table-headers",
    "approval-last-updated-date",
    "Last Updated Date",
  ],
  approvalNoData: ["helper-texts", "approval-no-data", "No data to display."],
  dialogTitle: ["dialog-titles", "history-add-new-status", "Add New Status"],
  statusLabel: ["labels", "status", "Status"],
  commentPlaceholder: ["placeholders", "comments", "Comments"],
  responseDate: ["labels", "actual-response-date", "Actual Response Date"],
  cancel: ["button-labels", "cancel", "Cancel"],
  save: ["button-labels", "save", "Save"],
  commentsTitle: ["dialog-titles", "comments", "Comments"],
};
function historyTexts(rows: Resources, host: HistoryHost) {
  return Object.fromEntries(
    (Object.keys(KEYS) as HistoryTextKey[]).map((k) => {
      const [group, key] = host.keys?.[k] ?? KEYS[k];
      return [k, label(rows, host.bundle, group, key, KEYS[k][2])];
    }),
  ) as Record<HistoryTextKey, string>;
}
/** The visible gates: RB `is_visible === 'Y'` and the host's record right, both required (fail closed). */
export function historyGates(rows: Resources, host: HistoryHost) {
  return {
    addStatus:
      host.rights.addStatus &&
      resourceVisible(rows, host.bundle, "button-labels", "history-add-status"),
    abandon:
      host.rights.abandon &&
      resourceVisible(rows, host.bundle, "button-labels", "history-abandon"),
    abandoned: host.statusCode === ABANDON,
    // Legacy read this flag from `objectType.toLowerCase()`, not a verified bundle (KB Framework-Patterns F2).
    responseDate: resourceVisible(
      rows,
      host.bundle,
      "labels",
      "actual-submision-date",
    ),
    approvals: resourceVisible(
      rows,
      host.bundle,
      "header-labels",
      "history-page-approval-history",
    ),
  };
}
const text = z.string().nullish();
const lookupRows = z.object({
  items: z.array(
    z.object({
      lookup_type_code: text,
      lookup_code: text,
      lookup_code_descr: text,
    }),
  ),
});
const show = (v: string | null | undefined) =>
  v === null || v === undefined || v === "" ? "—" : v;
/** The timestamp in the configured date format plus its time, as legacy's `DEFAULT_DATE_FORMAT + " HH:mm:ss"`. */
function stamp(value: string | null | undefined, format?: FormatSettings) {
  if (!value) return "—";
  const time = value.match(/T(\d{2}:\d{2}:\d{2})/)?.[1];
  return time
    ? `${dateDisplay(value, format)} ${time}`
    : dateDisplay(value, format);
}
/** Lookup codes → descriptions (legacy loadLookups); a failed read degrades to the row's own text. */
async function descriptions(codes: string[]) {
  const map = new Map<string, string>();
  for (const r of lookupRows.parse(
    await lookups.codes({ types: codes.join(",") }),
  ).items)
    if (r.lookup_code && r.lookup_code_descr)
      map.set(`${r.lookup_type_code}:${r.lookup_code}`, r.lookup_code_descr);
  return map;
}
const settled = <T>(p: Promise<T>) =>
  p.then(
    (value) => ({ value }),
    (error: unknown) => {
      // A dead session still signs out; anything else degrades this part only.
      if (error instanceof AppError && error.status === 401) throw error;
      return { error };
    },
  );
/**
 * The status history and, when the bundle shows it, the approval history. Unlike legacy, the status table does not
 * wait for (or vanish without) the lookups and person list: each cell falls back to the row's own resolved text.
 */
export async function historyView(host: HistoryHost): Promise<HistoryView> {
  const rowsRead = resources();
  const approvalsRead = rowsRead.then((rows) =>
    historyGates(rows, host).approvals && host.objectNumber
      ? settled(
          approvals.history({
            transaction: host.objectNumber,
            approvalType: host.approvalType,
          }),
        )
      : null,
  );
  const [rows, format, history, codes, staff, approved] = await Promise.all([
    rowsRead,
    displayFormat(),
    objects.statuses({ objectType: host.objectType, objectId: host.objectId }),
    settled(descriptions([host.statusLookup, "STATUS_UPDATE_MODE"])),
    settled(people.all()),
    approvalsRead,
  ]);
  const gates = historyGates(rows, host);
  const texts = historyTexts(rows, host);
  const code = (type: string, value?: string | null) =>
    ("value" in codes && value && codes.value.get(`${type}:${value}`)) ||
    undefined;
  const person = (id: unknown) =>
    "value" in staff
      ? (staff.value.find((p) => String(p.person_id) === String(id))
          ?.full_name ?? undefined)
      : undefined;
  return {
    texts,
    rows: history.map((r, i) => ({
      id: `${r.creation_date ?? ""}:${i}`,
      status: show(
        code(host.statusLookup, r.object_status_lkp_code) ?? r.object_status,
      ),
      mode: show(
        code("STATUS_UPDATE_MODE", r.status_process_mode_lkp_code) ??
          r.status_process_mode,
      ),
      comments: r.comments ?? "",
      user: show(person(r.created_by) ?? r.created_by_name),
      date: stamp(r.creation_date, format),
    })),
    approvals:
      approved === null
        ? null
        : "error" in approved
          ? { error: "Approval history could not be loaded." }
          : {
              rows: approved.value.map((r, i) => ({
                id: `${r.approval_history_id ?? ""}:${i}`,
                name: show(r.full_name),
                status: show(r.status),
                stage: show(r.stage_desc),
                comments:
                  typeof r.user_comments === "string"
                    ? plainText(r.user_comments)
                    : "",
                updated: stamp(r.last_update_date, format),
              })),
            },
    gates: {
      addStatus: gates.addStatus,
      abandon: gates.abandon,
      abandoned: gates.abandoned,
      responseDate: gates.responseDate,
    },
  };
}
/** The statuses the object may move to next (getNextObjectStatus); Add Status only, never Abandon. */
export async function nextStatuses(host: HistoryHost): Promise<Choice[]> {
  const rows = await resources();
  const gates = historyGates(rows, host);
  if (!gates.addStatus || gates.abandoned)
    throw new AppError("FORBIDDEN", "You cannot add a status here.", 403);
  return readNext(host);
}
async function readNext(host: HistoryHost) {
  return (
    await objects.nextStatuses({
      objectType: host.objectType,
      objectId: host.objectId,
    })
  ).map((r) => ({ value: r.STATUS_CODE, label: r.STATUS }));
}
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
export const statusInput = z
  .object({
    status: z.string().regex(/^[A-Z0-9_]{1,40}$/),
    // Required, as legacy's text area; the route caps the body size.
    comments: z.string().refine((s) => s.trim() !== ""),
    responseDate: isoDate.optional(),
  })
  .strict();
/**
 * WRITES: inserts a status (legacy insertStatus → postSharedObjectStatus). Abandon needs the abandon gate; any other
 * status needs Add Status and must be one getNextObjectStatus offers now, so the browser cannot pick its own. The
 * actor and scope headers come from the session. The response date is sent only where its field could show.
 */
export async function insertStatus(host: HistoryHost, raw: unknown) {
  const input = statusInput.parse(raw);
  const gates = historyGates(await resources(), host);
  const abandon = input.status === ABANDON;
  if (gates.abandoned || !(abandon ? gates.abandon : gates.addStatus))
    throw new AppError("FORBIDDEN", "You cannot change this status.", 403);
  if (!abandon && !(await readNext(host)).some((s) => s.value === input.status))
    throw new AppError(
      "BAD_REQUEST",
      "That status is not available for this record.",
      400,
    );
  const responseDate =
    gates.responseDate && RESPONSE_DATE_STATUSES.includes(input.status)
      ? input.responseDate
      : undefined;
  await objects.addStatus({
    body: {
      p_process_mode: "MANUAL",
      p_comments: input.comments,
      p_obj_id: Number(host.objectId),
      p_obj_type: host.objectType,
      p_status: input.status,
      ...(responseDate ? { actual_response_date: responseDate } : {}),
    },
  });
  return { status: input.status };
}
