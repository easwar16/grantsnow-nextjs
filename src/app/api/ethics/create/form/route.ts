import { route } from "@/server/http/route";
import { ethicsCreateForm } from "@/server/modules/ethics/create";

export const GET = route((request) =>
  ethicsCreateForm(new URL(request.url).searchParams.get("formType") ?? ""),
);
