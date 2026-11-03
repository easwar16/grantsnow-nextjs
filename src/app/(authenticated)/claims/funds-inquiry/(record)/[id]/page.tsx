import { redirect } from "next/navigation";
/** Legacy opens a fund on its Summary tab (viewFundInquiry). */
export default async function FundRecord({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  redirect(`/claims/funds-inquiry/${id}/summary`);
}
