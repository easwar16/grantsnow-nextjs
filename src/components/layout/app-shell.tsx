"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { Navigation } from "./navigation";
import { UserMenu } from "./user-menu";
export function AppShell({
  children,
  name,
  organization,
  proposals,
  opportunities,
  opportunityApplications,
  opportunityAnalytics,
  homeLabel,
  proposalsLabel,
}: {
  children: React.ReactNode;
  name: string;
  organization: string;
  proposals: boolean;
  opportunities: boolean;
  opportunityApplications: boolean;
  opportunityAnalytics: boolean;
  homeLabel: string;
  proposalsLabel: string;
}) {
  const drawer = useRef<HTMLDialogElement>(null),
    trigger = useRef<HTMLButtonElement>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const path = usePathname();
  useEffect(() => {
    drawer.current?.close();
  }, [path]);
  return (
    <div className={`shell-frame${drawerOpen ? " shell-drawer-open" : ""}`}>
      <header className="header">
        <button
          ref={trigger}
          className="header-icon"
          aria-label="Application Navigation Drawer"
          aria-haspopup="dialog"
          aria-expanded={drawerOpen}
          onClick={() => {
            if (drawer.current?.open) {
              drawer.current.close();
              return;
            }
            if (window.matchMedia("(max-width: 600px)").matches)
              drawer.current?.showModal();
            else drawer.current?.show();
            setDrawerOpen(true);
          }}
        >
          <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true">
            <path
              d="M3 5h18M3 12h18M3 19h18"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
            />
          </svg>
        </button>
        <Link className="brand" href="/home" prefetch={false}>
          <Image
            src="/brand/grantsnow.svg"
            alt="Grants Now Logo"
            width={125}
            height={36}
            priority
          />
        </Link>
        <UserMenu name={name} organization={organization} />
      </header>
      <dialog
        ref={drawer}
        className="navigation-drawer"
        aria-label="Application navigation"
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            event.preventDefault();
            drawer.current?.close();
          }
        }}
        onClose={() => {
          setDrawerOpen(false);
          trigger.current?.focus();
        }}
        onClick={(e) => {
          if (e.target === e.currentTarget) drawer.current?.close();
        }}
      >
        <div className="drawer-heading">
          <span className="sr-only">GrantsNow navigation</span>
          <button
            aria-label="Close navigation"
            onClick={() => drawer.current?.close()}
          >
            ×
          </button>
        </div>
        <Navigation
          proposals={proposals}
          opportunities={opportunities}
          opportunityApplications={opportunityApplications}
          opportunityAnalytics={opportunityAnalytics}
          homeLabel={homeLabel}
          proposalsLabel={proposalsLabel}
        />
      </dialog>
      <main
        id="main"
        className={
          path.startsWith("/proposals") || path.startsWith("/opportunities")
            ? "proposal-workspace"
            : "home-workspace"
        }
      >
        {children}
      </main>
    </div>
  );
}
