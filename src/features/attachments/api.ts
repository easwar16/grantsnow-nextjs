"use client";
import type { StoreError } from "@/lib/app-store";
export { saveBlob } from "@/features/dynamic-form/api";
/** The panel's same-origin routes; the browser names only the host and record (`view.query`). */
const OFFLINE: StoreError = {
  code: "UPSTREAM",
  message: "The request could not be completed. Please retry.",
};
export class AttachmentRequestFailed extends Error {
  constructor(readonly error: StoreError) {
    super(error.message);
  }
}
async function send(url: string, init: RequestInit = {}) {
  let response: Response;
  try {
    response = await fetch(url, { cache: "no-store", ...init });
  } catch {
    throw new AttachmentRequestFailed(OFFLINE);
  }
  if (response.ok) return response;
  let error = OFFLINE;
  try {
    error =
      ((await response.json()) as { error?: StoreError }).error ?? OFFLINE;
  } catch {
    // A non-JSON failure (proxy page) keeps the generic message.
  }
  throw new AttachmentRequestFailed(error);
}
export const listUrl = (query: string) => `/api/files?${query}`;
export async function uploadDocument(
  query: string,
  file: File,
  fields: {
    folder: string;
    newFolder: string;
    description: string;
    confidential?: "Y" | "N";
  },
) {
  const body = new FormData();
  body.set("file", file, file.name);
  body.set("folder", fields.folder);
  if (fields.newFolder !== "") body.set("newFolder", fields.newFolder);
  body.set("description", fields.description);
  if (fields.confidential) body.set("confidential", fields.confidential);
  await send(listUrl(query), { method: "POST", body });
}
export async function documentBytes(query: string, id: number) {
  return (await send(`/api/files/${id}?${query}`)).blob();
}
export async function deleteDocument(query: string, id: number) {
  await send(`/api/files/${id}?${query}`, { method: "DELETE" });
}
export async function addLink(
  query: string,
  link: { title: string; url: string; confidential?: "Y" | "N" },
) {
  await send(`/api/files/links?${query}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(link),
  });
}
export async function deleteLink(query: string, id: number) {
  await send(`/api/files/links/${id}?${query}`, { method: "DELETE" });
}
