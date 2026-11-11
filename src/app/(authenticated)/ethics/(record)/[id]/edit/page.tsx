import { pageIdentity } from "@/server/identity/auth/page";
import { ethicsEditSetup } from "@/server/modules/ethics/actions";
import { NewEthics } from "@/features/modules/ethics/listing/new-ethics";
import { State } from "@/components/feedback/state";
import { functions } from "@/lib/functions";

export const metadata = { title: "Edit Ethics Setup" };
export default async function Page({ params, searchParams }: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ access?: string }>;
}) {
  const [{ id }, { access }] = await Promise.all([params, searchParams]);
  await pageIdentity(`/ethics/${id}`);
  let data: Awaited<ReturnType<typeof ethicsEditSetup>>;
  try {
    data = await ethicsEditSetup(id, access);
  } catch (error) {
    const failure = functions.errors.publicError(error);
    return <State title="Ethics setup unavailable" message={failure.message} code={failure.code} action={failure.action} />;
  }
  return <NewEthics setup={data.setup} existing={{ id, access: data.access, initial: data.initial, forceEdit: data.forceEdit }} />;
}
