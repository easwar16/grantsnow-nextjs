import { redirect } from "next/navigation";
export default async function NewApplication({
  params,
}: {
  params: Promise<{ opportunity: string }>;
}) {
  const { opportunity } = await params;
  redirect(`/opportunities/eoi/new/${opportunity}/summary`);
}
