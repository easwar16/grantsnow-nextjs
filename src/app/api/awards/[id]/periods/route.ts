import { readText } from "@/server/http/body";
import { ZodError } from "zod";
import { savePeriod } from "@/server/modules/awards/record/header";
import { route } from "@/server/http/route";
import { AppError } from "@/lib/errors";
const MAX_BODY = 32 * 1024;
type Context = { params: Promise<{ id: string }> };
/** WRITES: one award period; the record's rules decide on the server. */
export const POST = route<Context>(
  async (request, context) => {
    const { id } = await context.params;
    return savePeriod(id, JSON.parse(await readText(request, MAX_BODY)));
  },
  {
    write: true,
    onError: (e) =>
      e instanceof ZodError || e instanceof SyntaxError
        ? new AppError("BAD_REQUEST", "Invalid request.", 400)
        : e,
  },
);
