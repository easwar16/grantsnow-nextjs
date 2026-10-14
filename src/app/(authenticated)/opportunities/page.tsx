import { pageIdentity } from "@/server/auth/page";
import { requireModule } from "@/server/permissions/policy";
import { parseOpportunityQuery } from "@/features/opportunities/schemas";
import { listOpportunities } from "@/server/opportunities/service";
import { Finder } from "@/features/opportunities/components/finder";
import { State } from "@/components/feedback/state";
import { publicError } from "@/lib/errors";
export const metadata = { title: "Funding opportunities" };
export default async function Opportunities({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { user } = await pageIdentity("/opportunities");
  try {
    requireModule(user, "opportunities-finder");
  } catch {
    return (
      <State
        title="Access denied"
        message="Funding opportunity access has not been granted."
        code="FORBIDDEN"
      />
    );
  }
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(await searchParams))
    if (typeof v === "string") params.set(k, v);
  let query;
  try {
    query = parseOpportunityQuery(params);
  } catch {
    return <State title="Invalid opportunity filters" code="BAD_REQUEST" />;
  }
  let initial;
  try {
    initial = { ok: true as const, data: await listOpportunities(query) };
  } catch (error) {
    const e = publicError(error);
    initial = {
      ok: false as const,
      error: { code: e.code, message: e.message },
    };
  }
  return <Finder initial={initial} initialQuery={query} />;
}
