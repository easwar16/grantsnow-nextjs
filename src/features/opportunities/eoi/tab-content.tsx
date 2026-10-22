import { idPart } from "@/lib/ids";
import "server-only";
import { State } from "@/components/feedback/state";
import { resources, label } from "@/server/configuration/resources";
import { displayFormat } from "@/server/configuration/formatting";
import {
  eoiPageLock,
  eoiRecordTable,
  type EoiRecordContext,
  type TableTab,
} from "@/server/opportunities/record";
import {
  isFormTab,
  type EoiTab,
} from "@/server/opportunities/eoi-record/model";
import {
  summaryEmpty,
  summaryRoles,
  summaryView,
  type OpportunityRecord,
} from "@/server/opportunities/eoi-record/opportunity";
import { tabName } from "@/server/opportunities/eoi-record/shell";
import { publicError } from "@/lib/errors";
import { dateDisplay } from "@/lib/format";
import { ApplicationTab } from "./application-tab";
import { FormTab } from "./form-tab";
import { TabLock } from "./record-context";
import { Summary } from "./summary";
import styles from "./record.module.css";
const BUNDLE = "opportunities-eoi";
async function applicationTexts() {
  const rows = await resources();
  return {
    create: "Create",
    save: "Save",
    created: label(
      rows,
      BUNDLE,
      "success-msg",
      "created",
      "Application created successfully",
    ),
    updated: label(
      rows,
      BUNDLE,
      "success-msg",
      "updated",
      "Application updated successfully",
    ),
    createdNoNumber:
      "The application was created, but its number could not be read. Add its answers from the record.",
  };
}
/** The Summary tab of a record, a new application or More Info. */
export async function SummaryTab({
  opportunity,
  detail = false,
}: {
  opportunity: OpportunityRecord | null;
  detail?: boolean;
}) {
  const [rows, format, roles] = await Promise.all([
    resources(),
    displayFormat(),
    summaryRoles(),
  ]);
  return (
    <Summary
      view={
        opportunity && summaryView(opportunity, rows, roles, format, detail)
      }
      empty={summaryEmpty(rows)}
    />
  );
}
async function TableContent({ id, tab }: { id: string; tab: TableTab }) {
  // The table read starts with the labels; its failure is settled here so it is never unhandled.
  const read = eoiRecordTable(id, tab).then(
    (table) => ({ table }),
    (error: unknown) => ({ error }),
  );
  const [rows, format, result] = await Promise.all([
    resources(),
    displayFormat(),
    read,
  ]);
  const name = tabName(rows, tab);
  if ("error" in result) {
    const e = publicError(result.error);
    return (
      <State
        title={`${name} unavailable`}
        message={e.message}
        action={e.action}
        code={e.code}
      />
    );
  }
  const { table } = result;
  return (
    <div id={`eoi-record-${tab}`} className={styles.tab}>
      <h2 id={`eoi-record-${tab}-heading`}>{name}</h2>
      {table.rows.length ? (
        <div className={styles.tableWrap}>
          <table id={`eoi-record-${tab}-table`}>
            <thead>
              <tr>
                {table.columns.map((c) => (
                  <th key={c.key} scope="col">
                    {c.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {table.rows.map((row) => (
                <tr key={row.id} id={`eoi-record-${tab}-${idPart(row.id)}`}>
                  {table.columns.map((c) => (
                    <td key={c.key}>
                      {c.key.endsWith("date")
                        ? dateDisplay(row.values[c.key], format)
                        : row.values[c.key]}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <State
          title={label(
            rows,
            BUNDLE,
            "helper-texts",
            "no-data",
            "No data to display.",
          )}
        />
      )}
    </div>
  );
}
/** One tab of a saved application; the caller has checked the tab is one the record shows. */
export async function RecordTabContent({
  context,
  tab,
}: {
  context: EoiRecordContext;
  tab: EoiTab;
}) {
  // Labels (cached per request) load with the lock; the tab bodies below read them.
  const [lock] = await Promise.all([eoiPageLock(context, tab), resources()]);
  const r = context.request;
  const opportunityId = context.opportunity
    ? String(context.opportunity.opportunities_id)
    : null;
  const unknownLock = !lock.known && lock.locked && (
    <p id="eoi-record-lock-unknown" className={styles.notice} role="status">
      This page&apos;s lock could not be read, so it is read-only.
    </p>
  );
  let content: React.ReactNode;
  if (tab === "summary")
    content = <SummaryTab opportunity={context.opportunity} />;
  else if (tab === "application")
    content = opportunityId ? (
      <>
        {unknownLock}
        <ApplicationTab
          opportunityId={opportunityId}
          requestId={context.id}
          number={r.request_number}
          statusCode={r.status_code ?? undefined}
          lock={lock}
          texts={await applicationTexts()}
        />
      </>
    ) : (
      <State title={summaryEmpty(await resources())} />
    );
  else if (isFormTab(tab)) {
    const rows = await resources();
    content = (
      <>
        {unknownLock}
        <FormTab
          tab={tab}
          requestId={context.id}
          number={r.request_number}
          statusCode={r.status_code ?? undefined}
          lock={lock}
          texts={{
            submit: label(rows, BUNDLE, "button-labels", "submit", "Submit"),
            saved: label(
              rows,
              BUNDLE,
              "success-msg",
              "saved",
              "Response saved successfully!",
            ),
          }}
        />
      </>
    );
  } else content = <TableContent id={context.id} tab={tab} />;
  return (
    <>
      <TabLock tab={tab} lock={lock} />
      {content}
    </>
  );
}
/** One tab of a new application (Summary or Application): editable, nothing locked, Create inserts the request. */
export async function NewTabContent({
  opportunity,
  tab,
}: {
  opportunity: OpportunityRecord;
  tab: "summary" | "application";
}) {
  if (tab === "summary") return <SummaryTab opportunity={opportunity} />;
  return (
    <ApplicationTab
      opportunityId={String(opportunity.opportunities_id)}
      lock={{ known: false, locked: false }}
      texts={await applicationTexts()}
    />
  );
}
