"use client";
import { apiUrl, call, type ApiError } from "../http";

/** The keep-alive's session calls (D37); the server reads the sealed cookie, the browser sends nothing. */
type Expiry = { expiresAt?: unknown };
/** The local session's expiry. */
export const expiry = (signal?: AbortSignal) =>
  call<Expiry>("GET", apiUrl("/auth/session"), undefined, signal);
/** Extends the token and answers its new expiry. */
export const renew = (signal?: AbortSignal) =>
  call<Expiry>("POST", apiUrl("/auth/renew"), undefined, signal);
/** A 401 from the routes: no session, or one that has expired. */
export const signedOut = (e: ApiError) =>
  e.code === "UNAUTHENTICATED" || e.code === "EXPIRED";
// ponytail: matches the http layer's transport-failure answer by its text until http.ts exports it.
/** The request never got a route's answer (network, abort or an unreadable body). */
export const offline = (e: ApiError) =>
  e.code === "UPSTREAM" &&
  e.message === "The request could not be completed. Please retry.";
