import { json, failure } from "@/server/api/http";
import { sameOrigin } from "@/lib/security";
import { appOrigin } from "@/server/configuration/environment";
import { AppError } from "@/lib/errors";
import { fxQuery, loadFxRates, saveFxRates } from "@/server/fx-rates/service";
// One row per currency; far below this in practice.
const MAX_BODY = 65_536;
/** A proposal version's FX rates: ?type&id&versionId&mode. */
export async function GET(request: Request) {
  try {
    return json(await loadFxRates(fxQuery(new URL(request.url).searchParams)));
  } catch (e) {
    return failure(e);
  }
}
/** WRITES the rates: { target: { type, id, versionId, mode }, edits: [{ currency, reset, rate? }] }. */
export async function POST(request: Request) {
  try {
    sameOrigin(request, appOrigin());
    const text = await request.text();
    if (text.length > MAX_BODY)
      throw new AppError("BAD_REQUEST", "Request is too large.", 413);
    let body: unknown;
    try {
      body = JSON.parse(text);
    } catch {
      throw new AppError("BAD_REQUEST", "Invalid FX rates request.", 400);
    }
    return json(await saveFxRates(body));
  } catch (e) {
    return failure(e);
  }
}
