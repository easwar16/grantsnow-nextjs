import { pageIdentity } from "@/server/identity/auth/page";
import { ethicsHistoryHost, ethicsRecord } from "@/server/modules/ethics/record";
import { historyView } from "@/server/record/objects/history";
import { resources } from "@/server/platform/configuration/resources";
import { serverFunctions } from "@/server/functions";
import { RecordFrame } from "@/features/record/shell/record-frame";
import { ObjectHistory } from "@/features/record/objects/object-history";
import { AttachmentsTab } from "@/features/record/attachments/attachments-tab";
import { ReadonlyField } from "@/components/ui/readonly-field";
import { State } from "@/components/feedback/state";
import type { IconName } from "@/components/ui/icon";
import { functions } from "@/lib/functions";
import styles from "@/features/modules/ethics/record.module.css";

export const metadata = { title: "Ethics application" };

const names: Record<string, { label: string; icon: IconName }> = {
  "ethics-general-overview": { label: "General Overview", icon: "proposal-summary" },
  "ethics-responses": { label: "Responses", icon: "composite-form" },
  "ethics-attachments": { label: "Attachments", icon: "attachment" },
  "ethics-approvals": { label: "Approvals", icon: "proposal-approvals" },
  "ethics-history": { label: "History", icon: "clock-history" },
};

export default async function EthicsRecord({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ access?: string; tab?: string }>;
}) {
  await pageIdentity("/ethics");
  const [{ id }, { access, tab }] = await Promise.all([params, searchParams]);
  const result = await ethicsRecord(id, access).then(
    (record) => ({ record }),
    (error: unknown) => ({ failure: functions.errors.publicError(error) }),
  );
  if ("failure" in result)
    return <State title="Ethics application unavailable" message={result.failure.message} action={result.failure.action} code={result.failure.code} />;
  const { record } = result;

  const current = tab && record.tabs.includes(tab as (typeof record.tabs)[number]) ? tab : record.tabs[0];
  const [bundle, historyResult] = await Promise.all([
    resources(),
    current === "ethics-history"
      ? ethicsHistoryHost(id).then(historyView).then(
          (view) => ({ view }),
          (error: unknown) => ({ failure: functions.errors.publicError(error) }),
        )
      : Promise.resolve(null),
  ]);
  const label = (group: string, key: string, fallback: string) =>
    serverFunctions.resources.label(bundle, "ethics", group, key, fallback);
  const show = (group: string, key: string) =>
    serverFunctions.resources.resourceVisible(bundle, "ethics", group, key);
  const panel = [
    { key: "number", label: label("labels", "application-number", "Application Number"), value: record.number },
    { key: "status", label: label("labels", "status", "Status"), value: record.status },
    { key: "title", label: label("labels", "project-title", "Project Title"), value: record.title },
    { key: "type", label: label("labels", "ethics-type", "Ethics Type"), value: record.ethicsType },
  ];
  return (
    <RecordFrame
      prefix="ethics-record"
      back={{ href: "/ethics", label: label("button-labels", "list", "List") }}
      record
      tabs={record.tabs.map((page) => ({
        key: page,
        href: `/ethics/${record.id}?access=${record.access}&tab=${page}`,
        name: names[page].label,
        icon: names[page].icon,
        finalized: false,
      }))}
      current={current}
      panel={panel}
      finalize={null}
      objectType="ETHICS"
      objectId={record.statusCode !== "DRFT" ? record.id : undefined}
      page={current}
      labels={{
        comments: label("button-labels", "comments", "Comments"),
        audit: show("button-labels", "openAuditTrail") ? label("button-labels", "openAuditTrail", "Open Audit Trail") : null,
        auditTitle: label("dialog-titles", "audit-trail", "Audit Trail"),
        close: label("button-labels", "close", "Close"),
        finalize: label("labels", "finalize", "Finalize"),
        finalized: label("labels", "finalized", "Finalized"),
        tabs: "Ethics application sections",
      }}
    >
      {current === "ethics-history" ? (
        historyResult && "view" in historyResult ? <ObjectHistory id="ethics-history" host={{ host: "ethics", record: record.id }} view={historyResult.view} />
          : historyResult && "failure" in historyResult ? <State title="History unavailable" message={historyResult.failure.message} action={historyResult.failure.action} code={historyResult.failure.code} />
          : null
      ) : current === "ethics-attachments" ? (
        <AttachmentsTab host="ethics" record={record.id} id="ethics-attachments" />
      ) : current === "ethics-general-overview" ? (
        <section id="ethics-overview" className={styles.section} aria-labelledby="ethics-overview-title">
          <h2 id="ethics-overview-title">General Overview</h2>
          <div className={styles.fields}>
            <ReadonlyField id="ethics-number" label="Application Number" value={record.number} />
            <ReadonlyField id="ethics-status" label="Status" value={record.status} />
            <ReadonlyField id="ethics-title" label="Title" value={record.title} />
            <ReadonlyField id="ethics-type" label="Ethics Type" value={record.ethicsType} />
            <ReadonlyField id="ethics-form-type" label="Form Type" value={record.formType} />
            <ReadonlyField id="ethics-org" label="Org Unit" value={record.org} />
            <ReadonlyField id="ethics-risk" label="Risk" value={record.risk} />
            <ReadonlyField id="ethics-deadline" label="Deadline Date" value={record.deadline} />
            <ReadonlyField id="ethics-expiry" label="Expiry Date" value={record.expiry} />
          </div>
        </section>
      ) : <State title={`${names[current].label} unavailable`} message="This section could not be loaded." code="ERROR" />}
    </RecordFrame>
  );
}
