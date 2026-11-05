import { pageIdentity } from "@/server/identity/auth/page";
import {
  ethicsHistoryHost,
  ethicsRecord,
} from "@/server/modules/ethics/record";
import { historyView } from "@/server/record/objects/history";
import { ObjectHistory } from "@/features/record/objects/object-history";
import { AttachmentsTab } from "@/features/record/attachments/attachments-tab";
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
  searchParams: Promise<{ access?: string; tab?: string }>;
}) {
  const [{ id }, { access, tab }] = await Promise.all([params, searchParams]);
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
  const current = tab ?? model.tabs[0]?.key;
  if (!current || !model.tabs.some((item) => item.key === current))
    return (
      <State
        title="Ethics section unavailable"
        message="You do not have access to this section."
        code="FORBIDDEN"
      />
    );
  const history =
    current === "ethics-history"
      ? await ethicsHistoryHost(id)
          .then(historyView)
          .then(
            (view) => ({ view }),
            (error: unknown) => ({
              failure: functions.errors.publicError(error),
            }),
          )
      : null;
  return (
    <EthicsRecordShell model={model} current={current}>
      {current === "ethics-history" ? (
        history && "view" in history ? (
          <ObjectHistory
            id="ethics-history"
            host={{ host: "ethics", record: id }}
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
      ) : current === "ethics-attachments" ? (
        <AttachmentsTab host="ethics" record={id} id="ethics-attachments" />
      ) : current === "ethics-general-overview" ? (
        <OverviewTab model={model} />
      ) : (
        <State
          title="Ethics section unavailable"
          message="This section could not be loaded."
          code="ERROR"
        />
      )}
    </EthicsRecordShell>
  );
}
