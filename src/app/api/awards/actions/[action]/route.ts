import { readText } from "@/server/http/body";
import { ZodError } from "zod";
import {
  advancedSetup,
  awardLinks,
  cloneAward,
  cloneSetup,
  createAward,
  createSetup,
  linkAward,
} from "@/server/modules/awards/actions";
import { route, searchOf } from "@/server/http/route";
import { AppError } from "@/lib/errors";
// A few ids and the create form's text.
const MAX_BODY = 32768;
const invalid = (e: unknown) =>
  e instanceof ZodError
    ? new AppError("BAD_REQUEST", "Invalid award action.", 400)
    : e;
const reads: Record<string, (q: URLSearchParams) => Promise<unknown>> = {
  create: () => createSetup(),
  clone: (q) => cloneSetup(q),
  links: (q) => awardLinks(q),
  advanced: () => advancedSetup(),
};
const writes: Record<string, (body: unknown) => Promise<unknown>> = {
  create: createAward,
  clone: cloneAward,
  link: linkAward,
};
type Context = { params: Promise<{ action: string }> };
/** The listing's dialog setups: ?awardId for clone and links. */
export const GET = route<Context>(
  async (request, { params }) => {
    const { action } = await params;
    const read = Object.hasOwn(reads, action) ? reads[action] : undefined;
    if (!read) throw new AppError("BAD_REQUEST", "Unknown action.", 400);
    return read(searchOf(request));
  },
  { onError: invalid },
);
/** WRITES: create, clone or link an award. */
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
      throw new AppError("BAD_REQUEST", "Invalid award action.", 400);
    }
    return write(body);
  },
  { write: true, onError: invalid },
);
