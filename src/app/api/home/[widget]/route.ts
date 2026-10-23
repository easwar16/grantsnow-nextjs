import { loadWidget, homeAccess } from "@/server/modules/home/service";
import { widgets } from "@/server/modules/home/widgets";
import {
  drillRows,
  type InsightRow,
} from "@/server/modules/home/insight-mapping";
import { organizations } from "@/server/platform/configuration/service";
import { homeFilters } from "@/features/modules/home/schemas";
import { route, searchOf } from "@/server/http/route";
export const GET = route(
  async (request, { params }: { params: Promise<{ widget: string }> }) => {
    const id = (await params).widget,
      filters = homeFilters(searchOf(request));
    const data = await loadWidget(id, filters, request.signal),
      w = widgets.find((w) => w.id === id);
    if (w?.kind !== "statistics") return data;
    // loadWidget has already scoped this organization; the drill filters the listing by it, as legacy did.
    const { user } = await homeAccess();
    const orgIdByName =
      w.drill === "awardedBySchool"
        ? new Map((await organizations()).map((o) => [o.name, o.id]))
        : undefined;
    return {
      ...data,
      presentation: data.presentation && { ...data.presentation, ...w.layout },
      statistics: drillRows(data.statistics as InsightRow[], w.drill, {
        organization: filters.organization || user.organizationId,
        orgIdByName,
        modules: user.modules,
      }),
    };
  },
);
