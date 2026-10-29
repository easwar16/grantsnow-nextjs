import { pageIdentity } from "@/server/identity/auth/page";
import { awardRecordContext } from "@/server/modules/awards/record";
import { awardShell } from "@/server/modules/awards/record/shell";
import { resources } from "@/server/platform/configuration/resources";
import { displayFormat } from "@/server/platform/configuration/formatting";
import { State } from "@/components/feedback/state";
import { DeniedRedirect } from "@/features/modules/opportunities/eoi/denied-redirect";
import { AwardRecordShell } from "@/features/modules/awards/record/record-shell";
import { functions } from "@/lib/functions";

/** The award record container (legacy awards-detail-page): the award, the user's rights and its finalize state. */
export default async function AwardLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  await pageIdentity(`/awards/${id}/header`);
  const shellRead = Promise.all([resources(), displayFormat()]);
  shellRead.catch(() => undefined);
  let context;
  try {
    context = await awardRecordContext(id);
  } catch (error) {
    const e = functions.errors.publicError(error);
    // No rights on the award: legacy's toast and back to the listing.
    if (e.code === "FORBIDDEN")
      return (
        <DeniedRedirect
          title="Access Denied!"
          message={e.message}
          href="/awards"
        />
      );
    return (
      <State
        title="Award unavailable"
        message={e.message}
        action={e.action}
        code={e.code}
      />
    );
  }
  const [rows, format] = await shellRead;
  return (
    <AwardRecordShell model={awardShell(context, rows, format)}>
      {children}
    </AwardRecordShell>
  );
}
