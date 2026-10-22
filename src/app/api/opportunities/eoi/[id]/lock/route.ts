import { ZodError } from "zod";
import { eoiSetFinalized } from "@/server/opportunities/record";
import { json, failure } from "@/server/api/http";
import { sameOrigin } from "@/lib/security";
import { appOrigin } from "@/server/configuration/environment";
import { AppError } from "@/lib/errors";
const MAX_BODY = 1024;
/** Finalize / unlock the tab's page (WRITES); the record's own rules decide, not the switch. */
export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    sameOrigin(request, appOrigin());
    const { id } = await context.params;
    const text = await request.text();
    if (text.length > MAX_BODY)
      throw new AppError("BAD_REQUEST", "Request is too large.", 400);
    return json(await eoiSetFinalized(id, JSON.parse(text)));
  } catch (e) {
    return failure(
      e instanceof ZodError || e instanceof SyntaxError
        ? new AppError("BAD_REQUEST", "Invalid finalize request.", 400)
        : e,
    );
  }
}
