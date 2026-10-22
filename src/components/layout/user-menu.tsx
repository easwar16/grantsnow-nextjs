"use client";
import { useEffect, useRef, useState } from "react";
import { ProfileDialog } from "@/features/account/profile-dialog";
import { Icon } from "@/components/ui/icon";
import type { ConfigureMode } from "./configure-drawer";
import { useShell } from "./shell-context";
/** The header's user name and menu (GN-Angular header user menu); Preferences/Accessibility open the end drawer. */
export function UserMenu({
  name,
  onConfigure,
}: {
  name: string;
  onConfigure: (mode: ConfigureMode) => void;
}) {
  const { labels } = useShell();
  const menu = useRef<HTMLDetailsElement>(null),
    trigger = useRef<HTMLElement>(null),
    dialog = useRef<HTMLDialogElement>(null);
  const [profileOpen, setProfileOpen] = useState(false);
  useEffect(() => {
    const close = (event: PointerEvent) => {
      if (menu.current && !menu.current.contains(event.target as Node))
        menu.current.open = false;
    };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, []);
  function closeMenu() {
    if (menu.current) menu.current.open = false;
  }
  function menuKeys(event: React.KeyboardEvent<HTMLDivElement>) {
    const items = [
      ...event.currentTarget.querySelectorAll<HTMLButtonElement>(
        '[role="menuitem"]',
      ),
    ];
    const index = items.indexOf(document.activeElement as HTMLButtonElement);
    if (["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) {
      event.preventDefault();
      const next =
        event.key === "Home"
          ? 0
          : event.key === "End"
            ? items.length - 1
            : (index + (event.key === "ArrowDown" ? 1 : items.length - 1)) %
              items.length;
      items[next]?.focus();
    }
    if (event.key === "Escape") {
      event.preventDefault();
      closeMenu();
      trigger.current?.focus();
    }
  }
  return (
    <>
      <details className="user-menu" ref={menu}>
        <summary
          ref={trigger}
          aria-haspopup="menu"
          onKeyDown={(event) => {
            if (event.key !== "ArrowDown") return;
            event.preventDefault();
            if (menu.current) menu.current.open = true;
            menu.current
              ?.querySelector<HTMLButtonElement>('[role="menuitem"]')
              ?.focus();
          }}
        >
          {name}
          <Icon name="caret-down" />
        </summary>
        <div
          className="user-menu-content"
          role="menu"
          aria-label={name}
          onKeyDown={menuKeys}
        >
          <button
            role="menuitem"
            onClick={() => {
              closeMenu();
              setProfileOpen(true);
              dialog.current?.showModal();
            }}
          >
            <Icon name="user-configuration" />
            {labels.manageProfile}
          </button>
          <button
            role="menuitem"
            onClick={() => {
              closeMenu();
              onConfigure("preferences");
            }}
          >
            <Icon name="settings" />
            {labels.preferences}
          </button>
          <button
            role="menuitem"
            onClick={() => {
              closeMenu();
              onConfigure("accessibility");
            }}
          >
            <Icon name="accessibility" />
            {labels.accessibility}
          </button>
          <form action="/api/auth/logout" method="post">
            <button role="menuitem" type="submit">
              <Icon name="logout" />
              {labels.signOut}
            </button>
          </form>
        </div>
      </details>
      <dialog
        ref={dialog}
        className="profile-dialog"
        aria-labelledby="profile-title"
        onClose={() => {
          setProfileOpen(false);
          trigger.current?.focus();
        }}
      >
        {profileOpen && (
          <ProfileDialog onClose={() => dialog.current?.close()} />
        )}
      </dialog>
    </>
  );
}
