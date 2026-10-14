import { redirect } from "next/navigation";
export default async function EoiRecord({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  redirect(`/opportunities/eoi/${id}/summary`);
}
