import { StatusBadge } from "@/components/ui/status-badge";
import { displayFormat } from "@/server/platform/configuration/formatting";
import Link from "next/link";
import { pageIdentity } from "@/server/identity/auth/page";
import { loadSummary } from "@/server/modules/proposals/record";
import { recordIdentity } from "@/features/modules/proposals/record";
import { State } from "@/components/feedback/state";
import { Icon } from "@/components/ui/icon";
import { functions } from "@/lib/functions";

export const metadata = { title: "Proposal Summary" };
export default async function Summary({
  params,
}: {
  params: Promise<{ type: string; id: string }>;
}) {
  // Format loads beside the identity and summary, not before them.
  const formatRead = displayFormat();
  formatRead.catch(() => undefined);
  const input = recordIdentity.safeParse(await params);
  if (!input.success)
    return <State title="Invalid proposal identity" code="BAD_REQUEST" />;
  await pageIdentity(`/proposals/${input.data.type}/${input.data.id}`);
  let summary;
  try {
    summary = await loadSummary(input.data);
  } catch (e) {
    const error = functions.errors.publicError(e);
    return (
      <State
        title={
          error.code === "FORBIDDEN" ? "Access denied" : "Proposal unavailable"
        }
        message={error.message}
        action={error.action}
        code={error.code}
      />
    );
  }
  const format = await formatRead;
  return (
    <section className="record-workspace">
      <header className="record-header">
        <Link href="/proposals" prefetch={false}>
          <Icon name="arrow-left" /> Proposals
        </Link>
        <div>
          <strong>{summary.reference}</strong>
          <StatusBadge>{summary.status}</StatusBadge>
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
                  {f.kind === "date"
                    ? functions.format.dateDisplay(f.value, format)
                    : f.value || "—"}
                </p>
              </div>
            ))}
          </div>
        </section>
      </div>
    </section>
  );
}
