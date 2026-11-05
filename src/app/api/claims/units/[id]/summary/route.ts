import { readText } from "@/server/http/body";
import { route } from "@/server/http/route";
import { AppError } from "@/lib/errors";
import { saveAppSummary } from "@/server/modules/claims/units/record/summary";

type Context = { params: Promise<{ id: string }> };
/** WRITES: the Summary's Save (the people and sign-off fields). */
export const POST = route<Context>(
  async (request, { params }) => {
    let body: unknown;
    try {
      body = JSON.parse(await readText(request, 16384));
    } catch {
      throw new AppError("BAD_REQUEST", "Invalid summary.", 400);
    }
    return saveAppSummary((await params).id, body);
  },
  { write: true },
);
