import { readText } from "@/server/http/body";
import { AppError } from "@/lib/errors";
import {
  fxQuery,
  loadFxRates,
  saveFxRates,
} from "@/server/record/fx-rates/service";
import { route, searchOf } from "@/server/http/route";
// One row per currency; far below this in practice.
const MAX_BODY = 65_536;
/** A proposal version's FX rates: ?type&id&versionId&mode. */
export const GET = route((request) => loadFxRates(fxQuery(searchOf(request))));
/** WRITES the rates: { target: { type, id, versionId, mode }, edits: [{ currency, reset, rate? }] }. */
export const POST = route(
  async (request) => {
    const text = await readText(request, MAX_BODY);
    let body: unknown;
    try {
      body = JSON.parse(text);
    } catch {
      throw new AppError("BAD_REQUEST", "Invalid FX rates request.", 400);
    }
    return saveFxRates(body);
  },
  { write: true },
);
