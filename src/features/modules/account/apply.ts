"use client";
import { account, isOffline } from "@/lib/api";
import { accessibilityKeys } from "./contracts";
import { themeVariables, type Theme } from "./themes";
/** GN-Angular applyTheme, on the app root the server styled: brand/background/text variables and the dark switch. */
export function applyTheme(theme: Theme) {
  const app = document.querySelector<HTMLElement>(".app");
  if (!app) return;
  for (const name of ["--gn-brand", "--gn-brand-deep", "--gn-bg", "--gn-text"])
    app.style.removeProperty(name);
  for (const [name, value] of Object.entries(themeVariables(theme)))
    app.style.setProperty(name, value);
  app.classList.toggle("dark", theme.dark);
}
/** `<key>-<value>` classes on <html>, as the original; globals.css styles the non-zero ones. */
export function applyAccessibility(values: Record<string, number>) {
  const html = document.documentElement;
  for (const key of accessibilityKeys) {
    for (const cls of [...html.classList])
      if (cls.startsWith(`${key}-`)) html.classList.remove(cls);
    html.classList.add(`${key}-${values[key] || 0}`);
  }
}
/** A failed save: "Saving isn't enabled" is information, anything else the persistent error toast. */
export function saveFailure(
  toast: {
    show: (severity: "info", summary: string) => void;
    error: (e: { message: string; action?: string }) => void;
  },
  error: { code?: string; message: string; action?: string },
) {
  if (error.code === "WRITES_DISABLED") toast.show("info", error.message);
  else toast.error(error);
}
/** Saves a settings change; a request that got no answer keeps this form's own failure text. */
export async function saveSettings(kind: string, changes: unknown) {
  const r = await account.save(kind, changes);
  return isOffline(r)
    ? {
        ok: false as const,
        error: { code: "UPSTREAM", message: "Settings could not be saved." },
      }
    : r;
}
