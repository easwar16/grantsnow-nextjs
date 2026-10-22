"use client";
import { createContext, useContext, useEffect } from "react";
import type { useInFlight } from "@/lib/use-in-flight";
import type { EoiTab, PageLock } from "./types";
import type { LeaveGuard } from "./unsaved";
/** The Application tab's save and cancel, run by the header's Save as draft / Cancel Edit. */
export interface ApplicationCommands {
  save: () => void;
  cancel: () => void;
}
/**
 * Per-record state the container shares with its tabs (GN-Angular EoiRecordState): the Application tab's edit mode,
 * the one record-level save (`run(…, RECORD_SAVE)`), the current tab's lock and the unsaved-changes guard.
 */
export interface RecordState {
  editing: boolean;
  setEditing: (on: boolean) => void;
  run: ReturnType<typeof useInFlight>["run"];
  isActive: ReturnType<typeof useInFlight>["isActive"];
  setLock: (tab: EoiTab, lock: PageLock) => void;
  setGuard: (guard: LeaveGuard | null) => void;
  setApplication: (commands: ApplicationCommands | null) => void;
  /** Navigates without asking: after a save, the form has nothing left to lose. */
  navigate: (href: string, replace?: boolean) => void;
}
/** The record-level save: Create / Save, Save as draft, Cancel Edit and a form tab's Submit wait for each other. */
export const RECORD_SAVE = "record";
export const RecordContext = createContext<RecordState | null>(null);
export function useRecord() {
  const state = useContext(RecordContext);
  if (!state) throw new Error("useRecord needs the EOI record container.");
  return state;
}
/** Tells the container the current tab's lock (read on the server with the tab). */
export function TabLock({ tab, lock }: { tab: EoiTab; lock: PageLock }) {
  const { setLock } = useRecord();
  useEffect(() => setLock(tab, lock), [setLock, tab, lock]);
  return null;
}
