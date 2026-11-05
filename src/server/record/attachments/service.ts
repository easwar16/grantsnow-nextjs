import "server-only";
import { invalidate } from "@/server/oracle/client";
import { z } from "zod";
import { attachments } from "@/server/oracle/api";
import {
  oicConnected,
  oicDelete,
  oicDownload,
  exclusiveLocation,
  oicUpload,
} from "@/server/oic/connection";
import { fixtureMode } from "@/server/platform/configuration/environment";
import {
  authorizeForm,
  type FormTarget,
} from "@/server/record/dynamic-form/access";
import { formGlobals } from "@/server/record/dynamic-form/globals";
import { fileProblem } from "@/features/record/dynamic-form/engine";
import { AppError } from "@/lib/errors";

/**
 * Files of a record's form (port of GN-Angular FilesService, D43): attachment records in ORDS, bytes in Object Storage
 * through the OIC relay. The storage location is built here from the record and the session, never from the browser;
 * download and delete take an attachment id that must be in that record's attachment list.
 */
const RESPONDENT_TYPES = ["ETHICS", "DUE_DILIGENCE"];
export interface FileScope {
  objectType: string;
  /** `obj_ref_id`. */
  objectId: string;
  /** `sec_obj_ref_type`: the slot (`OPPORTUNITIES-EOI-DYNAMIC-FORM-1`) or `RESPONSES`. */
  secondaryType: string;
  /** The record's number, a folder in the storage path. */
  objectNumber: string;
}
/** Ethics / DD answers belong to a respondent and are filed under `RESPONSES`; every other form's under its slot. */
export function fileScopeOf(
  t: FormTarget,
  record: { id: string; number: string },
): FileScope {
  return {
    objectType: t.objectType,
    objectId: record.id,
    secondaryType: RESPONDENT_TYPES.includes(t.objectType)
      ? "RESPONSES"
      : t.slot,
    objectNumber: record.number,
  };
}
const FOLDER = /^[A-Za-z0-9_-]{1,80}$/;
/** INSTANCE/legalId/objectType/objectNumber/secondaryType/fileName; every folder checked, so no part can escape. */
export function storageLocation(
  instance: string | null,
  legalId: string | undefined,
  scope: FileScope,
  fileName: string,
) {
  const folders = [
    instance,
    legalId,
    scope.objectType,
    scope.objectNumber,
    scope.secondaryType,
  ];
  if (folders.some((f) => f === null || f === undefined || !FOLDER.test(f)))
    throw new AppError(
      "UPSTREAM",
      "File storage is not configured for this record.",
      503,
    );
  return [...folders, fileName].join("/");
}
/** A name that is safe as the last path part and inside a `name~~id` answer. */
export function fileNameProblem(name: string) {
  if (name.trim() === "" || name.length > 200)
    return "The file name is empty or too long.";
  if (
    /[/\\\u0000-\u001f]/.test(name) ||
    name.includes("~~") ||
    name === "." ||
    name === ".."
  )
    return "The file name can't contain slashes, '~~' or control characters.";
  return null;
}
export interface Attachment {
  id: number;
  fileName: string;
  location: string;
}
async function listAttachments(scope: FileScope): Promise<Attachment[]> {
  return (
    await attachments.list({
      objectId: scope.objectId,
      objectType: scope.objectType,
      secondaryType: scope.secondaryType,
    })
  ).map((a) => ({
    id: a.document_id,
    fileName: a.file_name,
    location: a.file_location,
  }));
}
export function requireStorage() {
  if (!oicConnected())
    throw new AppError(
      "UPSTREAM",
      "File storage is not connected in this environment.",
      503,
    );
}
/** The record and its scope, with read (download) or edit (upload, delete) on the form's page. */
async function scoped(t: FormTarget, mode: "read" | "edit") {
  const access = await authorizeForm(t, mode);
  if (access.record === null)
    throw new AppError("BAD_REQUEST", "Save the application first.", 400);
  requireStorage();
  return { ...access, scope: fileScopeOf(t, access.record) };
}
const recorded = z.object({
  attachment_id: z.coerce.number().int().positive().nullish(),
});
/** Fixture writes answer `{}`; the labelled development store stands in for the attachments table there. */
export async function recordAttachment(body: Record<string, unknown>) {
  if (fixtureMode()) {
    const row = (
      await import("@/test-support/attachments")
    ).recordFixtureAttachment(body);
    await invalidate(attachments.record.invalidates);
    return row;
  }
  return attachments.record({ body });
}
export async function removeAttachment(id: number) {
  if (fixtureMode()) {
    const done = (
      await import("@/test-support/attachments")
    ).removeFixtureAttachment(String(id));
    await invalidate(attachments.remove.invalidates);
    return done;
  }
  return attachments.remove({ id });
}
/** WRITES: stores the bytes, then the attachment record; the new attachment id. Limits checked again here. */
export async function uploadFile(
  t: FormTarget,
  file: { name: string; type: string; bytes: Uint8Array },
) {
  const { user, scope } = await scoped(t, "edit");
  return storeFile(scope, user.legalId, file);
}
/**
 * WRITES: stores a file under an already authorised scope (a form slot, a Claims meeting or org document), then its
 * attachment record; the new attachment id. Limits, name and duplicates are checked here.
 */
export async function storeFile(
  scope: FileScope,
  legalId: string | undefined,
  file: { name: string; type: string; bytes: Uint8Array },
) {
  requireStorage();
  const globals = await formGlobals();
  const problem =
    fileNameProblem(file.name) ??
    fileProblem(
      { name: file.name, size: file.bytes.byteLength },
      globals.maxMb,
      globals.accept,
    );
  if (problem) throw new AppError("BAD_REQUEST", problem, 400);
  const location = storageLocation(globals.instance, legalId, scope, file.name);
  return exclusiveLocation(location, async () => {
    // Read under the hold, so an upload that just finished is seen.
    // One object per name per record: storing a taken name would overwrite another attachment's bytes.
    if ((await listAttachments(scope)).some((a) => a.fileName === file.name))
      throw new AppError(
        "BAD_REQUEST",
        "A file with this name is already attached",
        409,
      );
    await oicUpload(location, file.bytes);
    const type = /^[\w.+-]{1,60}\/[\w.+-]{1,80}$/.test(file.type)
      ? file.type
      : "";
    const reply = recorded.safeParse(
      await recordAttachment({
        file_size: (file.bytes.byteLength / 1024).toFixed(1),
        file_type: type,
        file_name: file.name,
        file_location: location,
        document_type: type,
        obj_ref_type: scope.objectType,
        obj_ref_id: scope.objectId,
        sec_obj_ref_type: scope.secondaryType,
        sec_obj_ref_id: null,
      }),
    );
    if (
      !reply.success ||
      reply.data.attachment_id === null ||
      reply.data.attachment_id === undefined
    )
      throw new AppError(
        "CONTRACT",
        `${file.name} was stored but not recorded`,
      );
    return { attachmentId: reply.data.attachment_id };
  });
}
/** The stored bytes of one attachment in an already authorised scope. */
export async function scopedDownload(scope: FileScope, id: number) {
  requireStorage();
  const a = await owned(scope, id);
  const { bytes } = await oicDownload(a.location);
  return { bytes, fileName: a.fileName };
}
/** WRITES: removes one attachment (bytes, then record) in an already authorised scope. */
export async function scopedDelete(scope: FileScope, id: number) {
  requireStorage();
  const a = await owned(scope, id);
  await oicDelete(a.location);
  await removeAttachment(a.id);
  return { deleted: true };
}
async function owned(scope: FileScope, id: number) {
  const hit = (await listAttachments(scope)).find((a) => a.id === id);
  if (!hit) throw new AppError("BAD_REQUEST", "The file was not found.", 404);
  return hit;
}
/** The stored bytes of one of the record's attachments. */
export async function downloadFile(t: FormTarget, id: number) {
  const { scope } = await scoped(t, "read");
  const a = await owned(scope, id);
  const { bytes } = await oicDownload(a.location);
  return { bytes, fileName: a.fileName };
}
/** WRITES: removes the stored bytes, then the attachment record. */
export async function deleteFile(t: FormTarget, id: number) {
  const { scope } = await scoped(t, "edit");
  const a = await owned(scope, id);
  await oicDelete(a.location);
  await removeAttachment(a.id);
  return { deleted: true };
}
