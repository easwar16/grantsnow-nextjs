import { pageIdentity } from "@/server/identity/auth/page";
import { newApplicationContext } from "@/server/modules/opportunities/record";
import { openingShell } from "@/server/modules/opportunities/eoi-record/shell";
import { resources } from "@/server/platform/configuration/resources";
import { State } from "@/components/feedback/state";
import { RecordShell } from "@/features/modules/opportunities/eoi/record-shell";
import { publicError } from "@/lib/errors";
/** A new application (Apply): Summary and Application only; the request is created on Create. */
export default async function NewApplicationLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ opportunity: string }>;
}) {
  const { opportunity: id } = await params;
  await pageIdentity(`/opportunities/eoi/new/${id}/summary`);
  // The labels need only the session; they load with the opportunity and are used once it may be applied to.
  const rowsRead = resources();
  rowsRead.catch(() => undefined);
  let context;
  try {
    context = await newApplicationContext(id);
  } catch (error) {
    const e = publicError(error);
    return (
      <State
        title={
          e.code === "FORBIDDEN" ? "Access denied" : "Application unavailable"
        }
        message={e.message}
        action={e.action}
        code={e.code}
      />
    );
  }
  return (
    <RecordShell
      model={openingShell(
        "new",
        id,
        context.opportunity.opp_heading,
        await rowsRead,
      )}
    >
      {children}
    </RecordShell>
  );
}
