"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { MotionConfig } from "motion/react";
import { Icon } from "@/components/ui/icon";
import { ToastProvider } from "@/components/feedback/toast";
import { AppStoreProvider } from "@/lib/store/app-store";
import { applyAccessibility } from "@/features/modules/account/apply";
import type { ShellLabels } from "@/features/modules/account/shell-labels";
import { type FormatSettings } from "@/lib/format";
import { UserMenu } from "./user-menu";
import { SessionKeepAlive } from "./session-keepalive";
import { NotificationBell } from "./notification-bell";
import { IdleDialog } from "./idle-dialog";
import { TruncatedTitles } from "./truncated-titles";
import { ConfigureDrawer, type ConfigureMode } from "./configure-drawer";
import { ShellProvider, type ShellUser } from "./shell-context";
import { constants } from "@/lib/constants";
export function AppShell({
  children,
  accessibility,
  user,
  logo,
  navigation,
  guide,
  labels,
  format,
}: {
  children: React.ReactNode;
  accessibility: Record<string, number>;
  user: ShellUser;
  /** The configured logo (already checked on the server); the GrantsNow logo when absent. */
  logo?: string;
  navigation: React.ReactNode;
  guide?: React.ReactNode;
  labels: ShellLabels;
  format?: FormatSettings;
}) {
  const drawer = useRef<HTMLDialogElement>(null),
    trigger = useRef<HTMLButtonElement>(null);
  const [drawerOpen, setDrawerOpen] = useState(false),
    [configure, setConfigure] = useState<ConfigureMode | null>(null);
  const path = usePathname(),
    shownPath = useRef(path);
  // Only a navigation closes the drawer: on mount this would close one opened by a click replayed during hydration.
  useEffect(() => {
    if (shownPath.current === path) return;
    shownPath.current = path;
    drawer.current?.close();
  }, [path]);
  useEffect(() => {
    applyAccessibility(accessibility);
  }, [accessibility]);
  useEffect(() => {
    // IANA names are cookie-safe (letters, digits, / _ + -).
    const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    document.cookie = `${constants.cookies.timeZone}=${zone}; path=/; max-age=31536000; samesite=lax`;
  }, []);
  return (
    // Motion follows prefers-reduced-motion, as the CSS motion tokens do.
    <MotionConfig reducedMotion="user">
      <ToastProvider>
        <AppStoreProvider>
          <ShellProvider value={{ labels, format, user }}>
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
                  {logo ? (
                    // eslint-disable-next-line @next/next/no-img-element -- an admin-configured address on any host.
                    <img
                      src={logo}
                      alt={labels.logo}
                      title={labels.logo}
                      width={120}
                      height={34}
                    />
                  ) : (
                    <Image
                      src="/brand/grantsnow.svg"
                      alt={labels.logo}
                      title={labels.logo}
                      width={120}
                      height={34}
                      priority
                    />
                  )}
                </Link>
                <div className="header-end">
                  {guide}
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
                  <UserMenu name={user.name} onConfigure={setConfigure} />
                </div>
              </header>
              <SessionKeepAlive />
              <IdleDialog />
              <TruncatedTitles />
              <dialog
                ref={drawer}
                id="navigation-drawer"
                className="navigation-drawer"
                aria-label={labels.navigation}
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
                    aria-label={labels.close}
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
                  path.startsWith("/opportunities") ||
                  path.startsWith("/contracts") ||
                  path.startsWith("/awards") ||
                  path.startsWith("/claims")
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
    </MotionConfig>
  );
}
