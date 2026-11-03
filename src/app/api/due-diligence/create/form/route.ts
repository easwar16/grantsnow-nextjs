import { route } from "@/server/http/route";
import { dueDiligenceCreateForm } from "@/server/modules/due-diligence/create";

export const GET = route((request) =>
  dueDiligenceCreateForm(
    new URL(request.url).searchParams.get("formType") ?? "",
  ),
);
