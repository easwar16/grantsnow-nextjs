import { LinkedApplications } from "../linked-applications";

export const metadata = { title: "Proposal ethics" };

export default function ProposalEthics({
  params,
}: {
  params: Promise<{ type: string; id: string }>;
}) {
  return <LinkedApplications params={params} kind="ETHICS" />;
}
