"use client";
import type { PayloadForm } from "@/features/record/dynamic-form/engine";
import type { DynamicFormData } from "@/features/record/dynamic-form/models";
import { del, get, post } from "../http";
import { fileBytes } from "./attachments";

/** A record's dynamic form and its files. Identity and the storage path are the server's; the browser names the record. */
export interface FormTarget {
  objectType: string;
  slot: string;
  parentId?: string;
  objectId?: string;
}
const target = (t: FormTarget) => ({
  objectType: t.objectType,
  slot: t.slot,
  parentId: t.parentId,
  objectId: t.objectId,
});
/** The form and its answers; the form supersedes its own reads, so this takes their abort signal. */
export const form = (t: FormTarget, signal?: AbortSignal) =>
  get<DynamicFormData>("/dynamic-form", target(t), signal);
/** WRITES the answers. */
export const save = (t: FormTarget, answers: PayloadForm[]) =>
  post("/dynamic-form", { target: t, answers });
/** WRITES a field's file; the new attachment's id. */
export function uploadFile(t: FormTarget, file: File) {
  const body = new FormData();
  body.set("file", file, file.name);
  return post<{ attachmentId: number }>("/files", body, target(t));
}
/** WRITES: removes a field's file (404 when it is already gone). */
export const deleteFile = (t: FormTarget, attachmentId: number) =>
  del(`/files/${attachmentId}`, target(t));
/** A field's stored file. */
export const fileOf = (t: FormTarget, attachmentId: number) =>
  fileBytes(`/files/${attachmentId}`, target(t));
