import { ZodError } from "zod";
import { readText } from "@/server/http/body";
import { createEoiApplication } from "@/server/modules/opportunities/record";
import { route } from "@/server/http/route";
import { AppError } from "@/lib/errors";
// The opportunity id and up to twenty attributes of 4000 characters each.
const MAX_BODY = 96 * 1024;
const writes: Record<string, (body: unknown) => Promise<unknown>> = {
  create: createEoiApplication,
};
type Context = { params: Promise<{ action: string }> };
/** WRITES: `create` inserts the application with its attributes once its form has validated. */
export const POST = route<Context>(
  async (request, { params }) => {
    const { action } = await params;
    const write = Object.hasOwn(writes, action) ? writes[action] : undefined;
    if (!write) throw new AppError("BAD_REQUEST", "Unknown action.", 400);
    let body: unknown;
    try {
      body = JSON.parse(await readText(request, MAX_BODY));
    } catch {
      throw new AppError("BAD_REQUEST", "Invalid application request.", 400);
    }
    return write(body);
  },
  {
    write: true,
    onError: (e) =>
      e instanceof ZodError
        ? new AppError("BAD_REQUEST", "Invalid application request.", 400)
        : e,
  },
);
