import { AppError } from "@/lib/errors";
import { addLink } from "@/server/record/attachments/attachments";
import { route, searchOf } from "@/server/http/route";
import { readText } from "@/server/http/body";
// A title and a URL.
const MAX_BODY = 16 * 1024;
/** WRITES: adds an external link to a host record: POST ?host&record, JSON `{ title, url, confidential? }`. */
export const POST = route(
  async (request) => {
    let body: unknown;
    try {
      body = JSON.parse(await readText(request, MAX_BODY));
    } catch (e) {
      if (e instanceof AppError) throw e;
      throw new AppError("BAD_REQUEST", "Invalid link.", 400);
    }
    return addLink(searchOf(request), body);
  },
  { write: true },
);
