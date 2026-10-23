"use client";
import type { FxEdit, FxMode, FxView } from "@/features/record/fx-rates/model";
import { post } from "../http";
import { endpoint } from "../hooks";

/** A proposal version's FX rates for its host tab's mode. */
export type FxTarget = {
  type: string;
  id: string;
  versionId: string;
  mode: FxMode;
};
export const rates = endpoint<FxTarget, FxView>((t) => ({
  path: "/fx-rates",
  query: { type: t.type, id: t.id, versionId: t.versionId, mode: t.mode },
}));
/** WRITES the edited rates; the answer is the rates as re-read after the save. */
export const save = (target: FxTarget, edits: FxEdit[]) =>
  post<FxView>("/fx-rates", { target, edits });
