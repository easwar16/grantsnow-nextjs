import { displayFormat } from "@/server/platform/configuration/formatting";
import { pageIdentity } from "@/server/identity/auth/page";
import { resources } from "@/server/platform/configuration/resources";
import { listProposals } from "@/server/modules/proposals/service";
import { parseQuery } from "@/features/modules/proposals/schemas";
import { Listing } from "@/features/modules/proposals/components/listing";
import { State } from "@/components/feedback/state";
import { functions } from "@/lib/functions";
import { serverFunctions } from "@/server/functions";
import { dashboardRoles } from "@/server/platform/configuration/service";
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
  const rolesRead = dashboardRoles().catch(() => []);
  const initial = functions.errors.settle(
    bundleRead.then((rows) =>
      listProposals(query, serverFunctions.resources.proposalColumns(rows)),
    ),
  );
  // The filter choices load in the browser, a group at a time, so no lookup holds the page.
  const [rows, roles, format] = await Promise.all([
    bundleRead,
    rolesRead,
    displayFormat(),
  ]);
  const create = serverFunctions.permissions.pageAccess(
    roles,
    "create-proposal",
  ).read;
  const createOutline = serverFunctions.permissions.pageAccess(
    roles,
    "create-outline-proposal",
  ).read;
  const actionLabel = (key: string, fallback: string) =>
    serverFunctions.resources.label(
      rows,
      "proposal",
      "button-labels",
      key,
      fallback,
    );
  const visible = (key: string) =>
    serverFunctions.resources.resourceVisible(
      rows,
      "proposal",
      "button-labels",
      key,
    );
  return (
    <>
      <Listing
        initial={initial}
        columns={serverFunctions.resources.proposalColumns(rows)}
        filters={serverFunctions.resources.proposalFilters(rows)}
        initialQuery={query}
        format={format}
        actions={{
          create: create
            ? actionLabel("create-new-proposal", "Create new proposal")
            : null,
          createOutline: createOutline
            ? actionLabel("create-outline-proposal", "Create outline proposal")
            : null,
          advanced: actionLabel("advanced-query", "Advanced Query"),
          recycle: actionLabel("recycle-bin", "Recycle bin"),
          view: visible("list-view-record")
            ? actionLabel("list-view-record", "View")
            : null,
          link: visible("list-link") ? actionLabel("list-link", "Link") : null,
          share: visible("list-share")
            ? actionLabel("list-share", "Share")
            : null,
          clone:
            visible("list-clone") &&
            serverFunctions.permissions.pageAccess(roles, "proposal-clone").read
              ? actionLabel("list-clone", "Clone")
              : null,
          delete:
            visible("list-delete") &&
            serverFunctions.permissions.pageDeleteAccess(
              roles,
              "proposal-listing-delete",
            )
              ? actionLabel("list-delete", "Delete")
              : null,
        }}
      />
    </>
  );
}
