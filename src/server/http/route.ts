import "server-only";
import { json, failure } from "@/server/http/response";
import { appOrigin } from "@/server/platform/configuration/environment";
import { asWrite } from "@/server/oracle/scope";
import { functions } from "@/lib/functions";

/**
 * One API route handler: the result as a private, uncached JSON reply, or its public error. A `write` route refuses a
 * cross-origin request before anything runs. `onError` may translate a failure first (for example a schema error
 * into the form's own message). Routes that stream a file keep their own handler.
 */
export function route<C = unknown>(
  handler: (request: Request, context: C) => Promise<unknown>,
  options: { write?: boolean; onError?: (e: unknown) => unknown } = {},
) {
  return async (request: Request, context?: C) => {
    try {
      if (!options.write) return json(await handler(request, context as C));
      functions.security.sameOrigin(request, appOrigin());
      // Inside a write, every Oracle read is fresh: a held copy never decides whether a write may go ahead.
      return json(await asWrite(() => handler(request, context as C)));
    } catch (e) {
      return failure(options.onError ? options.onError(e) : e);
    }
  };
}
/** The request's query, for handlers that read it. */
export const searchOf = (request: Request) => new URL(request.url).searchParams;
