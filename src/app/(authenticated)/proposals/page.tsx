import { listingChoices } from "@/server/proposals/lookups";
import { pageIdentity } from "@/server/auth/page";
import { resources, proposalColumns } from "@/server/configuration/resources";
import { listProposals } from "@/server/proposals/service";
import { parseQuery } from "@/features/proposals/schemas";
import { Listing } from "@/features/proposals/components/listing";
import { publicError } from "@/lib/errors";
import { requireModule } from "@/server/permissions/policy";
import { State } from "@/components/feedback/state";
export const metadata = { title: "Proposals" };
export default async function Proposals({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { user } = await pageIdentity("/proposals");
  try {
    requireModule(user, "PROPOSALS");
  } catch {
    return (
      <State
        title="Access denied"
        message="Proposal listing access has not been granted."
        code="FORBIDDEN"
      />
    );
  }
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(await searchParams))
    if (typeof v === "string") params.set(k, v);
  let query;
  try {
    query = parseQuery(params);
  } catch {
    return (
      <State
        title="Invalid filters"
        message="Open Proposals from the navigation to reset the query."
        code="BAD_REQUEST"
      />
    );
  }
  const columns = proposalColumns(await resources());
  let initial;
  try {
    initial = { ok: true as const, data: await listProposals(query, columns) };
  } catch (e) {
    const error = publicError(e);
    initial = {
      ok: false as const,
      error: { code: error.code, message: error.message },
    };
  }
  return (
    <>
      <Listing
        initial={initial}
        columns={columns}
        initialQuery={query}
        choices={await listingChoices()}
      />
    </>
  );
}
