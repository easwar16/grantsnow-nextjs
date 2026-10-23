"use client";
import type {
  AttributeHost,
  AttributesView,
} from "@/features/record/attributes/model";
import { endpoint } from "../hooks";

/** A host's object attribute fields; the values travel in the host's own save. */
export const fields = endpoint<
  { host: AttributeHost; parentId?: string; objectId?: string },
  AttributesView
>((p) => ({
  path: "/attributes",
  query: { host: p.host, parentId: p.parentId, objectId: p.objectId },
}));
