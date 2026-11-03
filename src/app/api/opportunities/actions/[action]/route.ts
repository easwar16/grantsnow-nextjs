import { readText } from "@/server/http/body";
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
} from "@/server/modules/opportunities/actions";
import { route, searchOf } from "@/server/http/route";
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
type Context = { params: Promise<{ action: string }> };
export const GET = route<Context>(
  async (request, { params }) => {
    const { action } = await params;
    const read = Object.hasOwn(reads, action) ? reads[action] : undefined;
    if (!read) throw new AppError("BAD_REQUEST", "Unknown action.", 400);
    return read(searchOf(request));
  },
  { onError: invalid },
);
export const POST = route<Context>(
  async (request, { params }) => {
    const { action } = await params;
    const write = Object.hasOwn(writes, action) ? writes[action] : undefined;
    if (!write) throw new AppError("BAD_REQUEST", "Unknown action.", 400);
    const text = await readText(request, MAX_BODY);
    let body: unknown;
    try {
      body = JSON.parse(text);
    } catch {
      throw new AppError("BAD_REQUEST", "Invalid opportunity action.", 400);
    }
    return write(body);
  },
  { write: true, onError: invalid },
);
