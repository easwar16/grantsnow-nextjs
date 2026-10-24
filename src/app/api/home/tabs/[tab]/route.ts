import { readText } from "@/server/http/body";
import {
  notifications,
  dynamicChart,
  featuredOpportunities,
  saveDimensions,
} from "@/server/modules/home/extra-tabs";
import { route, searchOf } from "@/server/http/route";
import { AppError } from "@/lib/errors";
type Context = { params: Promise<{ tab: string }> };
export const GET = route(async (request, { params }: Context) => {
  const { tab } = await params,
    q = searchOf(request);
  if (tab === "notifications")
    return notifications(Number(q.get("offset") || 0), request.signal);
  if (tab === "charts")
    return dynamicChart(
      q.get("id") || "",
      q.get("organization") || undefined,
      request.signal,
    );
  if (tab === "opportunities")
    return featuredOpportunities(Number(q.get("page") || 1), request.signal);
  throw new AppError("BAD_REQUEST", "Unknown dashboard tab.", 400);
});

export const POST = route(
  async (request, { params }: Context) => {
    if ((await params).tab !== "charts")
      throw new AppError("BAD_REQUEST", "Unknown preference operation.", 400);
    const text = await readText(request, 1024);
    let body: unknown;
    try {
      body = JSON.parse(text);
    } catch {
      throw new AppError("BAD_REQUEST", "Invalid preference request.", 400);
    }
    return saveDimensions(body, request.signal);
  },
  { write: true },
);
