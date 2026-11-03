import { readText } from "@/server/http/body";
import { ZodError } from "zod";
import { createEoiApplication } from "@/server/modules/opportunities/record";
import { route } from "@/server/http/route";
import { AppError } from "@/lib/errors";
const MAX_BODY = 1024;
/** Create (WRITES): inserts the application once its form has validated; the browser sends only the opportunity id. */
export const POST = route(
  async (request) => {
    const text = await readText(request, MAX_BODY);
    return createEoiApplication(JSON.parse(text));
  },
  {
    write: true,
    onError: (e) =>
      e instanceof ZodError || e instanceof SyntaxError
        ? new AppError("BAD_REQUEST", "Invalid application request.", 400)
        : e,
  },
);
