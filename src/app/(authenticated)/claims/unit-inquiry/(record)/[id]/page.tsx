import { redirect } from "next/navigation";
/** Legacy opens an application on its Summary tab (viewClaimInquiry). */
export default async function UnitRecord({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  redirect(`/claims/unit-inquiry/${id}/summary`);
}
