"use client";
import { createContext, useContext } from "react";
import type { ShellLabels } from "@/features/modules/account/shell-labels";
import type { FormatSettings } from "@/lib/format";
/** The signed-in user as the browser may know them: display fields and module access, never tokens or legal_id. */
export interface ShellUser {
  name: string;
  organization: string;
  organizationId: string;
  modules: Record<string, boolean>;
}
interface Shell {
  labels: ShellLabels;
  format?: FormatSettings;
  user?: ShellUser;
}
const ShellContext = createContext<Shell | null>(null);
export const ShellProvider = ShellContext.Provider;
/** The shell's RB texts and display format, resolved on the server by the authenticated layout. */
export function useShell() {
  const shell = useContext(ShellContext);
  if (!shell) throw new Error("useShell outside the authenticated shell");
  return shell;
}
/** The shell, or null outside it (tests and the public pages). */
export function useShellOptional() {
  return useContext(ShellContext);
}
/** The signed-in user's display model, or undefined outside the shell. */
export function useCurrentUser() {
  return useShellOptional()?.user;
}
/** The configured display format, or undefined outside the shell (its default formats then apply). */
export function useFormat() {
  return useShellOptional()?.format;
}
