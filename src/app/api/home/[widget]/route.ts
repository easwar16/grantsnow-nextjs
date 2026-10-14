import { loadWidget } from "@/server/home/service";
import { homeFilters } from "@/features/home/schemas";
import { json, failure } from "@/server/api/http";
export async function GET(
  request: Request,
  { params }: { params: Promise<{ widget: string }> },
) {
  try {
    return json(
      await loadWidget(
        (await params).widget,
        homeFilters(new URL(request.url).searchParams),
        request.signal,
      ),
    );
  } catch (e) {
    return failure(e);
  }
}
