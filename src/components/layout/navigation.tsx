"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
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
    </nav>
  );
}
