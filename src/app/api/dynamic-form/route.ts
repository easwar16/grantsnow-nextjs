import { json, failure } from "@/server/api/http";
import { sameOrigin } from "@/lib/security";
import { appOrigin } from "@/server/configuration/environment";
import { AppError } from "@/lib/errors";
import { targetFromQuery } from "@/server/dynamic-form/access";
import { loadForm, saveForm } from "@/server/dynamic-form/service";
// Answers with rich text and grids; far below this in practice.
const MAX_BODY = 1_048_576;
/** The form and its answers: ?objectType&slot&parentId&objectId. */
export async function GET(request: Request) {
  try {
    return json(
      await loadForm(targetFromQuery(new URL(request.url).searchParams)),
    );
  } catch (e) {
    return failure(e);
  }
}
/** WRITES the answers: { target: { objectType, slot, parentId?, objectId }, answers }. */
export async function POST(request: Request) {
  try {
    sameOrigin(request, appOrigin());
    if (Number(request.headers.get("content-length") || 0) > MAX_BODY)
      throw new AppError("BAD_REQUEST", "Request is too large.", 413);
    const text = await request.text();
    if (text.length > MAX_BODY)
      throw new AppError("BAD_REQUEST", "Request is too large.", 413);
    let body: unknown;
    try {
      body = JSON.parse(text);
    } catch {
      throw new AppError("BAD_REQUEST", "Invalid form request.", 400);
    }
    return json(await saveForm(body));
  } catch (e) {
    return failure(e);
  }
}
