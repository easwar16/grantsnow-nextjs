import { exportUnit, exportUnits } from "@/server/modules/claims/units/actions";
import { parseUnitFilters } from "@/features/modules/claims/units/schema";
import { readText } from "@/server/http/body";
import { fileRoute } from "@/server/http/route";
import { AppError } from "@/lib/errors";

/**
 * WRITES (generate-report): a Claims report, either one application (`{ appId, unitId, fiscalYear }`) or the listing
 * for its filters (`{ filters }`).
 */
export const POST = fileRoute(
  async (request) => {
    let body: { appId?: unknown; filters?: Record<string, string> };
    try {
      body = JSON.parse(await readText(request, 4096));
    } catch {
      throw new AppError("BAD_REQUEST", "Invalid export request.", 400);
    }
    if (body.appId !== undefined) return exportUnit(body);
    let filters;
    try {
      filters = parseUnitFilters(new URLSearchParams(body.filters ?? {}));
    } catch {
      throw new AppError("BAD_REQUEST", "Invalid unit filters.", 400);
    }
    return exportUnits(filters);
  },
  { write: true },
);
