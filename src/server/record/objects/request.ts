import "server-only";
import { readText } from "@/server/http/body";
import { ZodError } from "zod";
import { AppError } from "@/lib/errors";
// A 2500-character comment with markup and mentions, with room for a larger configured limit.
const MAX_BODY = 64 * 1024;
/** A comment write's JSON body, capped; parse failures surface through `badComment`. */
export async function commentBody(request: Request) {
  const text = await readText(request, MAX_BODY);
  return JSON.parse(text) as unknown;
}
export const badComment = (e: unknown) =>
  e instanceof ZodError || e instanceof SyntaxError
    ? new AppError("BAD_REQUEST", "Invalid comment request.", 400)
    : e;
/** A comment id from the route segment. */
export function commentId(raw: string) {
  if (!/^[1-9]\d{0,14}$/.test(raw))
    throw new AppError("BAD_REQUEST", "Invalid comment.", 400);
  return Number(raw);
}
