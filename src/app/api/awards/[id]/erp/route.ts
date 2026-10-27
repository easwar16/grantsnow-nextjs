import { sendToErp } from "@/server/modules/awards/record/erp";
import { route } from "@/server/http/route";
type Context = { params: Promise<{ id: string }> };
/** WRITES: hands the award to ERP; the award's state and the user's rights decide on the server. */
export const POST = route<Context>(
  async (_request, context) => {
    const { id } = await context.params;
    return sendToErp(id);
  },
  { write: true },
);
