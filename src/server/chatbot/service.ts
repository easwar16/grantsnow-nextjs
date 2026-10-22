import "server-only";
import { cache } from "react";
import { JSDOM } from "jsdom";
import { z } from "zod";
import { AppError } from "@/lib/errors";
import { authenticate } from "@/server/session/service";
import { businessError } from "@/server/api/transport";
import { globalVariables } from "@/server/configuration/formatting";
import { sanitizeHtml } from "@/server/html/sanitize";

/** Answers from the model take seconds; a hung server must not hold the request. */
const TIMEOUT_MS = 60000;
const MAX_ANSWER_CHARS = 512 * 1024;
const unavailable = () =>
  new AppError(
    "UPSTREAM",
    "The GrantsNow assistant is unavailable. Please retry.",
  );

/**
 * The question travels in the `user-query` header (legacy GNchatBotActionchain), so it must be a
 * header-safe Latin-1 string: line breaks become spaces, other control characters are refused.
 */
export const question = z
  .string()
  .transform((q) => q.replace(/[\r\n\t]+/g, " ").trim())
  .pipe(
    z
      .string()
      .min(1, "Type a message.")
      .max(2000, "Keep the message under 2,000 characters.")
      .regex(
        /^[\x20-\x7e\xa0-\xff]*$/,
        "The assistant accepts Latin characters only.",
      ),
  );

/** `CHATBOT_URL` (legacy catalog `GrantsNowChatBotService`); unset or empty disables the chatbot. */
export function chatbotUrl(
  env: Record<string, string | undefined> = process.env,
) {
  const value = env.CHATBOT_URL?.trim();
  if (!value) return null;
  const url = new URL(value);
  if (
    !["http:", "https:"].includes(url.protocol) ||
    url.username ||
    url.password ||
    url.search ||
    url.hash
  )
    throw new Error("CHATBOT_URL must be an http(s) root without credentials.");
  return url;
}

/** Legacy shell shows the launcher only when global variable CHATBOT_ENABLED is 'Y'; anything else hides it. */
async function enabledFor(token: string) {
  return (await globalVariables(token)).some(
    (r) => r.var_key === "CHATBOT_ENABLED" && r.var_value === "Y",
  );
}
export const chatbotEnabled = cache(
  async () =>
    chatbotUrl() !== null && enabledFor((await authenticate()).session.token),
);

/**
 * Splits a raw answer into sanitized HTML and its quick replies: legacy wires each `<button>` in the
 * latest answer to send its text (assignEventListeners); the sanitizer drops buttons, so they come out first.
 */
export function toAnswer(raw: string) {
  const doc = new JSDOM(`<body>${raw}</body>`).window.document;
  const options = [...doc.body.querySelectorAll("button")].flatMap((b) => {
    const text = b.textContent?.replace(/\s+/g, " ").trim() ?? "";
    b.remove();
    return text ? [text] : [];
  });
  return { html: sanitizeHtml(doc.body.innerHTML), options };
}

const answerBody = z.object({ response: z.string() });

/** One question to `POST /query/` with the server-held session token, as legacy and GN-Angular send it. */
export async function askChatbot(text: string) {
  const { session } = await authenticate();
  const base = chatbotUrl();
  if (!base || !(await enabledFor(session.token)))
    throw new AppError(
      "FORBIDDEN",
      "The GrantsNow assistant isn't enabled.",
      403,
    );
  let response: Response;
  let body: unknown;
  try {
    // `/query` answers 307 to an absolute `/query/`; call it directly and never follow redirects.
    response = await fetch(new URL("query/", base.href.replace(/\/?$/, "/")), {
      method: "POST",
      headers: { token: session.token, "user-query": text },
      cache: "no-store",
      redirect: "error",
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    const raw = await response.text();
    if (raw.length > MAX_ANSWER_CHARS) throw unavailable();
    try {
      body = JSON.parse(raw);
    } catch {
      body = raw;
    }
  } catch {
    throw unavailable();
  }
  if (!response.ok) throw businessError(body) ?? unavailable();
  const parsed = answerBody.safeParse(body);
  if (!parsed.success)
    throw new AppError(
      "CONTRACT",
      "The GrantsNow assistant returned an unusable answer.",
    );
  return toAnswer(parsed.data.response);
}
