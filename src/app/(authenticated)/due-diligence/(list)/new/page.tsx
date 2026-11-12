import { pageIdentity } from "@/server/identity/auth/page";
import {
  dueDiligenceCreateParent,
  dueDiligenceCreateSetup,
} from "@/server/modules/due-diligence/actions";
import { NewDueDiligence } from "@/features/modules/due-diligence/listing/new-due-diligence";
import { State } from "@/components/feedback/state";
import { AppError } from "@/lib/errors";

export const metadata = { title: "New Due Diligence application" };
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{
    parentType?: string;
    parentId?: string;
    proposalType?: string;
  }>;
}) {
  await pageIdentity("/due-diligence");
  const query = await searchParams;
  const [parent, setup] = await Promise.all([
    dueDiligenceCreateParent(query).catch((e: unknown) =>
      e instanceof AppError ? e : new AppError("FORBIDDEN", "", 403),
    ),
    dueDiligenceCreateSetup().catch(() => null),
  ]);
  if (parent instanceof AppError)
    return (
      <State
        title="Due Diligence parent unavailable"
        message={parent.message}
        code={parent.code}
      />
    );
  return setup ? (
    <NewDueDiligence setup={setup} parent={parent} />
  ) : (
    <State
      title="New Due Diligence application unavailable"
      message="This action is not available with your current access."
      code="FORBIDDEN"
    />
  );
}
