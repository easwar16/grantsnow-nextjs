"use client";
import type { CreatorCard } from "@/features/record/shell/creator-types";
import { endpoint } from "../hooks";
import { apiUrl } from "../http";

type Choice = { value: string; label: string };
/** The Contract summary's Created by card, read on open. */
export const creator = endpoint<{ id: string }, CreatorCard>(({ id }) => ({
  path: `/contracts/${id}/creator`,
}));
/** New Contract's templates and relation items for the picked type, relation and org unit. */
export const choices = endpoint<
  { contractType: string; relationType: string; orgId: string },
  { templates: Choice[]; items: Choice[] }
>((query) => ({ path: "/contracts/choices", query }));
/** New Contract's Assigned To people. */
export const assignees = endpoint<object, Choice[]>(() => ({
  path: "/contracts/assignees",
}));
/** A contract document download (placeholder tags, standard template, the active version); the route streams it. */
export const documentUrl = (
  id: string,
  kind: "tags" | "template" | "contract",
) => apiUrl(`/contracts/${id}/document`, { kind });
