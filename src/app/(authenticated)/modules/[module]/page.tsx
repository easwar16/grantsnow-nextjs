import Link from "next/link";
import { notFound } from "next/navigation";
import { pageIdentity } from "@/server/auth/page";
import { unavailableModules } from "@/lib/unavailable-modules";

export default async function UnavailableModule({
  params,
}: {
  params: Promise<{ module: string }>;
}) {
  const { module } = await params;
  const entry = unavailableModules.find((item) => item.id === module);
  if (!entry) notFound();
  await pageIdentity(`/modules/${entry.id}`);
  return (
    <section className="unavailable-module" aria-labelledby="module-heading">
      <h1 id="module-heading">{entry.label}</h1>
      <div className="unavailable-module-message" role="status">
        <h2>Module not available for now</h2>
        <p>{entry.label} has not been implemented in this application yet.</p>
        <Link className="button" href="/home">
          Back to Home
        </Link>
      </div>
    </section>
  );
}
