import type { PayloadForm } from "./engine";
import type { DynamicFormData } from "./models";
/** The form's same-origin routes. Identity and the storage path are the server's; the browser names only the record. */
export interface FormTargetQuery {
  objectType: string;
  slot: string;
  parentId?: string;
  objectId?: string;
}
export type ApiError = { code: string; message: string; action?: string };
export class RequestFailed extends Error {
  constructor(
    readonly error: ApiError,
    readonly status = 0,
  ) {
    super(error.message);
  }
}
const OFFLINE: ApiError = {
  code: "UPSTREAM",
  message: "The request could not be completed. Please retry.",
};
const query = (t: FormTargetQuery) => {
  const q = new URLSearchParams({ objectType: t.objectType, slot: t.slot });
  if (t.parentId) q.set("parentId", t.parentId);
  if (t.objectId) q.set("objectId", t.objectId);
  return q.toString();
};
async function send(url: string, init: RequestInit = {}): Promise<Response> {
  let response: Response;
  try {
    response = await fetch(url, { cache: "no-store", ...init });
  } catch (e) {
    if (e instanceof DOMException && e.name === "AbortError") throw e;
    throw new RequestFailed(OFFLINE);
  }
  if (response.ok) return response;
  let error: ApiError = OFFLINE;
  try {
    error = ((await response.json()) as { error?: ApiError }).error ?? OFFLINE;
  } catch {
    // A non-JSON failure (proxy page) keeps the generic message.
  }
  throw new RequestFailed(error, response.status);
}
export async function loadFormData(t: FormTargetQuery, signal?: AbortSignal) {
  return (await (
    await send(`/api/dynamic-form?${query(t)}`, { signal })
  ).json()) as DynamicFormData;
}
export async function saveAnswers(t: FormTargetQuery, answers: PayloadForm[]) {
  await send("/api/dynamic-form", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ target: t, answers }),
  });
}
export async function uploadFormFile(t: FormTargetQuery, file: File) {
  const body = new FormData();
  body.set("file", file, file.name);
  const reply = (await (
    await send(`/api/files?${query(t)}`, { method: "POST", body })
  ).json()) as {
    attachmentId: number;
  };
  return reply.attachmentId;
}
export async function deleteFormFile(t: FormTargetQuery, attachmentId: number) {
  await send(`/api/files/${attachmentId}?${query(t)}`, { method: "DELETE" });
}
export async function downloadFormFile(
  t: FormTargetQuery,
  attachmentId: number,
) {
  return (await send(`/api/files/${attachmentId}?${query(t)}`)).blob();
}
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
