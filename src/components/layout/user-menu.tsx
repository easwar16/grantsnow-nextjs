"use client";
import { useEffect, useRef, useState } from "react";
import { SessionControls } from "./session-controls";
type Panel = "profile" | "preferences" | "accessibility";
export function UserMenu({
  name,
  organization,
}: {
  name: string;
  organization: string;
}) {
  const menu = useRef<HTMLDetailsElement>(null),
    trigger = useRef<HTMLElement>(null),
    dialog = useRef<HTMLDialogElement>(null);
  const [panel, setPanel] = useState<Panel>("profile"),
    [theme, setTheme] = useState("default"),
    [contrast, setContrast] = useState(false),
    [textSize, setTextSize] = useState("default");
  const organisationDark = useRef(false);
  useEffect(() => {
    organisationDark.current =
      document.querySelector(".app")?.classList.contains("dark") === true;
    const close = (event: PointerEvent) => {
      if (menu.current && !menu.current.contains(event.target as Node))
        menu.current.open = false;
    };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, []);
  function open(next: Panel) {
    setPanel(next);
    if (menu.current) menu.current.open = false;
    dialog.current?.showModal();
  }
  function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const root = document.querySelector(".app");
    if (panel === "preferences") {
      root?.classList.toggle(
        "dark",
        theme === "default" ? organisationDark.current : theme === "theme-dark",
      );
    } else {
      root?.classList.toggle("accessibility-contrast", contrast);
      root?.classList.toggle("accessibility-large", textSize === "large");
    }
    dialog.current?.close();
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
          <span aria-hidden="true">▾</span>
        </summary>
        <div
          className="user-menu-content"
          role="menu"
          aria-label={name}
          onKeyDown={menuKeys}
        >
          <button role="menuitem" onClick={() => open("profile")}>
            <span className="ux-icon" aria-hidden="true">
              {"\uf8a8"}
            </span>
            Manage profile
          </button>
          <button role="menuitem" onClick={() => open("preferences")}>
            <span className="ux-icon" aria-hidden="true">
              {"\uf34b"}
            </span>
            Preferences
          </button>
          <button role="menuitem" onClick={() => open("accessibility")}>
            <span className="ux-icon" aria-hidden="true">
              {"\uf103"}
            </span>
            Accessibility
          </button>
          <form action="/api/auth/logout" method="post">
            <button role="menuitem" type="submit">
              <span className="ux-icon" aria-hidden="true">
                {"\uf2d5"}
              </span>
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
        onClose={() => trigger.current?.focus()}
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
            ×
          </button>
        </header>
        {panel === "profile" ? (
          <>
            <dl>
              <dt>Name</dt>
              <dd>{name}</dd>
              <dt>Organization</dt>
              <dd>{organization}</dd>
            </dl>
            <p className="muted">
              Identity is supplied by GrantsNow. Profile editing is not yet
              connected.
            </p>
            <SessionControls />
          </>
        ) : (
          <form onSubmit={save}>
            {panel === "preferences" ? (
              <fieldset>
                <legend>Theme</legend>
                {[
                  ["default", "Organisation default"],
                  ["theme-light", "Light"],
                  ["theme-dark", "Dark"],
                ].map(([value, label]) => (
                  <label key={value}>
                    <input
                      type="radio"
                      name="theme"
                      value={value}
                      checked={theme === value}
                      onChange={() => setTheme(value)}
                    />
                    {label}
                  </label>
                ))}
              </fieldset>
            ) : (
              <>
                <label>
                  <input
                    type="checkbox"
                    checked={contrast}
                    onChange={(e) => setContrast(e.target.checked)}
                  />
                  High contrast
                </label>
                <label>
                  Text size
                  <select
                    value={textSize}
                    onChange={(e) => setTextSize(e.target.value)}
                  >
                    <option value="default">Default</option>
                    <option value="large">Large</option>
                  </select>
                </label>
              </>
            )}
            <p className="muted">
              Applies to the current browser session. Server preference
              persistence is not yet connected.
            </p>
            <footer>
              <button type="submit" className="primary">
                Save
              </button>
            </footer>
          </form>
        )}
      </dialog>
    </>
  );
}
