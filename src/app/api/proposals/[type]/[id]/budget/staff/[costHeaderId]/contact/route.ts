import { route } from "@/server/http/route";
import { AppError } from "@/lib/errors";
import { recordIdentity } from "@/features/modules/proposals/record";
import { proposalStaffContact } from "@/server/modules/proposals/budget";

export const GET = route<{
  params: Promise<{ type: string; id: string; costHeaderId: string }>;
}>(async (request, context) => {
  const params = await context.params;
  const identity = recordIdentity.safeParse(params);
  if (!identity.success || !/^[1-9]\d{0,14}$/.test(params.costHeaderId))
    throw new AppError("BAD_REQUEST", "Invalid Staff cost identity.", 400);
  const version = new URL(request.url).searchParams.get("version");
  if (version !== null && !/^[1-9]\d{0,14}$/.test(version))
    throw new AppError("BAD_REQUEST", "Invalid Budget version.", 400);
  return proposalStaffContact(
    identity.data.type,
    identity.data.id,
    Number(params.costHeaderId),
    version ? Number(version) : undefined,
  );
});
