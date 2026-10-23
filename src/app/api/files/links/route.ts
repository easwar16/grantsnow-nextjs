import { AppError } from "@/lib/errors";
import { addLink } from "@/server/record/attachments/attachments";
import { route, searchOf } from "@/server/http/route";
/** WRITES: adds an external link to a host record: POST ?host&record, JSON `{ title, url, confidential? }`. */
export const POST = route(
  async (request) => {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      throw new AppError("BAD_REQUEST", "Invalid link.", 400);
    }
    return addLink(searchOf(request), body);
  },
  { write: true },
);
