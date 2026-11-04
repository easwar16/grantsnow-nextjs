import "server-only";
import { State } from "@/components/feedback/state";
import { displayFormat } from "@/server/platform/configuration/formatting";
import { unitSummaryView } from "@/server/modules/claims/units/record/summary";
import type { UnitTab } from "@/shared/claims/unit-record";
import { functions } from "@/lib/functions";
import { AttachmentsTab } from "@/features/record/attachments/attachments-tab";
import { UnitSummaryTab } from "./summary-tab";
import { UnitGoalsTab } from "./goals-tab";
import { UnitActivitiesTab } from "./activities-tab";

/** One tab of a unit application; the caller has checked the record shows it. */
export async function UnitTabContent({
  id,
  tab,
}: {
  id: string;
  tab: UnitTab;
}) {
  if (tab === "goals")
    return <UnitGoalsTab appId={id} format={await displayFormat()} />;
  if (tab === "activities")
    return <UnitActivitiesTab appId={id} format={await displayFormat()} />;
  if (tab === "attachments")
    return (
      <AttachmentsTab host="claims" record={id} id="claims-unit-attachments" />
    );
  const [result, format] = await Promise.all([
    functions.errors.settle(unitSummaryView(id)),
    displayFormat(),
  ]);
  if (!result.ok)
    return (
      <State
        id="claims-unit-summary-error"
        title="This page is unavailable"
        message={result.error.message}
        action={result.error.action}
        code={result.error.code}
      />
    );
  return <UnitSummaryTab appId={id} view={result.data} format={format} />;
}
