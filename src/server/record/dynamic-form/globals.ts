import "server-only";
import { cache } from "react";
import { authenticate } from "@/server/identity/session/service";
import {
  formattingSettings,
  globalVariables,
  type GlobalVariable,
} from "@/server/platform/configuration/formatting";
import { acceptOf, maxMbOf } from "@/features/record/dynamic-form/engine";
/** The global variables forms and files depend on (the original's `getGlobalVar`). */
export function formSettings(items: GlobalVariable[]) {
  const value = (key: string) =>
    items.find((r) => r.var_key === key)?.var_value;
  const instance = String(value("INSTANCE") ?? "")
    .trim()
    .toUpperCase();
  return {
    decimals: formattingSettings(items).decimals ?? 2,
    maxMb: maxMbOf(value("DEFAULT_SIZE_FORMAT")),
    accept: acceptOf(value("ALLOWED_EXTENSIONS")),
    // The storage path's first folder; a missing one stops uploads rather than writing a bad path.
    instance: /^[A-Z0-9_-]{1,40}$/.test(instance) ? instance : null,
  };
}
export const formGlobals = cache(async () =>
  formSettings(await globalVariables((await authenticate()).session.token)),
);
