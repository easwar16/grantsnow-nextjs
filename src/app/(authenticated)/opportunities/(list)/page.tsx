import { displayFormat } from "@/server/platform/configuration/formatting";
import { pageIdentity } from "@/server/identity/auth/page";
import {
  finderRequest,
  finderRequestSchema,
} from "@/features/modules/opportunities/schemas";
import {
  DEFAULT_FILTERS,
  fromQuery,
  resolveTab,
  URL_KEYS,
  type FinderQuery,
} from "@/features/modules/opportunities/finder/state";
import {
  finderBanner,
  finderContext,
  finderOptions,
  finderPreferences,
  listOpportunities,
} from "@/server/modules/opportunities/service";
import { Finder } from "@/features/modules/opportunities/components/finder";
import { State } from "@/components/feedback/state";
import { AppError } from "@/lib/errors";
import { functions } from "@/lib/functions";
import { serverFunctions } from "@/server/functions";
export const metadata = { title: "Funding opportunities" };
export default async function Opportunities({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { user } = await pageIdentity("/opportunities");
  try {
    serverFunctions.permissions.requireDrawerAccess(
      user,
      "opportunities-finder",
    );
  } catch {
    return (
      <State
        title="Access denied"
        message="Funding opportunity access has not been granted."
        code="FORBIDDEN"
      />
    );
  }
  // Only the six manageFilterURL keys are read; fromQuery drops unknown sorts and directions.
  const params = await searchParams,
    urlQuery: Partial<FinderQuery> = {};
  for (const key of URL_KEYS) {
    const value = params[key];
    if (typeof value === "string") urlQuery[key] = value.slice(0, 4000);
  }
  // The first page needs only the preferences (its tab), so it loads alongside the context, not after it.
  const contextRead = finderContext();
  const requestRead = finderPreferences().then((prefs) => {
    const request = finderRequest({
      tab: resolveTab(null, prefs),
      filters: fromQuery(urlQuery, DEFAULT_FILTERS),
    });
    return { request, valid: finderRequestSchema.safeParse(request).success };
  });
  // A hand-edited link is held to the API's limits before anything is read.
  const pageRead = requestRead.then(({ request, valid }) => {
    if (!valid)
      throw new AppError("BAD_REQUEST", "Invalid opportunity filters.", 400);
    return listOpportunities(request);
  });
  const formatRead = displayFormat();
  // The cards stream in after the shell; a failure is the list's own error, never a rejection.
  const initial = functions.errors.settle(
    pageRead.then((page) => ({
      rows: page.rows,
      total: page.total,
      card: page.card,
      ...(page.countsUnavailable ? { countsUnavailable: true as const } : {}),
    })),
  );
  let context;
  try {
    context = await contextRead;
  } catch (error) {
    const e = functions.errors.publicError(error);
    return (
      <State
        title="Opportunities unavailable"
        message={e.message}
        action={e.action}
        code={e.code}
      />
    );
  }
  // The first page as a first visit sees it; the client refetches when it remembers other filters.
  const { request, valid } = await requestRead;
  if (!valid)
    return <State title="Invalid opportunity filters" code="BAD_REQUEST" />;
  return (
    <Finder
      initial={initial}
      initialRequest={{ tab: request.tab, filters: request.filters }}
      urlQuery={urlQuery}
      shell={context}
      optionsRead={finderOptions()}
      bannerRead={finderBanner()}
      format={await formatRead}
    />
  );
}
