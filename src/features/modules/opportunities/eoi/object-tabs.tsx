import "server-only";
import { State } from "@/components/feedback/state";
import { historyView } from "@/server/record/objects/history";
import { delegationView } from "@/server/record/objects/delegations";
import {
  eoiDelegationHost,
  eoiHistoryHost,
} from "@/server/modules/opportunities/eoi-record/objects";
import { ObjectHistory } from "@/features/record/objects/object-history";
import { ObjectDelegations } from "@/features/record/objects/object-delegations";
import type {
  DelegationView,
  HistoryView,
} from "@/features/record/objects/types";
import { functions } from "@/lib/functions";
/** The History or Delegation tab: the shared panel with EOI as its host; a failed read shows in place of it. */
export async function EoiObjectTab({
  id,
  tab,
}: {
  id: string;
  tab: "history" | "delegation";
}) {
  const host = { host: "eoi", record: id };
  // The read is settled first, so only its failure (never the render) becomes the error state.
  const read =
    tab === "history"
      ? eoiHistoryHost(id).then(historyView)
      : eoiDelegationHost(id).then(delegationView);
  const result = await read.then(
    (view) => ({ view }),
    (error: unknown) => ({ error }),
  );
  if ("error" in result) {
    const e = functions.errors.publicError(result.error);
    return (
      <State
        id={`opportunities-eoi-${tab}-error`}
        title={
          tab === "history" ? "History unavailable" : "Delegation unavailable"
        }
        message={e.message}
        action={e.action}
        code={e.code}
      />
    );
  }
  return tab === "history" ? (
    <ObjectHistory
      id="opportunities-eoi-history"
      host={host}
      view={result.view as HistoryView}
    />
  ) : (
    <ObjectDelegations
      id="opportunities-eoi-delegation"
      host={host}
      view={result.view as DelegationView}
    />
  );
}
