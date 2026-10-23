"use client";
import { idPart } from "@/lib/ids";
import { useEffect, useId, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useRemote } from "@/lib/use-remote";
import { useInFlight } from "@/lib/use-in-flight";
import { Skeleton } from "@/components/feedback/skeleton";
import { useToast } from "@/components/feedback/toast";
import { HelpButton } from "@/components/ui/help-button";
import { Icon } from "@/components/ui/icon";
import {
  accessibilityKeys,
  accessibilityLabels,
  nextAccessibility,
  preferencesChanges,
  type AccountData,
} from "@/features/account/contracts";
import { findTheme, DEFAULT_THEME } from "@/features/account/themes";
import {
  applyAccessibility,
  applyTheme,
  postAccount,
  saveFailure,
} from "@/features/account/apply";
import { useShell } from "./shell-context";
import styles from "./configure-drawer.module.css";
export type ConfigureMode = "preferences" | "accessibility";
// GN-Angular PANELS: the original's tile images and widths.
const tiles = [
  ["biggerText.png", 100],
  ["dyslexicFont.png", 100],
  ["lineHeight.png", 100],
  ["letterSpacings.png", 100],
  ["cursor.png", 90],
  ["highlight-link.png", 90],
  ["contrastTheme.png", 90],
] as const;
/**
 * The right-hand push drawer (GN-Angular configure-drawer, the original .vb-configure-drawer): Preferences or
 * Accessibility. Changes preview at once; Save writes them, closing without saving puts the saved state back.
 */
export function ConfigureDrawer({
  mode,
  onClose,
}: {
  mode: ConfigureMode;
  onClose: () => void;
}) {
  const { labels } = useShell();
  const remote = useRemote<AccountData>(`/api/account?panel=${mode}`);
  const title = useId();
  return (
    <aside
      id="configure-drawer"
      className={styles.drawer}
      role="dialog"
      aria-labelledby={title}
      onKeyDown={(e) => {
        if (e.key === "Escape") onClose();
      }}
    >
      <div className={styles.head}>
        <h2 id={title}>
          {mode === "accessibility"
            ? labels.accessibilityTitle
            : labels.userPreferences}
        </h2>
        <button
          id="configure-drawer-close"
          type="button"
          className={styles.iconButton}
          aria-label={labels.close}
          onClick={onClose}
          autoFocus
        >
          <Icon name="close" />
        </button>
      </div>
      {remote.error ? (
        <div id="configure-drawer-error" className={styles.body} role="alert">
          <p>{remote.error.message}</p>
          {remote.error.action && <p>{remote.error.action}</p>}
          <button
            id="configure-drawer-retry"
            type="button"
            className={styles.textButton}
            onClick={remote.retry}
          >
            Retry
          </button>
        </div>
      ) : remote.data ? (
        <Settings
          key={mode}
          mode={mode}
          initial={remote.data}
          onClose={onClose}
        />
      ) : (
        <div className={styles.body}>
          <Skeleton kind="lines" count={4} label="Loading settings" />
        </div>
      )}
    </aside>
  );
}
function Settings({
  mode,
  initial,
  onClose,
}: {
  mode: ConfigureMode;
  initial: AccountData;
  onClose: () => void;
}) {
  const { labels } = useShell();
  const toast = useToast();
  const router = useRouter();
  // Legacy shows the infolet switches on Home only (`currentPage.id === 'home-start'`).
  const onHome = usePathname() === "/home";
  const { run, busy } = useInFlight();
  const [draft, setDraft] = useState(initial.settings);
  const saved = useRef(false);
  // Leaving without saving puts the saved look back, whichever way the drawer closes.
  useEffect(
    () => () => {
      if (saved.current) return;
      applyAccessibility(initial.settings.accessibility);
      if (initial.themes.length > 0)
        applyTheme(findTheme(initial.themes, initial.settings.theme));
    },
    [initial],
  );
  function pickTheme(id: string) {
    setDraft((d) => ({ ...d, theme: id }));
    applyTheme(findTheme(initial.themes, id));
  }
  function step(key: string) {
    const accessibility = {
      ...draft.accessibility,
      [key]: nextAccessibility(key, draft.accessibility[key] || 0),
    };
    setDraft((d) => ({ ...d, accessibility }));
    applyAccessibility(accessibility);
  }
  function setGroup(group: "needAttention" | "insights", on: boolean) {
    setDraft((d) => ({
      ...d,
      [group]: Object.fromEntries(Object.keys(d[group]).map((k) => [k, on])),
    }));
  }
  async function save() {
    // Blocks Save from click to settle (D44).
    await run(async () => {
      try {
        await postAccount("dashboard", preferencesChanges(mode, draft, onHome));
        saved.current = true;
        toast.show("success", "Preferences saved");
        onClose();
        router.refresh();
      } catch (e) {
        saveFailure(toast, e as { code?: string; message: string });
      }
    });
  }
  return (
    <>
      <div id="configure-settings" className={styles.body}>
        {mode === "accessibility" ? (
          <div
            id="configure-accessibility"
            className={`${styles.panels} enter-fade`}
          >
            {accessibilityKeys.map((key, i) => {
              const level = draft.accessibility[key] || 0;
              return (
                <button
                  id={`configure-accessibility-${idPart(key)}`}
                  type="button"
                  key={key}
                  className={styles.panel}
                  aria-pressed={level > 0}
                  aria-label={`${accessibilityLabels[i]}: ${level}%`}
                  onClick={() => step(key)}
                >
                  <span className={styles.level}>
                    <span style={{ width: `${level}%` }} />
                  </span>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={`/accessibility/${tiles[i][0]}`}
                    alt=""
                    width={tiles[i][1]}
                  />
                </button>
              );
            })}
          </div>
        ) : (
          <>
            <section id="configure-theme" className="enter-fade">
              <h3 className={styles.heading}>
                {labels.theme}{" "}
                <HelpButton id="configure-theme-help" html={labels.themeHelp} />
              </h3>
              <div className={styles.themes}>
                <div
                  id="configure-theme-list"
                  className={styles.swatches}
                  role="radiogroup"
                  aria-label={labels.theme}
                >
                  {initial.themes.map((t) => (
                    <button
                      id={`configure-theme-${t.id}`}
                      type="button"
                      key={t.id}
                      role="radio"
                      className={styles.theme}
                      title={t.name}
                      aria-label={t.name}
                      aria-checked={(draft.theme || DEFAULT_THEME) === t.id}
                      onClick={() => pickTheme(t.id)}
                    >
                      <span
                        className={styles.swatch}
                        style={{ background: t.primary }}
                      />
                      <span
                        className={styles.swatch}
                        style={{ background: t.secondary }}
                      />
                    </button>
                  ))}
                </div>
                <button
                  id="configure-theme-reset"
                  type="button"
                  className={styles.textButton}
                  title="Reset to the organisation default theme"
                  onClick={() => pickTheme(DEFAULT_THEME)}
                >
                  <Icon name="reset" size={14} /> Reset
                </button>
              </div>
            </section>
            {onHome && (
              <section id="configure-infolets">
                <h3 className={styles.heading}>
                  {labels.infolets}{" "}
                  <HelpButton
                    id="configure-infolets-help"
                    html={labels.infoletsHelp}
                  />
                </h3>
                {(["needAttention", "insights"] as const).map((group) => (
                  <div key={group} id={`configure-group-${idPart(group)}`}>
                    <label className={styles.switch}>
                      <span>{labels[group]}</span>
                      <input
                        id={`configure-group-${idPart(group)}-switch`}
                        type="checkbox"
                        role="switch"
                        checked={Object.values(draft[group]).some(Boolean)}
                        onChange={(e) => setGroup(group, e.target.checked)}
                      />
                    </label>
                    <div className={styles.children}>
                      {Object.entries(draft[group]).map(([key, on]) => (
                        <label className={styles.switch} key={key}>
                          <span>{initial.labels[key]}</span>
                          <input
                            id={`configure-infolet-${idPart(key)}`}
                            type="checkbox"
                            role="switch"
                            checked={on}
                            onChange={(e) =>
                              setDraft((d) => ({
                                ...d,
                                [group]: {
                                  ...d[group],
                                  [key]: e.target.checked,
                                },
                              }))
                            }
                          />
                        </label>
                      ))}
                    </div>
                  </div>
                ))}
                {(["opportunity", "notifications"] as const).map(
                  (key) =>
                    draft[key] !== undefined && (
                      <label className={styles.switch} key={key}>
                        <span>
                          {key === "opportunity"
                            ? labels.opportunities
                            : labels.notifications}
                        </span>
                        <input
                          id={`configure-${key}`}
                          type="checkbox"
                          role="switch"
                          checked={draft[key] === true}
                          onChange={(e) =>
                            setDraft((d) => ({ ...d, [key]: e.target.checked }))
                          }
                        />
                      </label>
                    ),
                )}
              </section>
            )}
          </>
        )}
      </div>
      <div id="configure-footer" className={styles.foot}>
        <button
          id="configure-save"
          type="button"
          className={styles.primary}
          disabled={busy}
          onClick={() => void save()}
        >
          {labels.save}
        </button>
      </div>
    </>
  );
}
