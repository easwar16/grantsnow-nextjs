import { pageIdentity } from "@/server/identity/auth/page";
import { ethicsListView } from "@/server/modules/ethics/listing";
import { Listing } from "@/features/modules/ethics/listing";
import { State } from "@/components/feedback/state";
import { parseEthicsFilters } from "@/features/modules/ethics/schema";

export const metadata = { title: "Ethics" };

export default async function Ethics({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await pageIdentity("/ethics");
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(await searchParams))
    if (typeof value === "string") params.set(key, value);
  let filters;
  try {
    filters = parseEthicsFilters(params);
  } catch {
    return (
      <State
        title="Invalid filters"
        message="Open Ethics from the navigation to reset the query."
        code="BAD_REQUEST"
      />
    );
  }
  const view = await ethicsListView().catch(() => null);
  if (!view)
    return (
      <State
        title="Ethics unavailable"
        message="Please retry or contact your administrator."
        code="UPSTREAM"
      />
    );
  if (!view.tabs.length)
    return (
      <State
        title="Access denied"
        message="Ethics listing access has not been granted."
        code="FORBIDDEN"
      />
    );
  return (
    <Listing key={params.toString()} view={view} initialFilters={filters} />
  );
}
