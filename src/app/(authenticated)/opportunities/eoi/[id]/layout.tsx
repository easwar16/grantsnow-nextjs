import Link from "next/link";
import { pageIdentity } from "@/server/auth/page";
import { eoiRecordContext } from "@/server/opportunities/record";
import { State } from "@/components/feedback/state";
import { publicError } from "@/lib/errors";
export default async function EoiLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  await pageIdentity(`/opportunities/eoi/${id}/summary`);
  let access;
  try {
    access = await eoiRecordContext(id);
  } catch (error) {
    const e = publicError(error);
    return (
      <State
        title={
          e.code === "FORBIDDEN" ? "Access denied" : "Application unavailable"
        }
        message={e.message}
        code={e.code}
      />
    );
  }
  return (
    <section className="record-workspace">
      <header className="record-header">
        <Link href="/opportunities/eoi" prefetch={false}>
          ← Applications of Interest
        </Link>
        <h1>Application of Interest</h1>
      </header>
      <div className="record-body">
        <nav aria-label="Application sections">
          {access.tabs.map((tab) => (
            <Link
              key={tab}
              href={`/opportunities/eoi/${id}/${tab}`}
              prefetch={false}
            >
              {tab.startsWith("dynamic-form-")
                ? `Dynamic Form ${tab.slice(-1)}`
                : tab.charAt(0).toUpperCase() + tab.slice(1)}
            </Link>
          ))}
        </nav>
        <div className="summary-panel">{children}</div>
      </div>
    </section>
  );
}
