import { pageIdentity } from "@/server/identity/auth/page";
import {
  dueDiligenceHistoryHost,
  dueDiligenceRecord,
} from "@/server/modules/due-diligence/record";
import { historyView } from "@/server/record/objects/history";
import { ObjectHistory } from "@/features/record/objects/object-history";
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
  searchParams: Promise<{ access?: string; tab?: string }>;
}) {
  const [{ id }, { access, tab }] = await Promise.all([params, searchParams]);
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
        message={
          e.code === "FORBIDDEN"
            ? "This application could not be opened with your current access."
            : e.message
        }
        action={e.action}
        code={e.code}
      />
    );
  }
  const current = tab ?? model.tabs[0]?.key;
  if (!current || !model.tabs.some((item) => item.key === current))
    return (
      <State
        title="Due Diligence section unavailable"
        message="You do not have access to this section."
        code="FORBIDDEN"
      />
    );
  const history =
    current === "duediligence-history"
      ? await dueDiligenceHistoryHost(id)
          .then(historyView)
          .then(
            (view) => ({ view }),
            (error: unknown) => ({
              failure: functions.errors.publicError(error),
            }),
          )
      : null;
  return (
    <DueDiligenceRecordShell model={model} current={current}>
      {current === "duediligence-history" ? (
        history && "view" in history ? (
          <ObjectHistory
            id="due-diligence-history"
            host={{ host: "due-diligence", record: id }}
            view={history.view}
          />
        ) : (
          <State
            title="History unavailable"
            message={
              history && "failure" in history
                ? history.failure.message
                : "The history could not be loaded."
            }
            code="ERROR"
          />
        )
      ) : current === "duediligence-general-overview" ? (
        <OverviewTab model={model} />
      ) : (
        <State
          title="Due Diligence section unavailable"
          message="This section could not be loaded."
          code="ERROR"
        />
      )}
    </DueDiligenceRecordShell>
  );
}
