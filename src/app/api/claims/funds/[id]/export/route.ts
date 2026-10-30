import { readText } from "@/server/http/body";
import { fileRoute } from "@/server/http/route";
import { AppError } from "@/lib/errors";
import { exportFund } from "@/server/modules/claims/funds/record/export";

type Context = { params: Promise<{ id: string }> };
/** WRITES (generate-report): the fund record's report for its current tab and filters. */
export const POST = fileRoute<Context>(
  async (request, { params }) => {
    const { id } = await params;
    let body: unknown;
    try {
      body = JSON.parse(await readText(request, 2048));
    } catch {
      throw new AppError("BAD_REQUEST", "Invalid export request.", 400);
    }
    return exportFund(id, body);
  },
  { write: true },
);
