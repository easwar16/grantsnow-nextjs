import { fileRoute, searchOf } from "@/server/http/route";
import { signOffFile } from "@/server/modules/claims/units/record/sign-off";

type Context = { params: Promise<{ id: string }> };
/** A meeting's or document's file (`?view=&row=`). */
export const GET = fileRoute<Context>(async (request, { params }) => {
  const q = searchOf(request);
  return signOffFile((await params).id, q.get("view"), q.get("row"));
});
