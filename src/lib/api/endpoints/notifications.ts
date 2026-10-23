"use client";
import type { Bell } from "@/server/modules/notifications/service";
import { post } from "../http";
import { endpoint } from "../hooks";

/** The header bell: unread count and the latest five. */
export const bell = endpoint<void, Bell>(() => ({ path: "/notifications" }));
/** WRITES: marks the user's unread notifications read (the server resolves the ids). */
export const markAllRead = () => post<{ marked: number }>("/notifications");
