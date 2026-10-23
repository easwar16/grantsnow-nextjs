import { json, failure } from "@/server/api/http";
import { sameOrigin } from "@/lib/security";
import { appOrigin } from "@/server/configuration/environment";
import { AppError } from "@/lib/errors";
import { addLink } from "@/server/files/attachments";
/** WRITES: adds an external link to a host record: POST ?host&record, JSON `{ title, url, confidential? }`. */
export async function POST(request: Request) {
  try {
    sameOrigin(request, appOrigin());
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      throw new AppError("BAD_REQUEST", "Invalid link.", 400);
    }
    return json(await addLink(new URL(request.url).searchParams, body));
  } catch (e) {
    return failure(e);
  }
}
