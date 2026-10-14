import { saveDimensions } from "@/server/home/extra-tabs";
import { sameOrigin } from "@/lib/security";
import { appOrigin } from "@/server/configuration/environment";
import {
  notifications,
  dynamicChart,
  featuredOpportunities,
} from "@/server/home/extra-tabs";
import { json, failure } from "@/server/api/http";
import { AppError } from "@/lib/errors";
export async function GET(
  request: Request,
  { params }: { params: Promise<{ tab: string }> },
) {
  try {
    const { tab } = await params,
      q = new URL(request.url).searchParams;
    if (tab === "notifications")
      return json(
        await notifications(Number(q.get("offset") || 0), request.signal),
      );
    if (tab === "charts")
      return json(
        await dynamicChart(
          q.get("id") || "",
          q.get("organization") || undefined,
          request.signal,
        ),
      );
    if (tab === "opportunities")
      return json(
        await featuredOpportunities(Number(q.get("page") || 1), request.signal),
      );
    throw new AppError("BAD_REQUEST", "Unknown dashboard tab.", 400);
  } catch (error) {
    return failure(error);
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ tab: string }> },
) {
  try {
    sameOrigin(request, appOrigin());
    if ((await params).tab !== "charts")
      throw new AppError("BAD_REQUEST", "Unknown preference operation.", 400);
    if (Number(request.headers.get("content-length") || 0) > 1024)
      throw new AppError(
        "BAD_REQUEST",
        "Preference request is too large.",
        400,
      );
    const text = await request.text();
    if (text.length > 1024)
      throw new AppError(
        "BAD_REQUEST",
        "Preference request is too large.",
        400,
      );
    let body: unknown;
    try {
      body = JSON.parse(text);
    } catch {
      throw new AppError("BAD_REQUEST", "Invalid preference request.", 400);
    }
    return json(await saveDimensions(body, request.signal));
  } catch (error) {
    return failure(error);
  }
}
