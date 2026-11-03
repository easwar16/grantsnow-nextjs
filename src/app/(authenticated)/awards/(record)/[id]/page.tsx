import { redirect } from "next/navigation";
export default async function AwardRecord({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  redirect(`/awards/${id}/header`);
}
