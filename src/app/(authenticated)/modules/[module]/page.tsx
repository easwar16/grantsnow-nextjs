import Link from "next/link";
import { notFound } from "next/navigation";
import { pageIdentity } from "@/server/identity/auth/page";
import { drawerAccess } from "@/server/platform/permissions";
import { label, resources } from "@/server/platform/configuration/resources";
import { placeholderModules } from "@/lib/unavailable-modules";

export default async function UnavailableModule({
  params,
}: {
  params: Promise<{ module: string }>;
}) {
  const { module } = await params;
  const entry = placeholderModules.find((item) => item.id === module);
  if (!entry) notFound();
  const { user } = await pageIdentity(`/modules/${entry.id}`);
  // Same grant as the drawer entry; without it the module does not exist for this user.
  if (!drawerAccess(user.modules, entry.id)) notFound();
  const name = label(
    await resources(),
    "dashboard",
    "module-name",
    entry.id,
    entry.name,
  );
  return (
    <section
      id="unavailable-module"
      className="unavailable-module"
      aria-labelledby="module-heading"
    >
      <h1 id="module-heading">{name}</h1>
      <div
        id="unavailable-module-message"
        className="unavailable-module-message"
        role="status"
      >
        <h2>Module not available for now</h2>
        <p>{name} has not been implemented in this application yet.</p>
        <Link id="unavailable-module-home" className="button" href="/home">
          Back to Home
        </Link>
      </div>
    </section>
  );
}
