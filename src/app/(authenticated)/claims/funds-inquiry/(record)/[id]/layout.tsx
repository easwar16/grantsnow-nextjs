import { pageIdentity } from "@/server/identity/auth/page";
import { fundRecordContext } from "@/server/modules/claims/funds/record";
import { fundShell } from "@/server/modules/claims/funds/record/shell";
import { resources } from "@/server/platform/configuration/resources";
import { State } from "@/components/feedback/state";
import { DeniedRedirect } from "@/features/modules/opportunities/eoi/denied-redirect";
import { FundRecordShell } from "@/features/modules/claims/funds/record/record-shell";
import { functions } from "@/lib/functions";

/** A fund's record container (legacy claims-funds-inquiry-info-page): its rights, tabs and filter bar. */
export default async function FundRecordLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  await pageIdentity(`/claims/funds-inquiry/${id}/summary`);
  const rowsRead = resources();
  rowsRead.catch(() => undefined);
  let model;
  try {
    model = await fundShell(await fundRecordContext(id), await rowsRead);
  } catch (error) {
    const e = functions.errors.publicError(error);
    // No rights on the fund: legacy's toast and back to the listing.
    if (e.code === "FORBIDDEN")
      return (
        <DeniedRedirect
          title="Access Denied!"
          message={e.message}
          href="/claims/funds-inquiry"
        />
      );
    return (
      <State
        title="Fund unavailable"
        message={e.message}
        action={e.action}
        code={e.code}
      />
    );
  }
  return <FundRecordShell model={model}>{children}</FundRecordShell>;
}
