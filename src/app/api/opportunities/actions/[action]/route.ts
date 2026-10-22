import { ZodError } from "zod";
import {
  apply,
  convert,
  convertDialog,
  orgUnitChoices,
  saveNotes,
  setBookmark,
  share,
  shareDialog,
  shareValues,
} from "@/server/opportunities/actions";
import { json, failure } from "@/server/api/http";
import { sameOrigin } from "@/lib/security";
import { appOrigin } from "@/server/configuration/environment";
import { AppError } from "@/lib/errors";
// Notes are rich text; everything else is a few ids.
const MAX_BODY = 131072;
const invalid = (e: unknown) =>
  e instanceof ZodError
    ? new AppError("BAD_REQUEST", "Invalid opportunity action.", 400)
    : e;
const reads: Record<string, (q: URLSearchParams) => Promise<unknown>> = {
  share: () => shareDialog(),
  "share-values": (q) => shareValues(q.get("type") ?? ""),
  convert: (q) => convertDialog(q),
  "org-units": (q) => orgUnitChoices(q.get("personId") ?? ""),
};
const writes: Record<string, (body: unknown) => Promise<unknown>> = {
  bookmark: setBookmark,
  notes: saveNotes,
  share,
  apply,
  convert,
};
export async function GET(
  request: Request,
  { params }: { params: Promise<{ action: string }> },
) {
  try {
    const { action } = await params;
    const read = Object.hasOwn(reads, action) ? reads[action] : undefined;
    if (!read) throw new AppError("BAD_REQUEST", "Unknown action.", 400);
    return json(await read(new URL(request.url).searchParams));
  } catch (e) {
    return failure(invalid(e));
  }
}
export async function POST(
  request: Request,
  { params }: { params: Promise<{ action: string }> },
) {
  try {
    sameOrigin(request, appOrigin());
    const { action } = await params;
    const write = Object.hasOwn(writes, action) ? writes[action] : undefined;
    if (!write) throw new AppError("BAD_REQUEST", "Unknown action.", 400);
    if (Number(request.headers.get("content-length") || 0) > MAX_BODY)
      throw new AppError("BAD_REQUEST", "Request is too large.", 400);
    const text = await request.text();
    if (text.length > MAX_BODY)
      throw new AppError("BAD_REQUEST", "Request is too large.", 400);
    let body: unknown;
    try {
      body = JSON.parse(text);
    } catch {
      throw new AppError("BAD_REQUEST", "Invalid opportunity action.", 400);
    }
    return json(await write(body));
  } catch (e) {
    return failure(invalid(e));
  }
}
