import { loadWidget, homeAccess } from "@/server/home/service";
import { widgets } from "@/server/home/widgets";
import { drillRows, type InsightRow } from "@/server/home/insight-mapping";
import { organizations } from "@/server/configuration/service";
import { homeFilters } from "@/features/home/schemas";
import { json, failure } from "@/server/api/http";
export async function GET(
  request: Request,
  { params }: { params: Promise<{ widget: string }> },
) {
  try {
    const id = (await params).widget,
      filters = homeFilters(new URL(request.url).searchParams);
    const data = await loadWidget(id, filters, request.signal),
      w = widgets.find((w) => w.id === id);
    if (w?.kind !== "statistics") return json(data);
    // loadWidget has already scoped this organization; the drill filters the listing by it, as legacy did.
    const { user } = await homeAccess();
    const orgIdByName =
      w.drill === "awardedBySchool"
        ? new Map((await organizations()).map((o) => [o.name, o.id]))
        : undefined;
    return json({
      ...data,
      presentation: data.presentation && { ...data.presentation, ...w.layout },
      statistics: drillRows(data.statistics as InsightRow[], w.drill, {
        organization: filters.organization || user.organizationId,
        orgIdByName,
        modules: user.modules,
      }),
    });
  } catch (e) {
    return failure(e);
  }
}
