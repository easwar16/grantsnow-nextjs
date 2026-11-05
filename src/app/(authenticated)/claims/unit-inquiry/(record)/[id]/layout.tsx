import { pageIdentity } from "@/server/identity/auth/page";
import { unitRecordContext } from "@/server/modules/claims/units/record";
import { unitShell } from "@/server/modules/claims/units/record/shell";
import { resources } from "@/server/platform/configuration/resources";
import { State } from "@/components/feedback/state";
import { DeniedRedirect } from "@/features/modules/opportunities/eoi/denied-redirect";
import { UnitRecordShell } from "@/features/modules/claims/units/record/record-shell";
import { functions } from "@/lib/functions";

/** A unit application's record container (legacy claims-unit-inquiry-info-page): its rights, tabs and panel. */
export default async function UnitRecordLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  await pageIdentity(`/claims/unit-inquiry/${id}/summary`);
  const rowsRead = resources();
  rowsRead.catch(() => undefined);
  let model;
  try {
    model = await unitShell(await unitRecordContext(id), await rowsRead);
  } catch (error) {
    const e = functions.errors.publicError(error);
    // No rights on the application: legacy's toast and back to the listing.
    if (e.code === "FORBIDDEN")
      return (
        <DeniedRedirect
          title="Access Denied!"
          message={e.message}
          href="/claims/unit-inquiry"
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
  return <UnitRecordShell model={model}>{children}</UnitRecordShell>;
}
