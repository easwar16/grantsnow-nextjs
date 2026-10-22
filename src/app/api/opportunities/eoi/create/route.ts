import { ZodError } from "zod";
import { createEoiApplication } from "@/server/opportunities/record";
import { json, failure } from "@/server/api/http";
import { sameOrigin } from "@/lib/security";
import { appOrigin } from "@/server/configuration/environment";
import { AppError } from "@/lib/errors";
const MAX_BODY = 1024;
/** Create (WRITES): inserts the application once its form has validated; the browser sends only the opportunity id. */
export async function POST(request: Request) {
  try {
    sameOrigin(request, appOrigin());
    const text = await request.text();
    if (text.length > MAX_BODY)
      throw new AppError("BAD_REQUEST", "Request is too large.", 400);
    return json(await createEoiApplication(JSON.parse(text)));
  } catch (e) {
    return failure(
      e instanceof ZodError || e instanceof SyntaxError
        ? new AppError("BAD_REQUEST", "Invalid application request.", 400)
        : e,
    );
  }
}
