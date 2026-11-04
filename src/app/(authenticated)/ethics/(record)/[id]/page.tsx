import { pageIdentity } from "@/server/identity/auth/page";
import { ethicsRecord } from "@/server/modules/ethics/record";
import { ethicsShell } from "@/server/modules/ethics/record/shell";
import { resources } from "@/server/platform/configuration/resources";
import { State } from "@/components/feedback/state";
import { EthicsRecordShell } from "@/features/modules/ethics/record/record-shell";
import { OverviewTab } from "@/features/modules/ethics/record/overview-tab";
import { functions } from "@/lib/functions";

export const metadata = { title: "Ethics application" };

/** The record reads its access view from the query (legacy passes the listing tab), so the page holds the shell. */
export default async function EthicsRecord({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ access?: string }>;
}) {
  const [{ id }, { access }] = await Promise.all([params, searchParams]);
  await pageIdentity(`/ethics/${id}`);
  const rowsRead = resources();
  rowsRead.catch(() => undefined);
  let model;
  try {
    model = ethicsShell(await ethicsRecord(id, access), await rowsRead);
  } catch (error) {
    const e = functions.errors.publicError(error);
    return (
      <State
        title="Ethics application unavailable"
        message={e.message}
        action={e.action}
        code={e.code}
      />
    );
  }
  return (
    <EthicsRecordShell model={model}>
      <OverviewTab model={model} />
    </EthicsRecordShell>
  );
}
