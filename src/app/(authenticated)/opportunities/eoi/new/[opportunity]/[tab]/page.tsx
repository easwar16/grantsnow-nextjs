import { z } from "zod";
import { newApplicationContext } from "@/server/opportunities/record";
import { State } from "@/components/feedback/state";
import { NewTabContent } from "@/features/opportunities/eoi/tab-content";
const identity = z.object({
  opportunity: z.string().regex(/^[1-9]\d{0,14}$/),
  tab: z.enum(["summary", "application"]),
});
/** A new application's Summary or Application tab; every other tab needs a saved request. */
export default async function NewApplicationTab({
  params,
}: {
  params: Promise<{ opportunity: string; tab: string }>;
}) {
  const input = identity.safeParse(await params);
  if (!input.success)
    return <State title="Invalid application page" code="BAD_REQUEST" />;
  let context;
  try {
    context = await newApplicationContext(input.data.opportunity);
  } catch {
    // The layout shows the failure and does not render the tab.
    return null;
  }
  return (
    <NewTabContent opportunity={context.opportunity} tab={input.data.tab} />
  );
}
