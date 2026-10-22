"use client";
import { createContext, useContext } from "react";
import type { ShellLabels } from "@/features/account/shell-labels";
import type { FormatSettings } from "@/lib/format";
interface Shell {
  labels: ShellLabels;
  format?: FormatSettings;
}
const ShellContext = createContext<Shell | null>(null);
export const ShellProvider = ShellContext.Provider;
/** The shell's RB texts and display format, resolved on the server by the authenticated layout. */
export function useShell() {
  const shell = useContext(ShellContext);
  if (!shell) throw new Error("useShell outside the authenticated shell");
  return shell;
}
