import "server-only";
/**
 * Every Oracle operation as a function, grouped by area: services call these with plain parameters (identity, caching,
 * paging and the writes gate are handled by the client). Import from here, never the connection.
 */
export * as comments from "./comments";
export * as people from "./people";
export * as proposals from "./proposals";
export * as roles from "./roles";
export * as objects from "./objects";
export * as approvals from "./approvals";
export * as attachments from "./attachments";
export * as dynamicForm from "./dynamic-form";
export * as ethics from "./ethics";
export * as dueDiligence from "./due-diligence";
export * as attributes from "./attributes";
export * as fxRates from "./fx-rates";
export * as opportunities from "./opportunities";
export * as eoi from "./eoi";
export * as awards from "./awards";
export * as contracts from "./contracts";
export * as lookups from "./lookups";
export * as configuration from "./configuration";
export * as account from "./account";
export * as notifications from "./notifications";
export * as home from "./home";
export * as reports from "./reports";
export * as claims from "./claims";
