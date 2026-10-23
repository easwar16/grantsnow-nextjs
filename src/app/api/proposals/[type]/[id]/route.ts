import { loadSummary } from "@/server/modules/proposals/record";
import { recordIdentity } from "@/features/modules/proposals/record";
import { route } from "@/server/http/route";
import { AppError } from "@/lib/errors";
export const GET = route(
  async (
    _request,
    { params }: { params: Promise<{ type: string; id: string }> },
  ) => {
    const parsed = recordIdentity.safeParse(await params);
    if (!parsed.success)
      throw new AppError("BAD_REQUEST", "Invalid proposal identity.", 400);
    return loadSummary(parsed.data);
  },
);
