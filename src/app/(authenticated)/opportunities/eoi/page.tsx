import { displayFormat } from "@/server/configuration/formatting";
import Link from "next/link";
import { pageIdentity } from "@/server/auth/page";
import { requireDrawerAccess } from "@/server/permissions/policy";
import { eoiQuerySchema, listEois } from "@/server/opportunities/eoi";
import { RecordMetadata } from "@/components/ui/record-metadata";
import { State } from "@/components/feedback/state";
import { publicError } from "@/lib/errors";
import { dateDisplay } from "@/lib/format";
import { FilterPanel } from "@/components/ui/filter-panel";
import styles from "./page.module.css";
export const metadata = { title: "Applications of interest" };
export default async function Eois({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const format = await displayFormat();
  const { user } = await pageIdentity("/opportunities/eoi");
  try {
    requireDrawerAccess(user, "opportunities-eoi-list");
  } catch {
    return <State title="Access denied" code="FORBIDDEN" />;
  }
  const p = await searchParams;
  const parsed = eoiQuerySchema.safeParse(p);
  if (!parsed.success)
    return <State title="Invalid application filters" code="BAD_REQUEST" />;
  const q = parsed.data;
  let data;
  try {
    data = await listEois(q);
  } catch (error) {
    const e = publicError(error);
    return (
      <State
        title="Applications unavailable"
        message={e.message}
        action={e.action}
        code={e.code}
      />
    );
  }
  const href = (page: number) =>
    `/opportunities/eoi?${new URLSearchParams({ ...q, page: String(page) })}`;
  return (
    <section className="page-fill" aria-label="Applications of Interest">
      <FilterPanel
        id="eoi-filters"
        label="Application filters"
        page="opportunities-eoi"
        filters={
          <form action="/opportunities/eoi" className={styles.filters}>
            <label>
              Opportunity title
              <input name="search" defaultValue={q.search} />
            </label>
            <label>
              Application reference
              <input name="reference" defaultValue={q.reference} />
            </label>
            <label>
              Status code
              <input
                name="status"
                defaultValue={q.status}
                pattern="[A-Z0-9_]*"
              />
            </label>
            <div className={styles.actions}>
              <button type="submit">Search</button>
              <Link className="button" href="/opportunities/eoi">
                Clear
              </Link>
            </div>
          </form>
        }
      >
        <div className="eoi-workspace">
          <h1>Applications of Interest</h1>
          {data.rows.length ? (
            <div className="proposal-cards">
              {data.rows.map((row) => (
                <article className="proposal-card" key={row.id}>
                  <div className="record-overline">
                    <strong>
                      <Link
                        href={`/opportunities/eoi/${row.id}/summary`}
                        prefetch={false}
                      >
                        {row.reference}
                      </Link>
                    </strong>
                    {row.status && (
                      <span className="record-chip">{row.status}</span>
                    )}
                  </div>
                  {row.title && <h2 className="record-title">{row.title}</h2>}
                  <RecordMetadata
                    fields={[
                      { label: "Created by", value: row.investigator },
                      { label: "Org Unit", value: row.organization },
                      { label: "Sponsor", value: row.sponsor },
                      {
                        label: "Created On",
                        value: row.created
                          ? dateDisplay(row.created, format)
                          : undefined,
                      },
                      {
                        label: "Updated On",
                        value: row.updated
                          ? dateDisplay(row.updated, format)
                          : undefined,
                      },
                    ]}
                  />
                </article>
              ))}
            </div>
          ) : (
            <State title="No matching applications" />
          )}
          <p className="listing-count">
            {data.rows.length} of {data.total}
          </p>
          <div className="pagination">
            <span>Page {q.page}</span>
            {q.page > 1 && (
              <Link className="button" href={href(q.page - 1)}>
                Previous
              </Link>
            )}
            {data.hasMore && (
              <Link className="button" href={href(q.page + 1)}>
                Next
              </Link>
            )}
          </div>
        </div>
      </FilterPanel>
    </section>
  );
}
