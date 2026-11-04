import { readText } from "@/server/http/body";
import { fileRoute } from "@/server/http/route";
import { AppError } from "@/lib/errors";
import { exportStakeholders } from "@/server/modules/claims/units/record/sign-off";

type Context = { params: Promise<{ id: string }> };
/** WRITES (generate-report): the stakeholder list or its sign-in sheet (`{ report: "list" | "sign-in" }`). */
export const POST = fileRoute<Context>(
  async (request, { params }) => {
    let body: { report?: unknown };
    try {
      body = JSON.parse(await readText(request, 1024));
    } catch {
      throw new AppError("BAD_REQUEST", "Invalid export.", 400);
    }
    return exportStakeholders((await params).id, body.report);
  },
  { write: true },
);
