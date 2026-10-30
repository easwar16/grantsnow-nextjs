import "server-only";
import { invalidate } from "@/server/oracle/client";
import { z } from "zod";
import { attachments } from "@/server/oracle/api";
import type { AttachmentRow } from "@/server/oracle/api/attachments";
import {
  oicConnected,
  oicDelete,
  oicDownload,
  exclusiveLocation,
  oicUpload,
} from "@/server/oic/connection";
import {
  fileNameProblem,
  recordAttachment,
  removeAttachment,
  requireStorage,
} from "@/server/record/attachments/service";
import { formGlobals } from "@/server/record/dynamic-form/globals";
import {
  resources,
  type Resources,
} from "@/server/platform/configuration/resources";
import { displayFormat } from "@/server/platform/configuration/formatting";
import { fixtureMode } from "@/server/platform/configuration/environment";
import { eoiAttachmentHost } from "@/server/modules/opportunities/record";
import { awardAttachmentHost } from "@/server/modules/awards/record";
import { proposalAttachmentHost } from "@/server/modules/proposals/attachments";
import { recordIdentity } from "@/features/modules/proposals/record";
import { fileProblem } from "@/features/record/dynamic-form/engine";
import {
  ATTACHMENT_LABELS,
  folderNameProblem,
  folderPaths,
  folderTree,
  parseFolders,
  recordedName,
  safeLinkUrl,
  withExtension,
  type AttachmentItem,
  type AttachmentLabel,
  type AttachmentList,
  type AttachmentsView,
} from "@/features/record/attachments/model";
import { AppError } from "@/lib/errors";
import { mimeDescription, previewable } from "./mime-types";
import { functions } from "@/lib/functions";
import { serverFunctions } from "@/server/functions";

/**
 * The shared attachments panel's server side (legacy `object-attachments`, 8788): records in ORDS
 * (`/pre_award/attachments/`, `/pre_award/links`), bytes in Object Storage through the OIC relay. A host names only
 * its record; who may read or change it, its object identity, storage folders and bundle come from the host resolver.
 * Every write re-checks the host's edit gate (role, lock) and checks ids against the record's own list.
 */
export interface AttachmentHost {
  objectType: string;
  /** `obj_ref_id`. */
  objectId: string;
  /** The record's storage folder. */
  objectNumber: string;
  /** The module's storage folder (`pathSegment || objectType`). */
  pathSegment: string;
  /** The resource bundle labels, folders and gates come from. */
  bundle: string;
  token: string;
  user: { organizationId: string; legalId?: string };
  canEdit: boolean;
}
type Mode = "read" | "view" | "edit";
const HOSTS: Record<
  string,
  (id: string, mode: Mode) => Promise<AttachmentHost>
> = { eoi: eoiAttachmentHost, award: awardAttachmentHost };

for (const type of recordIdentity.shape.type.options)
  HOSTS[type.toLowerCase()] = (id, mode) =>
    proposalAttachmentHost(type, id, mode);
const hostQuery = z.object({
  host: z.enum(Object.keys(HOSTS) as [string, ...string[]]),
  record: z.string().regex(/^[1-9]\d{0,14}$/),
});
/** `?host&record` → the resolved host; anything malformed or unknown is a 400. */
export function attachmentHost(q: URLSearchParams, mode: Mode) {
  const parsed = hostQuery.safeParse({
    host: q.get("host"),
    record: q.get("record"),
  });
  if (!parsed.success)
    throw new AppError("BAD_REQUEST", "Invalid attachments request.", 400);
  return HOSTS[parsed.data.host](parsed.data.record, mode);
}

/** One row per label: the canonical key (most hosts, Framework-Patterns backlog #1) and the fragment's fallback. */
const LABELS: Record<AttachmentLabel, [string, string, string]> = {
  addDocument: ["button-labels", "attachment-add-document", "Add Document"],
  folderName: ["labels", "folder-name", "Folder"],
  newFolder: ["labels", "new-folder", "New Folder"],
  newFolderName: ["labels", "folder-name", "Folder Name"],
  fileName: ["labels", "attachments-file-name", "File Name"],
  description: ["labels", "attachments-description", "Description"],
  fileSize: ["labels", "attachments-file-size", "File Size"],
  fileType: ["labels", "attachments-file-type", "File Type"],
  uploadedBy: ["labels", "attachments-uploaded-by", "Uploaded By"],
  lastUpdatedDate: ["labels", "attachments-last-updated-date", "Last Updated"],
  preview: ["button-labels", "attachment-preview", "Preview"],
  // Not in the fragment (it downloads on double-click); the explicit button reads the bundles' `labels/download`.
  download: ["labels", "download", "Download"],
  delete: ["button-labels", "attachment-delete", "Delete"],
  add: ["button-labels", "attachment-add", "Add"],
  cancel: ["button-labels", "cancel", "Cancel"],
  confirmDelete: ["button-labels", "attachment-confirm-delete", "Delete"],
  confidential: ["labels", "confidential-attachment", "Confidential"],
  yes: ["option-keys", "yes", "Yes"],
  no: ["option-keys", "no", "No"],
  documentPreview: [
    "header-labels",
    "attachment-document-preview",
    "Document Preview",
  ],
  addNewDocumentTitle: [
    "dialog-titles",
    "attachment-add-new-document",
    "Add New Document",
  ],
  deleteWarningTitle: [
    "dialog-titles",
    "attachment-delete-warning",
    "Delete Document",
  ],
  deleteWarningText: [
    "helper-texts",
    "attachment-this-operation-will",
    "This operation will permanently delete the document. Do you want to continue?",
  ],
  pleaseNote: ["header-labels", "attachment-please-note", "Please note"],
  fileShouldNotExceed: [
    "labels",
    "attachment-file-should-not-exceed",
    "File should not exceed the allowed size.",
  ],
  noData: ["helper-texts", "no-data", "No documents"],
  treeAriaLabel: [
    "aria-labels",
    "tree-view-with-attachment-data",
    "Tree view with attachment data",
  ],
  linksHeader: ["header-labels", "attachment-links-header", "Links"],
  addLink: ["button-labels", "add-link", "Add Link"],
  linkTitle: ["labels", "link-title", "Link Title"],
  linkUrl: ["labels", "link-url", "Link URL"],
};
/** Keys a bundle names differently, or (null) a literal its host passes (the host page's `labels` object). */
const BUNDLE_KEYS: Record<
  string,
  Partial<Record<AttachmentLabel, [string, string] | null>>
> = {
  // opportunities-eoi-attachments-start-page.html:27-58
  "opportunities-eoi": {
    addDocument: ["button-labels", "add-document"],
    newFolder: null,
    newFolderName: null,
    fileName: null,
    description: null,
    fileSize: null,
    fileType: ["labels", "attachment-file-type"],
    uploadedBy: ["labels", "attachment-created-by"],
    lastUpdatedDate: ["labels", "attachment-last-updated-by"],
    add: ["button-labels", "add"],
    confirmDelete: ["button-labels", "delete"],
    confidential: null,
    yes: null,
    no: null,
    documentPreview: ["header-labels", "document-preview"],
    addNewDocumentTitle: ["dialog-titles", "add-new-document"],
    deleteWarningTitle: ["dialog-titles", "warning"],
    deleteWarningText: ["helper-texts", "this-operation-will"],
    pleaseNote: ["labels", "please-note"],
    fileShouldNotExceed: ["labels", "file-should-not-exceed"],
    treeAriaLabel: ["aria-labels", "list-with-static-data"],
  },
  // awards-attachments-start-page.html:31-63
  award: {
    addDocument: ["button-labels", "attachment-add-document"],
    folderName: ["labels", "attachment-folder-name"],
    newFolder: null,
    newFolderName: null,
    fileName: ["labels", "attachment-file-name"],
    description: ["labels", "attachment-description"],
    fileSize: ["labels", "attachment-file-size"],
    fileType: ["labels", "attachment-file-type"],
    uploadedBy: ["labels", "attachment-created-by"],
    lastUpdatedDate: ["labels", "attachment-last-updated-date"],
    cancel: ["button-labels", "attachment-add-cancel"],
    confirmDelete: ["button-labels", "attachment-delete"],
    confidential: null,
    yes: null,
    no: null,
    deleteWarningTitle: ["dialog-titles", "attachment-warning"],
    pleaseNote: ["labels", "attachment-please-note"],
    noData: ["helper-texts", "attachment-no-data"],
    treeAriaLabel: ["aria-labels", "list-with-static-data"],
  },
};
export function attachmentLabels(rows: Resources, bundle: string) {
  return Object.fromEntries(
    ATTACHMENT_LABELS.map((name) => {
      const [group, key, fallback] = LABELS[name];
      const mapped = BUNDLE_KEYS[bundle]?.[name];
      if (mapped === null) return [name, fallback];
      const [g, k] = mapped ?? [group, key];
      return [
        name,
        serverFunctions.resources.label(rows, bundle, g, k, fallback),
      ];
    }),
  ) as Record<AttachmentLabel, string>;
}
/** The bundle's gates: folders, links and the confidential choice show only on an explicit 'Y' row. */
function gates(rows: Resources, bundle: string) {
  return {
    folders: serverFunctions.resources.resourceVisible(
      rows,
      bundle,
      "tree-nodes",
      "attachments-nodes",
    )
      ? parseFolders(
          serverFunctions.resources.label(
            rows,
            bundle,
            "tree-nodes",
            "attachments-nodes",
            "",
          ),
        )
      : [],
    showLinks: serverFunctions.resources.resourceVisible(
      rows,
      bundle,
      "header-labels",
      "attachment-links-header",
    ),
    allowConfidential: serverFunctions.resources.resourceVisible(
      rows,
      bundle,
      "labels",
      "confidential-attachment",
    ),
  };
}

/** The panel's view for a host page: resolved labels, gates and limits; no record data. */
export async function attachmentsView(
  q: URLSearchParams,
  id: string,
): Promise<AttachmentsView> {
  const [host, rows, globals] = await Promise.all([
    attachmentHost(q, "view"),
    resources(),
    formGlobals(),
  ]);
  const { folders, showLinks, allowConfidential } = gates(rows, host.bundle);
  return {
    id,
    query: new URLSearchParams({
      host: q.get("host") ?? "",
      record: q.get("record") ?? "",
    }).toString(),
    labels: attachmentLabels(rows, host.bundle),
    folders,
    canEdit: host.canEdit,
    storage: oicConnected(),
    showLinks,
    allowConfidential,
    maxMb: globals.maxMb,
    accept: globals.accept,
  };
}

const target = (host: AttachmentHost) => ({
  objectId: host.objectId,
  objectType: host.objectType,
});
const readAttachments = (host: AttachmentHost) =>
  attachments.list(target(host));
const readLinks = (host: AttachmentHost) => attachments.links(target(host));

/** The record's documents and (when its links row is on) links, as display rows. */
export async function listAttachments(
  q: URLSearchParams,
): Promise<AttachmentList> {
  const [host, rows, format] = await Promise.all([
    attachmentHost(q, "read"),
    resources(),
    displayFormat(),
  ]);
  const { showLinks } = gates(rows, host.bundle);
  const [items, links] = await Promise.all([
    readAttachments(host),
    showLinks ? readLinks(host) : null,
  ]);
  return {
    items: items.map((a: AttachmentRow): AttachmentItem => ({
      id: a.document_id,
      name: a.file_name,
      description: a.description,
      folder: a.sec_obj_ref_type,
      typeLabel: mimeDescription(a.document_type),
      sizeKb:
        a.file_size === null || a.file_size === undefined
          ? ""
          : String(a.file_size),
      uploadedBy: a.created_by_name,
      // The fragment shows DEFAULT_DATE_FORMAT with the time.
      uploadedOn: a.creation_date
        ? functions.format.dateTimeDisplay(a.creation_date, format)
        : "",
      previewType: previewable(a.document_type) ? a.document_type : null,
      downloadName: withExtension(a.file_name, a.file_location),
    })),
    links:
      links?.map((l) => ({
        id: l.link_id,
        title: l.link_title,
        href: safeLinkUrl(l.link_url),
      })) ?? null,
  };
}

const FOLDER = /^[A-Za-z0-9_-]{1,80}$/;
/** INSTANCE/legalId/pathSegment/objectNumber/folder/file (legacy FilePickerSelectChain), each part checked. */
function location(
  instance: string | null,
  host: AttachmentHost,
  folder: string,
  fileName: string,
) {
  const fixed = [
    instance,
    host.user.legalId,
    host.pathSegment,
    host.objectNumber,
  ];
  if (fixed.some((f) => f === null || f === undefined || !FOLDER.test(f)))
    throw new AppError(
      "UPSTREAM",
      "File storage is not configured for this record.",
      503,
    );
  // Configured folder keys may hold spaces (`INTERNAL DOCUMENTS`) but never a path separator.
  if (/[/\\\u0000-\u001f]/.test(folder))
    throw new AppError("BAD_REQUEST", "Invalid folder.", 400);
  return [...fixed, folder, fileName].join("/");
}

export const uploadFields = z
  .object({
    folder: z.string().min(1).max(400),
    newFolder: z.string().max(80).optional(),
    description: z.string().max(4000).optional(),
    confidential: z.enum(["Y", "N"]).optional(),
  })
  .strict();

/** WRITES: stores the bytes, then the attachment record. Limits, folder and name are checked here again. */
export async function uploadAttachment(
  q: URLSearchParams,
  raw: unknown,
  file: { name: string; type: string; bytes: Uint8Array },
) {
  const fields = uploadFields.safeParse(raw);
  if (!fields.success)
    throw new AppError("BAD_REQUEST", "Invalid upload.", 400);
  const settings = serverFunctions.async.early(formGlobals()),
    labelRows = serverFunctions.async.early(resources());
  const host = await attachmentHost(q, "edit");
  requireStorage();
  const globals = await settings;
  const { folder, description = "" } = fields.data;
  const newFolder = fields.data.newFolder?.trim() ?? "";
  const problem =
    fileNameProblem(file.name) ??
    fileProblem(
      { name: file.name, size: file.bytes.byteLength },
      globals.maxMb,
      globals.accept,
    ) ??
    (newFolder === "" ? null : folderNameProblem(newFolder));
  if (problem) throw new AppError("BAD_REQUEST", problem, 400);
  // Stored where it is filed (legacy stored a new sub-folder's file under the parent, so names clashed there).
  const filedIn = newFolder === "" ? folder : `${folder}~~${newFolder}`;
  const stored = location(globals.instance, host, filedIn, file.name);
  return exclusiveLocation(stored, async () => {
    // Read under the hold, so an upload that just finished is seen.
    const [rows, items] = await Promise.all([labelRows, readAttachments(host)]);
    const { folders, allowConfidential } = gates(rows, host.bundle);
    const tree = folderTree(
      folders,
      items.map((a) => ({ folder: a.sec_obj_ref_type })),
    );
    if (!folderPaths(tree).includes(folder))
      throw new AppError(
        "BAD_REQUEST",
        "Choose one of the record's folders.",
        400,
      );
    // One object per name per folder: storing a taken name would overwrite another attachment's bytes.
    if (items.some((a) => a.file_location === stored))
      throw new AppError(
        "BAD_REQUEST",
        "A file with this name is already attached",
        409,
      );
    await oicUpload(stored, file.bytes);
    const type = /^[\w.+-]{1,60}\/[\w.+-]{1,80}$/.test(file.type)
      ? file.type
      : "";
    // The legacy body's keys (FilePickerSelectChain + insertAttachmentActionChain), less the UI-only display name.
    await recordAttachment({
      file_size: (file.bytes.byteLength / 1024).toFixed(1),
      file_type: type,
      file_location: stored,
      document_type: type,
      file_name: recordedName(file.name),
      description,
      obj_ref_id: Number(host.objectId),
      obj_ref_type: host.objectType,
      sec_obj_ref_id: Number(host.objectId),
      sec_obj_ref_type: filedIn,
      is_confidential: allowConfidential
        ? (fields.data.confidential ?? "N")
        : "N",
    });
    return { uploaded: true };
  });
}

async function owned(host: AttachmentHost, id: number) {
  const hit = (await readAttachments(host)).find((a) => a.document_id === id);
  if (!hit) throw new AppError("BAD_REQUEST", "The file was not found.", 404);
  return hit;
}
/** The stored bytes of one of the record's attachments. */
export async function downloadAttachment(q: URLSearchParams, id: number) {
  const host = await attachmentHost(q, "read");
  requireStorage();
  const a = await owned(host, id);
  const { bytes } = await oicDownload(a.file_location);
  return { bytes, fileName: withExtension(a.file_name, a.file_location) };
}
/** WRITES: removes the stored bytes, then the record; a storage failure stops before the record (D42). */
export async function deleteAttachment(q: URLSearchParams, id: number) {
  const host = await attachmentHost(q, "edit");
  requireStorage();
  const a = await owned(host, id);
  await oicDelete(a.file_location);
  await removeAttachment(a.document_id);
  return { deleted: true };
}

/** Links are a write only where the host's links row is on. */
async function linksHost(q: URLSearchParams, mode: Mode) {
  const [host, rows] = await Promise.all([
    attachmentHost(q, mode),
    resources(),
  ]);
  const { showLinks, allowConfidential } = gates(rows, host.bundle);
  if (!showLinks)
    throw new AppError("FORBIDDEN", "Links are not enabled here.", 403);
  return { host, allowConfidential };
}
export const linkInput = z
  .object({
    title: z.string().trim().min(1).max(200),
    url: z
      .string()
      .trim()
      .min(1)
      .max(2000)
      // A stored javascript: or data: link would run on click; http(s) or a bare address only.
      .refine(
        (u) => /^https?:\/\//i.test(u) || !/^[a-z][a-z0-9+.-]*:/i.test(u),
        "Use a web address (http or https).",
      ),
    confidential: z.enum(["Y", "N"]).optional(),
  })
  .strict();
const linkReply = z.object({
  link_id: z.coerce.number().int().positive().nullish(),
});
/** WRITES: adds an external link to the record. */
export async function addLink(q: URLSearchParams, raw: unknown) {
  const input = linkInput.safeParse(raw);
  if (!input.success)
    throw new AppError(
      "BAD_REQUEST",
      input.error.issues[0]?.message ?? "Invalid link.",
      400,
    );
  const { host, allowConfidential } = await linksHost(q, "edit");
  const body = {
    link_title: input.data.title,
    link_url: input.data.url,
    obj_ref_id: Number(host.objectId),
    obj_ref_type: host.objectType,
    is_confidential: allowConfidential ? (input.data.confidential ?? "N") : "N",
  };
  const reply = linkReply.safeParse(
    fixtureMode()
      ? (await import("@/test-support/attachments")).recordFixtureLink(body)
      : await attachments.addLink({ body }),
  );
  if (fixtureMode()) await invalidate(attachments.addLink.invalidates);
  return { linkId: reply.success ? (reply.data.link_id ?? null) : null };
}
/** WRITES: removes one of the record's links. */
export async function deleteLink(q: URLSearchParams, id: number) {
  const { host } = await linksHost(q, "edit");
  if (!(await readLinks(host)).some((l) => l.link_id === id))
    throw new AppError("BAD_REQUEST", "The link was not found.", 404);
  if (fixtureMode()) {
    (await import("@/test-support/attachments")).removeFixtureLink(id);
    await invalidate(attachments.removeLink.invalidates);
  } else await attachments.removeLink({ id });
  return { deleted: true };
}
