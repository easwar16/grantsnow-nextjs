"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { Icon } from "@/components/ui/icon";
import { ToastProvider } from "@/components/feedback/toast";
import { AppStoreProvider } from "@/lib/app-store";
import { applyAccessibility } from "@/features/account/apply";
import type { ShellLabels } from "@/features/account/shell-labels";
import type { FormatSettings } from "@/lib/format";
import { UserMenu } from "./user-menu";
import { SessionKeepAlive } from "./session-keepalive";
import { NotificationBell } from "./notification-bell";
import { IdleDialog } from "./idle-dialog";
import { ConfigureDrawer, type ConfigureMode } from "./configure-drawer";
import { ShellProvider } from "./shell-context";
export function AppShell({
  children,
  accessibility,
  name,
  navigation,
  labels,
  format,
}: {
  children: React.ReactNode;
  accessibility: Record<string, number>;
  name: string;
  navigation: React.ReactNode;
  labels: ShellLabels;
  format?: FormatSettings;
}) {
  const drawer = useRef<HTMLDialogElement>(null),
    trigger = useRef<HTMLButtonElement>(null);
  const [drawerOpen, setDrawerOpen] = useState(false),
    [configure, setConfigure] = useState<ConfigureMode | null>(null);
  const path = usePathname();
  useEffect(() => {
    drawer.current?.close();
  }, [path]);
  useEffect(() => {
    applyAccessibility(accessibility);
  }, [accessibility]);
  return (
    <ToastProvider>
      <AppStoreProvider>
        <ShellProvider value={{ labels, format }}>
          <div
            id="shell"
            className={`shell-frame${drawerOpen ? " shell-drawer-open" : ""}${configure ? " shell-configure-open" : ""}`}
          >
            <header id="shell-header" className="header">
              <button
                ref={trigger}
                id="shell-menu-button"
                className="header-icon"
                aria-label={labels.navigation}
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
              <Link
                id="shell-brand"
                className="brand"
                href="/home"
                prefetch={false}
              >
                <Image
                  src="/brand/grantsnow.svg"
                  alt={labels.logo}
                  width={120}
                  height={34}
                  priority
                />
              </Link>
              <div className="header-end">
                <Link
                  id="shell-help"
                  className="header-icon"
                  href="/modules/tutorials"
                  prefetch={false}
                  aria-label="Help"
                >
                  <Icon name="help" />
                </Link>
                <NotificationBell />
                <UserMenu name={name} onConfigure={setConfigure} />
              </div>
            </header>
            <SessionKeepAlive />
            <IdleDialog />
            <dialog
              ref={drawer}
              id="navigation-drawer"
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
                  id="navigation-drawer-close"
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
                path.startsWith("/proposals") ||
                path.startsWith("/opportunities")
                  ? "proposal-workspace"
                  : "home-workspace"
              }
            >
              {children}
            </main>
            {configure && (
              <ConfigureDrawer
                key={configure}
                mode={configure}
                onClose={() => {
                  setConfigure(null);
                  // Focus goes back to the menu the drawer was opened from.
                  document
                    .querySelector<HTMLElement>(".user-menu > summary")
                    ?.focus();
                }}
              />
            )}
          </div>
        </ShellProvider>
      </AppStoreProvider>
    </ToastProvider>
  );
}
