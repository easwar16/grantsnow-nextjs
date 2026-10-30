import { LinkedApplications } from "../linked-applications";

export const metadata = { title: "Due diligence" };

export default function ProposalDueDiligence({
  params,
}: {
  params: Promise<{ type: string; id: string }>;
}) {
  return <LinkedApplications params={params} kind="DUE_DILIGENCE" />;
}
