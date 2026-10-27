"use client";
/**
 * The browser's single entry point to this app's API: one module per area, each a set of endpoints (for `useApi` /
 * `usePagedApi`) and write functions. Components call these with parameters and never build `/api` URLs.
 */
export * as objects from "./endpoints/objects";
export * as chatbot from "./endpoints/chatbot";
export * as proposals from "./endpoints/proposals";
export * as session from "./endpoints/session";
export * as opportunities from "./endpoints/opportunities";
export * as eoi from "./endpoints/eoi";
export * as awards from "./endpoints/awards";
export * as home from "./endpoints/home";
export * as account from "./endpoints/account";
export * as notifications from "./endpoints/notifications";
export * as approvals from "./endpoints/approvals";
export * as attachments from "./endpoints/attachments";
export * as dynamicForm from "./endpoints/dynamic-form";
export * as attributes from "./endpoints/attributes";
export * as fxRates from "./endpoints/fx-rates";
export * as contracts from "./endpoints/contracts";
export { useApi, usePagedApi, useForget } from "./hooks";
export type { Endpoint } from "./hooks";
export type { ApiError, ApiResult } from "./http";
export { isOffline } from "./http";
