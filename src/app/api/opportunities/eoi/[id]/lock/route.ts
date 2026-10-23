import { ZodError } from "zod";
import { eoiSetFinalized } from "@/server/modules/opportunities/record";
import { route } from "@/server/http/route";
import { AppError } from "@/lib/errors";
const MAX_BODY = 1024;
type Context = { params: Promise<{ id: string }> };
/** Finalize / unlock the tab's page (WRITES); the record's own rules decide, not the switch. */
export const POST = route<Context>(
  async (request, context) => {
    const { id } = await context.params;
    const text = await request.text();
    if (text.length > MAX_BODY)
      throw new AppError("BAD_REQUEST", "Request is too large.", 400);
    return eoiSetFinalized(id, JSON.parse(text));
  },
  {
    write: true,
    onError: (e) =>
      e instanceof ZodError || e instanceof SyntaxError
        ? new AppError("BAD_REQUEST", "Invalid finalize request.", 400)
        : e,
  },
);
