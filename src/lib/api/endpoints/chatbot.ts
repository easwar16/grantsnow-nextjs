"use client";
import { apiUrl, call } from "../http";

/** One answer from the assistant: sanitised HTML and its quick replies. */
export type Answer = { html?: unknown; options?: unknown };
/** One question to the assistant (the server adds the session token). */
export const ask = (question: string, signal?: AbortSignal) =>
  call<Answer>("POST", apiUrl("/chatbot"), { question }, signal);
