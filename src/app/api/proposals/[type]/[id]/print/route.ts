import { functions } from "@/lib/functions";
import { ZodError } from "zod";
import { AppError } from "@/lib/errors";
import { readText } from "@/server/http/body";
import { failure } from "@/server/http/response";
import { asWrite } from "@/server/oracle/scope";
import { appOrigin } from "@/server/platform/configuration/environment";
import { printProposal } from "@/server/modules/proposals/print";

type Context = { params: Promise<{ type: string; id: string }> };
export async function POST(request: Request, context: Context) {
  try {
    functions.security.sameOrigin(request, appOrigin());
    const { type, id } = await context.params;
    const input = JSON.parse(await readText(request, 1024));
    const file = await asWrite(() => printProposal(type, id, input));
    return new Response(new Blob([Uint8Array.from(file.bytes)]), {
      headers: {
        "Content-Type": file.mime,
        "Content-Disposition": `attachment; filename="${file.filename}"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    return failure(
      error instanceof ZodError || error instanceof SyntaxError
        ? new AppError("BAD_REQUEST", "Invalid print request.", 400)
        : error,
    );
  }
}
