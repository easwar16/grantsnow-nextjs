import Link from "next/link";
import { Suspense } from "react";
import { pageIdentity } from "@/server/identity/auth/page";
import { requireModule } from "@/server/platform/permissions";
import {
  parseContractQuery,
  contractSearch,
} from "@/features/modules/contracts/schema";
import { State } from "@/components/feedback/state";
import { Skeleton } from "@/components/feedback/skeleton";
import { Icon } from "@/components/ui/icon";
import {
  ContractFilters,
  ContractResults,
  NewContractAction,
} from "../listing-sections";
import styles from "../contracts.module.css";
import { contractStatusChoices } from "@/server/modules/contracts/service";
import { orNull } from "@/server/record/shared";
import { idPart } from "@/lib/ids";

export const metadata = { title: "Contracts" };

export default async function Contracts({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { user } = await pageIdentity("/contracts");
  try {
    requireModule(user, "CONTRACTS");
  } catch {
    return (
      <State
        title="Access denied"
        message="Contracts access has not been granted."
        code="FORBIDDEN"
      />
    );
  }
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(await searchParams)) {
    if (typeof value === "string") params.set(key, value);
    else if (Array.isArray(value))
      for (const item of value) params.append(key, item);
  }
  // An unreadable lookup leaves only All; the list itself still loads.
  const statuses = (await orNull(contractStatusChoices())) ?? [
    { value: "", label: "All" },
  ];
  let query;
  try {
    query = parseContractQuery(params);
  } catch {
    return (
      <State
        title="Invalid filters"
        message="Open Contracts from the navigation to reset the query."
        code="BAD_REQUEST"
      />
    );
  }
  return (
    <section id="contracts" className={styles.workspace}>
      <aside
        id="contracts-filters"
        className={styles.filters}
        aria-label="Contract filters"
      >
        <h2 className="sr-only">Filters</h2>
        <nav
          id="contracts-statuses"
          aria-label="Contract status"
          className={styles.statuses}
        >
          {statuses.map(({ value, label }) => (
            <Link
              key={value}
              id={`contracts-status-${idPart(value || "all")}`}
              href={`/contracts?${contractSearch({ ...query, status: value, page: 1 })}`}
              aria-current={query.status === value ? "page" : undefined}
              prefetch={false}
            >
              {label}
            </Link>
          ))}
        </nav>
        <Suspense
          fallback={
            <Skeleton kind="lines" count={7} label="Loading Contract filters" />
          }
        >
          <ContractFilters query={query} />
        </Suspense>
      </aside>
      <div className={styles.results}>
        <header id="contracts-toolbar" className={styles.toolbar}>
          <h1 className="sr-only">Contracts</h1>
          <input
            id="contract-filter-toggle"
            type="checkbox"
            className={styles.drawerToggle}
            aria-label="Show contract filters"
            defaultChecked
          />
          <label
            htmlFor="contract-filter-toggle"
            className={styles.toggleButton}
            title="Toggle filters"
          >
            <Icon name="collapse-menu" />
            <span className="sr-only">Toggle filters</span>
          </label>
          <Suspense
            fallback={
              <Skeleton
                kind="lines"
                count={1}
                label="Loading New Contract action"
              />
            }
          >
            <NewContractAction />
          </Suspense>
        </header>
        <Suspense
          fallback={
            <Skeleton kind="list" count={5} label="Loading Contracts" />
          }
        >
          <ContractResults query={query} />
        </Suspense>
      </div>
    </section>
  );
}
