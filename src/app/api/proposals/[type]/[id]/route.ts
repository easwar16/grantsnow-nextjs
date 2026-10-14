import { loadSummary } from "@/server/proposals/record";
import { recordIdentity } from "@/features/proposals/record";
import { json, failure } from "@/server/api/http";
import { AppError } from "@/lib/errors";
export async function GET(
  request: Request,
  { params }: { params: Promise<{ type: string; id: string }> },
) {
  try {
    const parsed = recordIdentity.safeParse(await params);
    if (!parsed.success)
      throw new AppError("BAD_REQUEST", "Invalid proposal identity.", 400);
    return json(await loadSummary(parsed.data));
  } catch (e) {
    return failure(e);
  }
}
