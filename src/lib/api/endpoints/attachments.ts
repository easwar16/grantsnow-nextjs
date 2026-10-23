"use client";
import type { AttachmentList } from "@/features/record/attachments/model";
import {
  OFFLINE,
  apiUrl,
  del,
  post,
  type ApiError,
  type ApiResult,
} from "../http";
import { endpoint } from "../hooks";

/**
 * A host record's Attachments panel (`/api/files`): the browser names only the host and record, as the server-built
 * `view.query` (`host=…&record=…`) carries them.
 */
const record = (query: string) =>
  Object.fromEntries(new URLSearchParams(query));
/** The record's documents and links. */
export const list = endpoint<string, AttachmentList>((query) => ({
  path: "/files",
  query: record(query),
}));
/** A stored file's bytes; the route streams them, so this is not a JSON call. */
export async function fileBytes(
  path: string,
  query: Parameters<typeof apiUrl>[1],
): Promise<ApiResult<Blob>> {
  let response: Response;
  try {
    response = await fetch(apiUrl(path, query), { cache: "no-store" });
  } catch {
    return { ok: false, error: OFFLINE };
  }
  if (response.ok) {
    try {
      return { ok: true, data: await response.blob() };
    } catch {
      return { ok: false, error: OFFLINE };
    }
  }
  let error = OFFLINE;
  try {
    error = ((await response.json()) as { error?: ApiError }).error ?? OFFLINE;
  } catch {
    // A non-JSON failure (proxy page) keeps the generic message.
  }
  return { ok: false, error };
}
export const documentBytes = (query: string, id: number) =>
  fileBytes(`/files/${id}`, record(query));
/** WRITES a document, multipart with its folder, description and confidential choice. */
export function uploadDocument(
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
  return post("/files", body, record(query));
}
export const deleteDocument = (query: string, id: number) =>
  del(`/files/${id}`, record(query));
export const addLink = (
  query: string,
  link: { title: string; url: string; confidential?: "Y" | "N" },
) => post("/files/links", link, record(query));
export const deleteLink = (query: string, id: number) =>
  del(`/files/links/${id}`, record(query));
