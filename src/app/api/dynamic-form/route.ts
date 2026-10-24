import { readText } from "@/server/http/body";
import { AppError } from "@/lib/errors";
import { targetFromQuery } from "@/server/record/dynamic-form/access";
import { loadForm, saveForm } from "@/server/record/dynamic-form/service";
import { route, searchOf } from "@/server/http/route";
// Answers with rich text and grids; far below this in practice.
const MAX_BODY = 1_048_576;
/** The form and its answers: ?objectType&slot&parentId&objectId. */
export const GET = route((request) =>
  loadForm(targetFromQuery(searchOf(request))),
);
/** WRITES the answers: { target: { objectType, slot, parentId?, objectId }, answers }. */
export const POST = route(
  async (request) => {
    const text = await readText(request, MAX_BODY);
    let body: unknown;
    try {
      body = JSON.parse(text);
    } catch {
      throw new AppError("BAD_REQUEST", "Invalid form request.", 400);
    }
    return saveForm(body);
  },
  { write: true },
);
