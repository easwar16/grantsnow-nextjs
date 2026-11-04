import "server-only";
import { z } from "zod";
import { claims, lookups, reports } from "@/server/oracle/api";
import {
  resources,
  type Resources,
} from "@/server/platform/configuration/resources";
import { AppError } from "@/lib/errors";
import { serverFunctions } from "@/server/functions";
import {
  scopedDelete,
  scopedDownload,
  storeFile,
  type FileScope,
} from "@/server/record/attachments/service";
import type { UnitSignOffList } from "@/features/modules/claims/units/types";
import {
  signOffViews,
  UNIT_MODULE,
  type SignOffView,
} from "@/shared/claims/unit-record";
import { BUNDLE, label, numberish, optionalText } from "../listing";
import { unitRecordRead, type UnitRecordContext } from "../record";
import { statusConfig, type StatusConfig } from "./status";

const text = (v: unknown) => (v === null || v === undefined ? "" : String(v));
const day = (v: unknown) => text(v).slice(0, 10);

/** Legacy unitStakeholdersType / unitMeetingsType / orgDocsType: the columns each row has, and so what a write sends. */
const stakeholderRow = z.object({
  stakeholder_id: numberish,
  app_id: numberish,
  org_id: numberish,
  first_name: optionalText,
  last_name: optionalText,
  email_address: optionalText,
  role_name: optionalText,
  person_id: z.unknown(),
});
const fileColumns = {
  app_id: numberish,
  attachment_id: numberish,
  description: optionalText,
  document_type: optionalText,
  file_location: optionalText,
  file_name: optionalText,
  file_size: numberish,
  obj_ref_id: numberish,
  obj_ref_type: optionalText,
  org_id: numberish,
  sec_obj_ref_id: numberish,
  sec_obj_ref_type: optionalText,
};
const meetingRow = z.object({
  meeting_id: numberish,
  meeting_date: optionalText,
  ...fileColumns,
});
const documentRow = z.object({
  doc_id: numberish,
  document_type_code: optionalText,
  ...fileColumns,
});
const lookupRow = z.object({
  lookup_code: z.union([z.string(), z.number()]).nullish(),
  lookup_code_value: z.string().nullish(),
});
const items = <T extends z.ZodTypeAny>(row: T, raw: unknown) =>
  (z.object({ items: z.array(row).nullish() }).parse(raw).items ??
    []) as z.infer<T>[];

/** Each list's `unit-add-*` right and its attachment folder (legacy addNewAttachment `module`). */
const LISTS: Record<SignOffView, { role: string; folder?: string }> = {
  stakeholders: { role: "unit-add-stakeholder" },
  meetings: { role: "unit-add-meeting", folder: "MEETING" },
  documents: { role: "unit-add-document", folder: "ORG-DOC" },
};
const fundRow = z.object({ fund_status_code: optionalText });
/**
 * Legacy Summary `isEditable`: both fund configs loaded, and every fund's status allows a user edit (an `ADJ_` status
 * by the amendment config, any other by the fund config).
 */
export async function summaryEditable(
  context: UnitRecordContext,
  config: StatusConfig,
) {
  if (!config.CLAIM_FUNDS || !config.CLAIM_FUNDS_AMENDMENT) return false;
  const funds = items(
    fundRow,
    await claims.appFundSummary({
      appId: Number(context.id),
      orgId: context.user.organizationId,
    }),
  );
  return funds.every((f) => {
    const s = f.fund_status_code ?? "";
    return s.startsWith("ADJ_")
      ? config.CLAIM_FUNDS_AMENDMENT[s] === true
      : config.CLAIM_FUNDS[s] === true;
  });
}
const canManage = async (
  context: UnitRecordContext,
  view: SignOffView,
  config: StatusConfig,
) =>
  context.access.roles.get(LISTS[view].role)?.edit === true &&
  (await summaryEditable(context, config));
const scopeOf = (id: string, folder: string): FileScope => ({
  objectType: UNIT_MODULE,
  objectId: id,
  secondaryType: folder,
  objectNumber: id,
});
const header = (rows: Resources, key: string, fallback: string) => ({
  key,
  label: label(rows, "table-headers", key, fallback),
  help: serverFunctions.resources.resourceDescription(
    rows,
    BUNDLE,
    "table-headers",
    key,
  ),
});
const listOf = (raw: string | null) => {
  const parsed = z.enum(signOffViews).safeParse(raw);
  if (!parsed.success)
    throw new AppError("BAD_REQUEST", "Unknown sign-off list.", 400);
  return parsed.data;
};
const readList = (context: UnitRecordContext, view: SignOffView) => {
  const p = { appId: Number(context.id), orgId: context.user.organizationId };
  return view === "stakeholders"
    ? claims.stakeholders(p).then((b) => items(stakeholderRow, b))
    : view === "meetings"
      ? claims.meetings(p).then((b) => items(meetingRow, b))
      : claims.documents(p).then((b) => items(documentRow, b));
};
const attachmentOf = (r: { attachment_id?: unknown; file_name?: unknown }) =>
  r.attachment_id && r.file_name
    ? { id: text(r.attachment_id), name: text(r.file_name) }
    : null;

/**
 * One sign-off list, read when its tab opens (legacy signOffTabSelectionChanged): stakeholders, meetings or org
 * documents, with what the user may do with it. A document's type shows its FPCG_DOC_TYPE name.
 */
export async function signOffList(
  id: string,
  raw: string | null,
): Promise<UnitSignOffList> {
  const view = listOf(raw);
  const context = await unitRecordRead(id, "summary");
  const [rows, list, config, types] = await Promise.all([
    resources(),
    readList(context, view),
    statusConfig().catch((): StatusConfig => ({})),
    view === "documents"
      ? lookups
          .codes({ types: "FPCG_DOC_TYPE" })
          .then((b) => items(lookupRow, b))
      : Promise.resolve([]),
  ]);
  const t = (group: string, key: string, fallback: string) =>
    label(rows, group, key, fallback);
  const manage = await canManage(context, view, config);
  const options = types.map((o) => ({
    value: text(o.lookup_code),
    label: o.lookup_code_value ?? "",
  }));
  const typeName = (code: unknown) =>
    options.find((o) => o.value === text(code))?.label ?? "";
  const empty = t("helper-texts", "no-data", "No data to display.");
  if (view === "stakeholders") {
    const people = list as z.infer<typeof stakeholderRow>[];
    // Legacy: the exports need `claims-export` and a list with rows.
    const exportable =
      people.length > 0 &&
      context.access.roles.get("claims-export")?.read === true;
    return {
      headers: [
        header(rows, "first-name", "First Name"),
        header(rows, "last-name", "Last Name"),
        header(rows, "email", "Email"),
        header(rows, "role", "Role"),
      ],
      dates: [],
      empty,
      rows: people.map((r, i) => {
        const values = {
          first: r.first_name ?? "",
          last: r.last_name ?? "",
          email: r.email_address ?? "",
          role: r.role_name ?? "",
        };
        return {
          key: text(r.stakeholder_id) || String(i),
          cells: {
            "first-name": values.first,
            "last-name": values.last,
            email: values.email,
            role: values.role,
          },
          values,
          attachment: null,
        };
      }),
      manage: manage
        ? {
            add: t("button-labels", "add-stakeholder", "Add Stakeholder"),
            save: t("button-labels", "save-stakeholder", "Save Stakeholder"),
            title: t(
              "dialog-titles",
              "consultation-stakeholder",
              "Consultation Stakeholder",
            ),
            fields: [
              ["first", "first-name", "First Name"],
              ["last", "last-name", "Last Name"],
              ["email", "email", "Email"],
              ["role", "role", "Role"],
            ].map(([key, rb, fallback]) => ({
              key,
              label: t("labels", rb, fallback),
              kind: "text" as const,
            })),
            options: [],
            inline: true,
          }
        : null,
      exports: exportable
        ? {
            list: t("button-labels", "export", "Export"),
            signIn: t("button-labels", "sign-in-sheet", "Sign-In Sheet"),
          }
        : null,
    };
  }
  if (view === "meetings") {
    const meetings = list as z.infer<typeof meetingRow>[];
    return {
      headers: [
        header(rows, "meeting-date", "Meeting Date"),
        header(rows, "meeting-description", "Description"),
        header(rows, "meeting-attachment", "Attachment"),
      ],
      dates: ["meeting-date"],
      empty,
      rows: meetings.map((r, i) => ({
        key: text(r.meeting_id) || String(i),
        cells: {
          "meeting-date": r.meeting_date ?? "",
          "meeting-description": r.description ?? "",
          "meeting-attachment": r.file_name ?? "",
        },
        values: {
          description: r.description ?? "",
          date: day(r.meeting_date),
        },
        attachment: attachmentOf(r),
      })),
      manage: manage
        ? {
            add: t("button-labels", "add-meeting", "Add Meeting"),
            save: t("button-labels", "save-meeting", "Save Meeting"),
            title: t(
              "dialog-titles",
              "consultation-meetings",
              "Consultation Meetings",
            ),
            fields: [
              {
                key: "description",
                label: t("labels", "meeting-description", "Description"),
                kind: "text" as const,
              },
              {
                key: "date",
                label: t("labels", "meeting-date", "Meeting Date"),
                kind: "date" as const,
              },
              { key: "file", label: "", kind: "file" as const },
            ],
            options: [],
            inline: false,
          }
        : null,
      exports: null,
    };
  }
  const docs = list as z.infer<typeof documentRow>[];
  return {
    headers: [
      header(rows, "document-type", "Document Type"),
      header(rows, "document-description", "Description"),
      header(rows, "document-attachment", "Attachment"),
    ],
    dates: [],
    empty,
    rows: docs.map((r, i) => ({
      key: text(r.doc_id) || String(i),
      cells: {
        "document-type": typeName(r.document_type_code),
        "document-description": r.description ?? "",
        "document-attachment": r.file_name ?? "",
      },
      values: {
        type: text(r.document_type_code),
        description: r.description ?? "",
      },
      attachment: attachmentOf(r),
    })),
    manage: manage
      ? {
          add: t("button-labels", "add-document", "Add Document"),
          save: t("button-labels", "save-document", "Save Document"),
          title: t("dialog-titles", "org-chart", "Org Chart"),
          fields: [
            {
              key: "type",
              label: t("labels", "document-type", "Document Type"),
              kind: "select" as const,
            },
            {
              key: "description",
              label: t("labels", "document-description", "Description"),
              kind: "text" as const,
            },
            { key: "file", label: "", kind: "file" as const },
          ],
          options,
          inline: false,
        }
      : null,
    exports: null,
  };
}

const DAY = /^\d{4}-\d{2}-\d{2}$/;
const value = z.string().max(4000);
const INPUTS = {
  stakeholders: z
    .object({ first: value, last: value, email: value, role: value })
    .strict(),
  meetings: z
    .object({
      description: value,
      date: z.union([z.literal(""), z.string().regex(DAY)]),
    })
    .strict(),
  documents: z
    .object({ type: z.string().max(100), description: value })
    .strict(),
};
const rowIdOf = (raw: unknown) => {
  if (raw === undefined || raw === "") return undefined;
  const parsed = z.coerce.number().int().positive().safeParse(raw);
  if (!parsed.success) throw new AppError("BAD_REQUEST", "Invalid row.", 400);
  return parsed.data;
};
/** The write gate: the list's `unit-add-*` edit on an editable summary (legacy hides every control otherwise). */
async function writable(id: string, view: SignOffView) {
  const context = await unitRecordRead(id, "summary");
  if (!(await canManage(context, view, await statusConfig())))
    throw new AppError(
      "FORBIDDEN",
      "You do not have access to change this list.",
      403,
    );
  return context;
}
const keyOf = (view: SignOffView, r: Record<string, unknown>) =>
  view === "stakeholders"
    ? r.stakeholder_id
    : view === "meetings"
      ? r.meeting_id
      : r.doc_id;
/** The row being changed, refused when it is not one of this application's. */
async function rowOf(
  context: UnitRecordContext,
  view: SignOffView,
  rowId: number,
) {
  const row = (await readList(context, view)).find(
    (r) => Number(keyOf(view, r as Record<string, unknown>)) === rowId,
  );
  if (!row)
    throw new AppError("FORBIDDEN", "This row is not on the application.", 403);
  return row as Record<string, unknown>;
}

/**
 * WRITES: legacy saveStakeholder / saveMeeting / saveOrgDoc. A stakeholder posts legacy's four-key payload. A meeting
 * or document with a file stores it first (legacy addNewAttachment, under MEETING / ORG-DOC), then posts the row with
 * its `attachment_id`; an edit puts the row as read with the fields replaced. A document's type must be a lookup code.
 */
export async function saveSignOff(
  id: string,
  rawView: string | null,
  fields: Record<string, string>,
  file: { name: string; type: string; bytes: Uint8Array } | null,
) {
  const view = listOf(rawView);
  const { row: rawRow, ...rest } = fields;
  const parsed = INPUTS[view].safeParse(rest);
  if (!parsed.success) throw new AppError("BAD_REQUEST", "Invalid row.", 400);
  const rowId = rowIdOf(rawRow);
  const context = await writable(id, view);
  const appId = Number(id);
  const current =
    rowId === undefined ? null : await rowOf(context, view, rowId);
  if (view === "stakeholders") {
    const s = parsed.data as z.infer<typeof INPUTS.stakeholders>;
    const body = {
      first_name: s.first,
      last_name: s.last,
      email: s.email,
      person_role: s.role,
    };
    await (rowId === undefined
      ? claims.createStakeholder({ appId, body })
      : claims.updateStakeholder({ id: rowId, body }));
    return { saved: rowId === undefined ? "created" : "updated" } as const;
  }
  if (view === "documents") {
    const d = parsed.data as z.infer<typeof INPUTS.documents>;
    if (d.type !== "") {
      const types = items(
        lookupRow,
        await lookups.codes({ types: "FPCG_DOC_TYPE" }),
      );
      if (!types.some((o) => text(o.lookup_code) === d.type))
        throw new AppError("BAD_REQUEST", "Choose a document type.", 400);
    }
  }
  const folder = LISTS[view].folder!;
  const stored = file
    ? await storeFile(scopeOf(id, folder), context.user.legalId, file)
    : null;
  const picked =
    view === "meetings"
      ? (() => {
          const m = parsed.data as z.infer<typeof INPUTS.meetings>;
          return {
            description: m.description,
            meeting_date:
              m.date === ""
                ? null
                : current && day(current.meeting_date) === m.date
                  ? current.meeting_date
                  : m.date,
          };
        })()
      : (() => {
          const d = parsed.data as z.infer<typeof INPUTS.documents>;
          return {
            document_type_code: d.type === "" ? null : d.type,
            description: d.description,
          };
        })();
  const body = {
    ...(current ?? {}),
    ...picked,
    ...(stored
      ? { attachment_id: stored.attachmentId, sec_obj_ref_type: folder }
      : {}),
  };
  if (view === "meetings")
    await (rowId === undefined
      ? claims.createMeeting({ appId, body })
      : claims.updateMeeting({ id: rowId, body }));
  else
    await (rowId === undefined
      ? claims.createDocument({ appId, body })
      : claims.updateDocument({ id: rowId, body }));
  return { saved: rowId === undefined ? "created" : "updated" } as const;
}

/** WRITES: legacy deleteStakeholder / deleteMeeting / deleteOrgDoc; a meeting's or document's file goes with it. */
export async function deleteSignOff(
  id: string,
  rawView: string | null,
  rawRow: unknown,
) {
  const view = listOf(rawView);
  const rowId = rowIdOf(rawRow);
  if (rowId === undefined)
    throw new AppError("BAD_REQUEST", "Invalid row.", 400);
  const context = await writable(id, view);
  const current = await rowOf(context, view, rowId);
  if (view === "stakeholders") await claims.deleteStakeholder({ id: rowId });
  else {
    await (view === "meetings"
      ? claims.deleteMeeting({ id: rowId })
      : claims.deleteDocument({ id: rowId }));
    // Legacy deleteMeeting removes the stored object; the attachment record goes with it here.
    const attachment = Number(current.attachment_id);
    if (attachment)
      await scopedDelete(scopeOf(id, LISTS[view].folder!), attachment).catch(
        () => undefined,
      );
  }
  return { deleted: true as const };
}

/** A meeting's or document's file (legacy downloadAttachment), only when it is on one of this application's rows. */
export async function signOffFile(
  id: string,
  rawView: string | null,
  rawRow: unknown,
) {
  const view = listOf(rawView);
  const folder = LISTS[view].folder;
  const rowId = rowIdOf(rawRow);
  if (!folder || rowId === undefined)
    throw new AppError("BAD_REQUEST", "Invalid row.", 400);
  const context = await unitRecordRead(id, "summary");
  const current = await rowOf(context, view, rowId);
  const attachment = Number(current.attachment_id);
  if (!attachment)
    throw new AppError("BAD_REQUEST", "The row has no file.", 400);
  const { bytes, fileName } = await scopedDownload(
    scopeOf(id, folder),
    attachment,
  );
  return { bytes, filename: fileName, mime: "application/octet-stream" };
}

/** WRITES (generate-report): the stakeholder list or its sign-in sheet (legacy exportReport). */
export async function exportStakeholders(id: string, raw: unknown) {
  const parsed = z.enum(["list", "sign-in"]).safeParse(raw);
  if (!parsed.success)
    throw new AppError("BAD_REQUEST", "Invalid export.", 400);
  const context = await unitRecordRead(id, "summary");
  if (context.access.roles.get("claims-export")?.read !== true)
    throw new AppError("FORBIDDEN", "You do not have access to export.", 403);
  return reports.generate({
    body: serverFunctions.reports.reportPayload(
      parsed.data === "list"
        ? "report-vbcs-stakeholders"
        : "report-vbcs-stakeholders-sign-in-sheet",
      {
        object_type: "CLAIMS",
        object_id: Number(id),
        org_id: context.user.organizationId,
      },
    ),
  });
}
