import Link from "next/link";
import { pageIdentity } from "@/server/auth/page";
import { loadSummary } from "@/server/proposals/record";
import { recordIdentity } from "@/features/proposals/record";
import { State } from "@/components/feedback/state";
import { publicError } from "@/lib/errors";
import { dateDisplay } from "@/lib/format";
export const metadata = { title: "Proposal Summary" };
export default async function Summary({
  params,
}: {
  params: Promise<{ type: string; id: string }>;
}) {
  const input = recordIdentity.safeParse(await params);
  if (!input.success)
    return <State title="Invalid proposal identity" code="BAD_REQUEST" />;
  await pageIdentity(`/proposals/${input.data.type}/${input.data.id}`);
  let summary;
  try {
    summary = await loadSummary(input.data);
  } catch (e) {
    const error = publicError(e);
    return (
      <State
        title={
          error.code === "FORBIDDEN" ? "Access denied" : "Proposal unavailable"
        }
        message={error.message}
        code={error.code}
      />
    );
  }
  return (
    <section className="record-workspace">
      <header className="record-header">
        <Link href="/proposals" prefetch={false}>
          ← Proposals
        </Link>
        <div>
          <strong>{summary.reference}</strong>
          <span className="record-chip">{summary.status}</span>
        </div>
        <h1>{summary.title}</h1>
      </header>
      <div className="record-body">
        <nav aria-label="Proposal sections">
          <Link
            href={`/proposals/${summary.type}/${summary.id}`}
            aria-current="page"
          >
            Summary
          </Link>
        </nav>
        <section className="summary-panel" aria-label="Proposal Summary">
          <h2>Summary</h2>
          <div className="summary-grid">
            {summary.fields.map((f) => (
              <div
                className={
                  f.key === "project-description"
                    ? "summary-field wide"
                    : "summary-field"
                }
                key={f.key}
              >
                <strong>{f.label}</strong>
                <p>
                  {f.kind === "date" ? dateDisplay(f.value) : f.value || "—"}
                </p>
              </div>
            ))}
          </div>
        </section>
      </div>
    </section>
  );
}
