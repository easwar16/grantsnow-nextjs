"use client";
import type {
  AccountData,
  DigitalPresence,
} from "@/features/modules/account/contracts";
import { post } from "../http";
import { endpoint } from "../hooks";

/** The settings panel's data: `profile`, `preferences` or `accessibility` (read fresh, as these panels edit it). */
export const settings = endpoint<string, AccountData>((panel) => ({
  path: "/account",
  query: { panel },
}));
/** The profile's five links. */
export const presence = endpoint<void, DigitalPresence>(() => ({
  path: "/account",
  query: { panel: "presence" },
}));
/** The people of one organisation a proxy may be picked from. */
export const proxyPeople = endpoint<string, { id: string; name: string }[]>(
  (organization) => ({ path: "/account", query: { organization } }),
);
/** WRITES: one settings change (`dashboard`, `research`, `status` or `presence`). */
export const save = (kind: string, changes: unknown) =>
  post<{ saved: true }>("/account", { kind, changes });
