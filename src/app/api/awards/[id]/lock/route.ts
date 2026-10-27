import { readText } from "@/server/http/body";
import { ZodError } from "zod";
import { awardSetFinalized } from "@/server/modules/awards/record";
import { route } from "@/server/http/route";
import { AppError } from "@/lib/errors";
const MAX_BODY = 1024;
type Context = { params: Promise<{ id: string }> };
/** Finalize / unlock the tab's page (WRITES); the record's own rules decide, not the switch. */
export const POST = route<Context>(
  async (request, context) => {
    const { id } = await context.params;
    const text = await readText(request, MAX_BODY);
    return awardSetFinalized(id, JSON.parse(text));
  },
  {
    write: true,
    onError: (e) =>
      e instanceof ZodError || e instanceof SyntaxError
        ? new AppError("BAD_REQUEST", "Invalid finalize request.", 400)
        : e,
  },
);
