import { ZodError } from "zod";
import { readText } from "@/server/http/body";
import { route, searchOf } from "@/server/http/route";
import { AppError } from "@/lib/errors";
import {
  createEthics,
  deletedEthics,
  ethicsCreateForm,
  ethicsCreateSetup,
  restoreEthics,
} from "@/server/modules/ethics/actions";
// The create form's text and a few ids.
const MAX_BODY = 32768;
const invalid = (e: unknown) =>
  e instanceof ZodError
    ? new AppError("BAD_REQUEST", "Invalid ethics action.", 400)
    : e;
const reads: Record<string, (q: URLSearchParams) => Promise<unknown>> = {
  create: () => ethicsCreateSetup(),
  form: (q) => ethicsCreateForm(q.get("formType") ?? ""),
  recycle: () => deletedEthics(),
};
const writes: Record<string, (body: unknown) => Promise<unknown>> = {
  create: createEthics,
  restore: restoreEthics,
};
type Context = { params: Promise<{ action: string }> };
/** The listing's setups: the New form's choices and form metadata, the recycle bin. */
export const GET = route<Context>(
  async (request, { params }) => {
    const { action } = await params;
    const read = Object.hasOwn(reads, action) ? reads[action] : undefined;
    if (!read) throw new AppError("BAD_REQUEST", "Unknown action.", 400);
    return read(searchOf(request));
  },
  { onError: invalid },
);
/** WRITES: create a draft, restore from the recycle bin. */
export const POST = route<Context>(
  async (request, { params }) => {
    const { action } = await params;
    const write = Object.hasOwn(writes, action) ? writes[action] : undefined;
    if (!write) throw new AppError("BAD_REQUEST", "Unknown action.", 400);
    let body: unknown;
    try {
      body = JSON.parse(await readText(request, MAX_BODY));
    } catch {
      throw new AppError("BAD_REQUEST", "Invalid ethics action.", 400);
    }
    return write(body);
  },
  { write: true, onError: invalid },
);
