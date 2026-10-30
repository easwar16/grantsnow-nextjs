import { displayFormat } from "@/server/platform/configuration/formatting";
import { pageIdentity } from "@/server/identity/auth/page";
import { resources } from "@/server/platform/configuration/resources";
import { listProposals } from "@/server/modules/proposals/service";
import { parseQuery } from "@/features/modules/proposals/schemas";
import { Listing } from "@/features/modules/proposals/components/listing";
import { State } from "@/components/feedback/state";
import { functions } from "@/lib/functions";
import { serverFunctions } from "@/server/functions";
export const metadata = { title: "Proposals" };
export default async function Proposals({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { user } = await pageIdentity("/proposals");
  try {
    serverFunctions.permissions.requireModule(user, "PROPOSALS");
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
  // Independent reads run together; the rows wait only for the columns and stream in after the shell.
  const bundleRead = resources();
  const initial = functions.errors.settle(
    bundleRead.then((rows) =>
      listProposals(query, serverFunctions.resources.proposalColumns(rows)),
    ),
  );
  // The filter choices load in the browser, a group at a time, so no lookup holds the page.
  const [rows, format] = await Promise.all([bundleRead, displayFormat()]);
  return (
    <>
      <Listing
        initial={initial}
        columns={serverFunctions.resources.proposalColumns(rows)}
        filters={serverFunctions.resources.proposalFilters(rows)}
        initialQuery={query}
        format={format}
      />
    </>
  );
}
