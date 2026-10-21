"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { unavailableModules } from "@/lib/unavailable-modules";
export function Navigation({
  proposals,
  opportunities,
  opportunityApplications,
  opportunityAnalytics,
  homeLabel,
  proposalsLabel,
}: {
  proposals: boolean;
  opportunities: boolean;
  opportunityApplications: boolean;
  opportunityAnalytics: boolean;
  homeLabel: string;
  proposalsLabel: string;
}) {
  const path = usePathname();
  return (
    <nav aria-label="Main navigation">
      <Link
        href="/home"
        prefetch={false}
        aria-current={path === "/home" ? "page" : undefined}
      >
        <span className="ux-icon" aria-hidden="true">
          {"\uf298"}
        </span>
        {homeLabel}
      </Link>
      {(opportunities || opportunityApplications || opportunityAnalytics) && (
        <details
          className="navigation-group"
          open={path.startsWith("/opportunities")}
        >
          <summary>
            <span className="ux-icon" aria-hidden="true">
              {"\uf215"}
            </span>{" "}
            Opportunities
          </summary>
          <div>
            {opportunities && (
              <Link
                href="/opportunities"
                prefetch={false}
                aria-current={path === "/opportunities" ? "page" : undefined}
              >
                Funding opportunities
              </Link>
            )}
            {opportunityApplications && (
              <Link
                href="/opportunities/eoi"
                prefetch={false}
                aria-current={
                  path.startsWith("/opportunities/eoi") ? "page" : undefined
                }
              >
                Applications of Interest
              </Link>
            )}
            {opportunityAnalytics && (
              <Link
                href="/opportunities/analytics"
                prefetch={false}
                aria-current={
                  path === "/opportunities/analytics" ? "page" : undefined
                }
              >
                Analytics
              </Link>
            )}
          </div>
        </details>
      )}
      {proposals && (
        <Link
          href="/proposals"
          prefetch={false}
          aria-current={path.startsWith("/proposals") ? "page" : undefined}
        >
          <span className="ux-icon" aria-hidden="true">
            {"\uf25d"}
          </span>
          {proposalsLabel}
        </Link>
      )}
      {unavailableModules.map((item) => (
        <Link
          key={item.id}
          href={`/modules/${item.id}`}
          prefetch={false}
          className={
            item.id === "administration"
              ? "navigation-utility-start"
              : undefined
          }
          aria-current={path === `/modules/${item.id}` ? "page" : undefined}
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            aria-hidden="true"
          >
            {item.icon === "person" ? (
              <>
                <circle cx="10" cy="6" r="3" />
                <path d="M4 21v-5a6 6 0 0 1 12 0v5M18 9v6m-3-3h6" />
              </>
            ) : item.icon === "archive" ? (
              <>
                <path d="M3 4h18v4H3zM5 8v13h14V8M9 12h6" />
                <circle cx="12" cy="16" r="2" />
              </>
            ) : item.icon === "message" ? (
              <path d="M3 3h18v14H9l-5 4v-4H3zM7 7h10M7 11h7" />
            ) : (
              <path d="M5 2h9l5 5v15H5zM14 2v6h5M8 12h8M8 16h8" />
            )}
          </svg>
          {item.label}
        </Link>
      ))}
    </nav>
  );
}
