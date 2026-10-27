import { pageIdentity } from "@/server/identity/auth/page";
import { eoiRecordContext } from "@/server/modules/opportunities/record";
import { recordShell } from "@/server/modules/opportunities/eoi-record/shell";
import { resources } from "@/server/platform/configuration/resources";
import { displayFormat } from "@/server/platform/configuration/formatting";
import { State } from "@/components/feedback/state";
import { DeniedRedirect } from "@/features/modules/opportunities/eoi/denied-redirect";
import { RecordShell } from "@/features/modules/opportunities/eoi/record-shell";
import { publicError } from "@/lib/errors";
/** The AOI / EOI record container: the request, the user's rights on it and its finalize state, shared by every tab. */
export default async function EoiLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { user } = await pageIdentity(`/opportunities/eoi/${id}/summary`);
  if (user.modules["opportunities-group"] !== true)
    return (
      <State
        title="Access denied"
        message="You do not have access to this module."
        code="FORBIDDEN"
      />
    );
  // The labels and formats need only the session; they load with the record and are used once it is readable.
  const shellRead = Promise.all([resources(), displayFormat()]);
  shellRead.catch(() => undefined);
  let context;
  try {
    context = await eoiRecordContext(id);
  } catch (error) {
    const e = publicError(error);
    // No rights on the record: the original's toast and back to the list.
    if (e.code === "FORBIDDEN")
      return (
        <DeniedRedirect
          title="Access Denied"
          message={e.message}
          href="/opportunities/eoi"
        />
      );
    return (
      <State
        title="Application unavailable"
        message={e.message}
        action={e.action}
        code={e.code}
      />
    );
  }
  const [rows, format] = await shellRead;
  return (
    <RecordShell model={recordShell(context, rows, format)}>
      {children}
    </RecordShell>
  );
}
