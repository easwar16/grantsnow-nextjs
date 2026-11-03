import { route } from "@/server/http/route";
import { dueDiligenceCreatePeople } from "@/server/modules/due-diligence/create";

export const GET = route((request) =>
  dueDiligenceCreatePeople(new URL(request.url).searchParams.get("org") ?? ""),
);
