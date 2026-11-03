import Link from "next/link";
import { pageIdentity } from "@/server/identity/auth/page";
import { ethicsRecord } from "@/server/modules/ethics/record";
import { ReadonlyField } from "@/components/ui/readonly-field";
import { State } from "@/components/feedback/state";
import styles from "@/features/modules/ethics/record.module.css";

export const metadata = { title: "Ethics application" };

export default async function EthicsRecord({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ access?: string }>;
}) {
  await pageIdentity("/ethics");
  const [{ id }, { access }] = await Promise.all([params, searchParams]);
  const record = await ethicsRecord(id, access).catch(() => null);
  if (!record)
    return (
      <State
        title="Ethics application unavailable"
        message="This application could not be opened with your current access."
        code="FORBIDDEN"
      />
    );
  return (
    <main id="ethics-record" className={styles.page}>
      <div className={styles.toolbar}>
        <Link id="ethics-back" href="/ethics">
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
      <section
        id="ethics-overview"
        className={styles.section}
        aria-labelledby="ethics-overview-title"
      >
        <h2 id="ethics-overview-title">Ethics application</h2>
        <div className={styles.fields}>
          <ReadonlyField
            id="ethics-number"
            label="Application Number"
            value={record.number}
          />
          <ReadonlyField
            id="ethics-status"
            label="Status"
            value={record.status}
          />
          <ReadonlyField id="ethics-title" label="Title" value={record.title} />
          <ReadonlyField
            id="ethics-type"
            label="Ethics Type"
            value={record.ethicsType}
          />
          <ReadonlyField
            id="ethics-form-type"
            label="Form Type"
            value={record.formType}
          />
          <ReadonlyField id="ethics-org" label="Org Unit" value={record.org} />
          <ReadonlyField id="ethics-risk" label="Risk" value={record.risk} />
          <ReadonlyField
            id="ethics-deadline"
            label="Deadline Date"
            value={record.deadline}
          />
          <ReadonlyField
            id="ethics-expiry"
            label="Expiry Date"
            value={record.expiry}
          />
        </div>
      </section>
    </main>
  );
}
