"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { Icon } from "@/components/ui/icon";
import { UserMenu } from "./user-menu";
import { SessionKeepAlive } from "./session-keepalive";
export function AppShell({
  children,
  accessibility,
  name,
  organization,
  navigation,
}: {
  children: React.ReactNode;
  accessibility: Record<string, number>;
  name: string;
  organization: string;
  navigation: React.ReactNode;
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
          <Icon name="menu" size={24} />
        </button>
        <Link className="brand" href="/home" prefetch={false}>
          <Image
            src="/brand/grantsnow.svg"
            alt="Grants Now Logo"
            width={120}
            height={34}
            priority
          />
        </Link>
        <UserMenu
          name={name}
          organization={organization}
          accessibility={accessibility}
        />
      </header>
      <SessionKeepAlive />
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
            <Icon name="close" />
          </button>
        </div>
        {navigation}
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
