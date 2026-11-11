import { pageIdentity } from "@/server/identity/auth/page";
import { dueDiligenceEditSetup } from "@/server/modules/due-diligence/actions";
import { NewDueDiligence } from "@/features/modules/due-diligence/listing/new-due-diligence";
import { State } from "@/components/feedback/state";
import { functions } from "@/lib/functions";

export const metadata = { title: "Edit Due Diligence Setup" };
export default async function Page({
  params, searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ access?: string }>;
}) {
  const [{ id }, { access }] = await Promise.all([params, searchParams]);
  await pageIdentity(`/due-diligence/${id}`);
  let data: Awaited<ReturnType<typeof dueDiligenceEditSetup>>;
  try {
    data = await dueDiligenceEditSetup(id, access);
  } catch (error) {
    const failure = functions.errors.publicError(error);
    return <State title="Due Diligence setup unavailable"
      message={failure.message} code={failure.code} action={failure.action} />;
  }
  return <NewDueDiligence setup={data.setup}
    existing={{ id, access: data.access, initial: data.initial }} />;
}
