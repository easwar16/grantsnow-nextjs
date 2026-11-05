import Link from "next/link";
import { pageIdentity } from "@/server/identity/auth/page";
import { dueDiligenceHistoryHost, dueDiligenceRecord } from "@/server/modules/due-diligence/record";
import { historyView } from "@/server/record/objects/history";
import { ObjectHistory } from "@/features/record/objects/object-history";
import { ReadonlyField } from "@/components/ui/readonly-field";
import { State } from "@/components/feedback/state";
import styles from "@/features/modules/ethics/record.module.css";

export const metadata = { title: "Due Diligence application" };

export default async function DueDiligenceRecord({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ access?: string; tab?: string }>;
}) {
  await pageIdentity("/due-diligence");
  const [{ id }, { access, tab }] = await Promise.all([params, searchParams]);
  const record = await dueDiligenceRecord(id, access).catch(() => null);
  if (!record)
    return (
      <State
        title="Due Diligence application unavailable"
        message="This application could not be opened with your current access."
        code="FORBIDDEN"
      />
    );
  const current = tab ?? record.tabs[0];
  if (!record.tabs.includes(current as (typeof record.tabs)[number]))
    return (
      <State
        title="Due Diligence section unavailable"
        message="You do not have access to this section."
        code="FORBIDDEN"
      />
    );
  const history =
    current === "duediligence-history"
      ? await historyView(await dueDiligenceHistoryHost(id)).catch(() => null)
      : null;
  const names: Record<string, string> = {
    "duediligence-general-overview": "Setup",
    "duediligence-responses": "Responses",
    "duediligence-attachments": "Attachments",
    "duediligence-approvals": "Approvals",
    "duediligence-history": "History",
  };
  return (
    <main id="due-diligence-record" className={styles.page}>
      <div className={styles.toolbar}>
        <Link id="due-diligence-back" href="/due-diligence">
          ← List
        </Link>
      </div>
      <div className={styles.heading}>
        <div>
          <strong>{record.number}</strong>
          <span>{record.status}</span>
          <span>{record.risk}</span>
        </div>
        <h1>{record.title || record.number}</h1>
      </div>
      <nav id="due-diligence-record-tabs" className={styles.tabs} aria-label="Due Diligence sections">
        {record.tabs.map((page) => (
          <Link
            key={page}
            id={`due-diligence-tab-${page}`}
            aria-current={current === page ? "page" : undefined}
            href={`/due-diligence/${record.id}?access=${record.access}&tab=${page}`}
          >
            {names[page]}
          </Link>
        ))}
      </nav>
      {current === "duediligence-history" ? (
        history ? (
          <ObjectHistory id="due-diligence-history" host={{ host: "due-diligence", record: record.id }} view={history} />
        ) : (
          <State title="History unavailable" message="The history could not be loaded." code="ERROR" />
        )
      ) : current === "duediligence-general-overview" ? (
      <>
      <section
        id="due-diligence-overview"
        className={styles.section}
        aria-labelledby="due-diligence-overview-title"
      >
        <h2 id="due-diligence-overview-title">Due Diligence application</h2>
        <div className={styles.fields}>
          <ReadonlyField
            id="due-diligence-number"
            label="Application Number"
            value={record.number}
          />
          <ReadonlyField
            id="due-diligence-status"
            label="Status"
            value={record.status}
          />
          <ReadonlyField
            id="due-diligence-title"
            label="Title"
            value={record.title}
          />
          <ReadonlyField
            id="due-diligence-type"
            label="Due Diligence Type"
            value={record.dueDiligenceType}
          />
          <ReadonlyField
            id="due-diligence-form-type"
            label="Form Type"
            value={record.formType}
          />
          <ReadonlyField
            id="due-diligence-org"
            label="Org Unit"
            value={record.org}
          />
          <ReadonlyField
            id="due-diligence-risk"
            label="Risk"
            value={record.risk}
          />
          <ReadonlyField
            id="due-diligence-deadline"
            label="Deadline Date"
            value={record.deadline}
          />
          <ReadonlyField
            id="due-diligence-expiry"
            label="Expiry Date"
            value={record.expiry}
          />
        </div>
      </section>
      <section
        id="due-diligence-people"
        className={styles.section}
        aria-labelledby="due-diligence-people-title"
      >
        <h2 id="due-diligence-people-title">Participants and Supervisor</h2>
        <ReadonlyField
          id="due-diligence-supervisor"
          label="Supervisor"
          value={record.supervisor}
        />
        {record.respondents.length ? (
          <ul id="due-diligence-participants">
            {record.respondents.map((person) => (
              <li id={`due-diligence-participant-${person.id}`} key={person.id}>
                {person.name} {person.org && `— ${person.org}`}{" "}
                {person.status && `— ${person.status}`}
              </li>
            ))}
          </ul>
        ) : (
          <p id="due-diligence-no-participants">No participants added.</p>
        )}
      </section>
      </>
      ) : (
        <State title={`${names[current]} unavailable`} message="This section could not be loaded." code="ERROR" />
      )}
    </main>
  );
}
