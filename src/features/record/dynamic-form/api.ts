import type { PayloadForm } from "./engine";
import { dynamicForm, type ApiError, type ApiResult } from "@/lib/api";
/** The form's same-origin routes. Identity and the storage path are the server's; the browser names only the record. */
import type { FormTarget as FormTargetQuery } from "@/lib/api/endpoints/dynamic-form";
export type { ApiError, FormTargetQuery };
export class RequestFailed extends Error {
  constructor(
    readonly error: ApiError,
    readonly status = 0,
  ) {
    super(error.message);
  }
}
/** The form's calls throw on failure, as its load and save flows expect. */
async function data<T>(result: Promise<ApiResult<T>>) {
  const r = await result;
  if (!r.ok) throw new RequestFailed(r.error, r.error.status);
  return r.data;
}
export const loadFormData = (t: FormTargetQuery, signal?: AbortSignal) =>
  data(dynamicForm.form(t, signal));
export async function saveAnswers(t: FormTargetQuery, answers: PayloadForm[]) {
  await data(dynamicForm.save(t, answers));
}
export async function uploadFormFile(t: FormTargetQuery, file: File) {
  return (await data(dynamicForm.uploadFile(t, file))).attachmentId;
}
export async function deleteFormFile(t: FormTargetQuery, attachmentId: number) {
  await data(dynamicForm.deleteFile(t, attachmentId));
}
export const downloadFormFile = (t: FormTargetQuery, attachmentId: number) =>
  data(dynamicForm.fileOf(t, attachmentId));
/** Saves a blob under a file name (the original's downloadFile). */
export function saveBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const link = Object.assign(document.createElement("a"), {
    href: url,
    download: fileName,
  });
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
