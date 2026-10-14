import {
  eoiRecordIdentity,
  eoiRecordForms,
  eoiRecordTable,
  eoiSummary,
  type EoiTab,
} from "@/server/opportunities/record";
import { State } from "@/components/feedback/state";
import { publicError } from "@/lib/errors";
import { dateDisplay } from "@/lib/format";
async function load(id: string, tab: EoiTab) {
  if (tab === "summary")
    return { kind: "summary" as const, data: await eoiSummary(id) };
  if (tab === "application" || tab.startsWith("dynamic-form-"))
    return {
      kind: "forms" as const,
      data: await eoiRecordForms(
        id,
        tab as "application" | `dynamic-form-${1 | 2 | 3 | 4 | 5}`,
      ),
    };
  return {
    kind: "table" as const,
    data: await eoiRecordTable(
      id,
      tab as "attachments" | "approvals" | "delegation" | "history",
    ),
  };
}
export default async function EoiSection({
  params,
}: {
  params: Promise<{ id: string; tab: string }>;
}) {
  const input = eoiRecordIdentity.safeParse(await params);
  if (!input.success)
    return <State title="Invalid application page" code="BAD_REQUEST" />;
  const { id, tab } = input.data;
  let loaded;
  try {
    loaded = await load(id, tab);
  } catch (error) {
    const e = publicError(error);
    return (
      <State
        title={
          e.code === "FORBIDDEN"
            ? "Access denied"
            : "Application page unavailable"
        }
        message={e.message}
        code={e.code}
      />
    );
  }
  if (loaded.kind === "summary") {
    const b = loaded.data;
    return (
      <>
        <div className="record-overline">
          <strong>{b.reference}</strong>
          {b.status && <span className="record-chip">{b.status}</span>}
        </div>
        {b.opportunity && <h2>{b.opportunity.title}</h2>}
        <dl className="record-metadata">
          <div>
            <dt>Created On</dt>
            <dd>{dateDisplay(b.created)}</dd>
          </div>
          {b.updated && (
            <div>
              <dt>Updated On</dt>
              <dd>{dateDisplay(b.updated)}</dd>
            </div>
          )}
        </dl>
        {b.opportunity?.summary && (
          <section>
            <h2>Summary</h2>
            <div
              className="announcement-content"
              dangerouslySetInnerHTML={{ __html: b.opportunity.summary }}
            />
          </section>
        )}
      </>
    );
  }
  if (loaded.kind === "forms") {
    const forms = loaded.data;
    return (
      <>
        <h2>
          {tab === "application"
            ? "Application"
            : `Dynamic Form ${tab.slice(-1)}`}
        </h2>
        {forms.length ? (
          forms.map((form) => (
            <section key={form.id} className="eoi-form">
              <h2>{form.name}</h2>
              {form.sections.map((section) => (
                <section key={section.id}>
                  <h3>{section.name}</h3>
                  {section.type !== "FORM" && (
                    <p className="notice">
                      This configured section uses {section.type}. Its
                      interactive renderer is not yet implemented.
                    </p>
                  )}
                  <div className="summary-grid">
                    {section.fields.map((field) => (
                      <div key={field.id} className="summary-field">
                        <strong>{field.label}</strong>
                        <p>{field.value}</p>
                      </div>
                    ))}
                  </div>
                </section>
              ))}
            </section>
          ))
        ) : (
          <State
            title="No forms configured"
            message="No visible forms were returned for this application page."
          />
        )}
      </>
    );
  }
  const table = loaded.data;
  return (
    <>
      <h2>{tab.charAt(0).toUpperCase() + tab.slice(1)}</h2>
      {table.rows.length ? (
        <div className="eoi-table-wrap">
          <table>
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
                <tr key={row.id}>
                  {table.columns.map((c) => (
                    <td key={c.key}>
                      {c.key.endsWith("date")
                        ? dateDisplay(row.values[c.key])
                        : row.values[c.key]}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <State title="No records returned" />
      )}
    </>
  );
}
