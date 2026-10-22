"use client";
import { useEffect, useRef, useState } from "react";
import { accessibilityKeys } from "@/features/account/contracts";
import { AccountPanel } from "@/features/account/account-panel";
import { Icon } from "@/components/ui/icon";
type Panel = "profile" | "preferences" | "accessibility";
export function UserMenu({
  name,
  accessibility,
}: {
  name: string;
  organization?: string;
  accessibility: Record<string, number>;
}) {
  const menu = useRef<HTMLDetailsElement>(null),
    trigger = useRef<HTMLElement>(null),
    dialog = useRef<HTMLDialogElement>(null);
  const [opened, setOpened] = useState(false);
  const [panel, setPanel] = useState<Panel>("profile");
  useEffect(() => {
    for (const key of accessibilityKeys) {
      for (const cls of [...document.documentElement.classList])
        if (cls.startsWith(`${key}-`))
          document.documentElement.classList.remove(cls);
      document.documentElement.classList.add(
        `${key}-${accessibility[key] || 0}`,
      );
    }
  }, [accessibility]);
  useEffect(() => {
    const close = (event: PointerEvent) => {
      if (menu.current && !menu.current.contains(event.target as Node))
        menu.current.open = false;
    };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, []);
  function open(next: Panel) {
    setOpened(true);
    setPanel(next);
    if (menu.current) menu.current.open = false;
    dialog.current?.showModal();
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
      if (menu.current) menu.current.open = false;
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
            if (event.key === "ArrowDown") {
              event.preventDefault();
              if (menu.current) menu.current.open = true;
              menu.current
                ?.querySelector<HTMLButtonElement>('[role="menuitem"]')
                ?.focus();
            }
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
          <button role="menuitem" onClick={() => open("profile")}>
            <Icon name="user-configuration" />
            Manage profile
          </button>
          <button role="menuitem" onClick={() => open("preferences")}>
            <Icon name="settings" />
            Preferences
          </button>
          <button role="menuitem" onClick={() => open("accessibility")}>
            <Icon name="accessibility" />
            Accessibility
          </button>
          <form action="/api/auth/logout" method="post">
            <button role="menuitem" type="submit">
              <Icon name="logout" />
              Sign Out
            </button>
          </form>
        </div>
      </details>
      <dialog
        ref={dialog}
        className={`account-dialog account-dialog-${panel}`}
        aria-label={
          panel === "profile"
            ? "Manage profile"
            : panel === "preferences"
              ? "User Preferences"
              : "Accessibility"
        }
        onClose={() => {
          setOpened(false);
          trigger.current?.focus();
        }}
      >
        <header>
          <h2>
            {panel === "profile"
              ? "Manage profile"
              : panel === "preferences"
                ? "User Preferences"
                : "Accessibility"}
          </h2>
          <button
            className="dialog-close"
            aria-label="Close account settings"
            onClick={() => dialog.current?.close()}
          >
            <Icon name="close" />
          </button>
        </header>
        {opened && (
          <AccountPanel panel={panel} close={() => dialog.current?.close()} />
        )}
      </dialog>
    </>
  );
}
