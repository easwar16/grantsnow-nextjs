import { pageIdentity } from "@/server/identity/auth/page";
import { dueDiligenceRecord } from "@/server/modules/due-diligence/record";
import { dueDiligenceShell } from "@/server/modules/due-diligence/record/shell";
import { resources } from "@/server/platform/configuration/resources";
import { State } from "@/components/feedback/state";
import { DueDiligenceRecordShell } from "@/features/modules/due-diligence/record/record-shell";
import { OverviewTab } from "@/features/modules/due-diligence/record/overview-tab";
import { functions } from "@/lib/functions";

export const metadata = { title: "Due Diligence application" };

/** The record reads its access view from the query (legacy passes the listing tab), so the page holds the shell. */
export default async function DueDiligenceRecord({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ access?: string }>;
}) {
  const [{ id }, { access }] = await Promise.all([params, searchParams]);
  await pageIdentity(`/due-diligence/${id}`);
  const rowsRead = resources();
  rowsRead.catch(() => undefined);
  let model;
  try {
    model = dueDiligenceShell(
      await dueDiligenceRecord(id, access),
      await rowsRead,
    );
  } catch (error) {
    const e = functions.errors.publicError(error);
    return (
      <State
        title="Due Diligence application unavailable"
        message={e.message}
        action={e.action}
        code={e.code}
      />
    );
  }
  return (
    <DueDiligenceRecordShell model={model}>
      <OverviewTab model={model} />
    </DueDiligenceRecordShell>
  );
}
