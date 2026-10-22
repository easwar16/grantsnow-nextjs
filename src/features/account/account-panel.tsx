"use client";
import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useRemote } from "@/lib/use-remote";
import { DetailSkeleton, RecordSkeleton } from "@/components/feedback/skeleton";
import { useInFlight } from "@/lib/use-in-flight";
import { Icon } from "@/components/ui/icon";
import {
  accessibilityKeys,
  accessibilityLabels,
  nextAccessibility,
  type AccountData,
} from "./contracts";
export function applyAccountSettings(
  theme: string,
  accessibility: Record<string, number>,
) {
  const app = document.querySelector(".app");
  app?.classList.toggle("dark", theme === "theme-dark");
  for (const key of accessibilityKeys) {
    for (const cls of [...document.documentElement.classList])
      if (cls.startsWith(`${key}-`))
        document.documentElement.classList.remove(cls);
    document.documentElement.classList.add(`${key}-${accessibility[key] || 0}`);
  }
}
export function AccountPanel({
  panel,
  close,
}: {
  panel: "profile" | "preferences" | "accessibility";
  close: () => void;
}) {
  const remote = useRemote<AccountData>(`/api/account?panel=${panel}`);
  if (!remote.data && !remote.error) return <DetailSkeleton />;
  if (remote.error)
    return (
      <div role="alert">
        <p>{remote.error.message}</p>
        <button onClick={remote.retry}>Retry</button>
      </div>
    );
  if (!remote.data) return null;
  return (
    <AccountForm
      key={panel}
      panel={panel}
      initial={remote.data}
      close={close}
    />
  );
}
function AccountForm({
  panel,
  initial,
  close,
}: {
  panel: "profile" | "preferences" | "accessibility";
  initial: AccountData;
  close: () => void;
}) {
  const committed = useRef(false);
  useEffect(
    () => () => {
      if (panel === "accessibility" && !committed.current)
        applyAccountSettings(
          initial.settings.theme,
          initial.settings.accessibility,
        );
    },
    [panel, initial],
  );
  const router = useRouter();
  const [tab, setTab] = useState("profile");
  const [settings, setSettings] = useState(initial.settings);
  const [research, setResearch] = useState(initial.research);
  const [status, setStatus] = useState(initial.status);
  const { run, busy } = useInFlight();
  const [error, setError] = useState("");
  async function save(event: React.FormEvent) {
    event.preventDefault();
    // Blocks Save and Cancel from click to settle, success or failure (D44).
    await run(async () => {
      setError("");
      try {
        const response = await fetch("/api/account", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            kind:
              panel === "profile"
                ? tab === "manage"
                  ? "status"
                  : "research"
                : "dashboard",
            changes:
              panel === "profile"
                ? tab === "manage"
                  ? status
                  : research
                : panel === "accessibility"
                  ? { accessibility: settings.accessibility }
                  : Object.fromEntries(
                      Object.entries(settings).filter(
                        ([k]) => k !== "accessibility",
                      ),
                    ),
          }),
        });
        const body = await response.json();
        if (!response.ok)
          throw new Error(
            body.error?.message || "Settings could not be saved.",
          );
        if (panel !== "profile")
          applyAccountSettings(settings.theme, settings.accessibility);
        committed.current = true;
        close();
        router.refresh();
      } catch (e) {
        setError(
          e instanceof Error ? e.message : "Settings could not be saved.",
        );
      }
    });
  }
  function visibility(
    group: "needAttention" | "insights",
    key: string,
    value: boolean,
  ) {
    setSettings((s) => ({ ...s, [group]: { ...s[group], [key]: value } }));
  }
  const images = [
    "biggerText.png",
    "dyslexicFont.png",
    "lineHeight.png",
    "letterSpacings.png",
    "cursor.png",
    "highlight-link.png",
    "contrastTheme.png",
  ];
  return (
    <form onSubmit={save} aria-busy={busy}>
      {panel === "profile" && (
        <>
          <div
            className="account-tabs"
            role="tablist"
            aria-label="Manage profile sections"
            onKeyDown={(event) => {
              if (
                !["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)
              )
                return;
              event.preventDefault();
              const buttons = [
                ...event.currentTarget.querySelectorAll<HTMLButtonElement>(
                  "button",
                ),
              ];
              const current = buttons.indexOf(
                document.activeElement as HTMLButtonElement,
              );
              const next =
                event.key === "Home"
                  ? 0
                  : event.key === "End"
                    ? buttons.length - 1
                    : (current +
                        (event.key === "ArrowRight" ? 1 : buttons.length - 1)) %
                      buttons.length;
              buttons[next]?.click();
              buttons[next]?.focus();
            }}
          >
            {[
              "profile",
              ...(initial.researchAllowed ? ["pref"] : []),
              ...(initial.manageAllowed ? ["manage"] : []),
            ].map((id) => (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={tab === id}
                onClick={() => setTab(id)}
              >
                {id === "profile"
                  ? "Profile"
                  : id === "pref"
                    ? "Preference"
                    : "Manage"}
              </button>
            ))}
          </div>
          {tab === "profile" ? (
            <div className="profile-grid">
              <Icon name="employee" className="profile-avatar" />
              <dl>
                {initial.fields.map((f, i) => (
                  <div key={i}>
                    <dt>{f.label}</dt>
                    <dd>{f.value}</dd>
                  </div>
                ))}
              </dl>
            </div>
          ) : tab === "manage" ? (
            <StatusEditor
              value={status}
              onChange={setStatus}
              organizations={initial.organizations}
            />
          ) : (
            <div className="research-fields">
              {Object.entries(research).map(([key, values]) => (
                <ResearchSelection
                  key={key}
                  label={
                    {
                      research_areas: "Research areas of interest",
                      favourite_funder: "Favourite funder",
                      research_keywords: "Research keyword preference",
                    }[key] || key
                  }
                  options={initial.options[key] || []}
                  values={values}
                  onChange={(next) =>
                    setResearch((r) => ({ ...r, [key]: next }))
                  }
                />
              ))}
            </div>
          )}
        </>
      )}
      {panel === "preferences" && (
        <>
          <h3>Theme</h3>
          <div className="theme-tiles">
            {["theme-default", "theme-dark"].map((theme) => (
              <button
                key={theme}
                type="button"
                aria-pressed={settings.theme === theme}
                onClick={() => setSettings((s) => ({ ...s, theme }))}
              >
                <span className={`theme-swatch ${theme}`} />
                {theme.replace("theme-", "")}
              </button>
            ))}
            <button
              type="button"
              onClick={() =>
                setSettings((s) => ({ ...s, theme: "theme-default" }))
              }
            >
              Reset
            </button>
          </div>
          <h3>Infolets</h3>
          {(["needAttention", "insights"] as const).map((group) => (
            <fieldset key={group}>
              <legend>
                {group === "needAttention" ? "Need Attention" : "Insights"}
              </legend>
              <label>
                <input
                  type="checkbox"
                  role="switch"
                  checked={Object.values(settings[group]).some(Boolean)}
                  onChange={(e) =>
                    setSettings((s) => ({
                      ...s,
                      [group]: Object.fromEntries(
                        Object.keys(s[group]).map((k) => [k, e.target.checked]),
                      ),
                    }))
                  }
                />
                Show all
              </label>
              {Object.entries(settings[group]).map(([key, value]) => (
                <label key={key}>
                  <input
                    type="checkbox"
                    role="switch"
                    checked={value}
                    onChange={(e) => visibility(group, key, e.target.checked)}
                  />
                  {initial.labels[key] || friendlyName(key)}
                </label>
              ))}
            </fieldset>
          ))}
          {(["opportunity", "notifications"] as const).map(
            (key) =>
              settings[key] !== undefined && (
                <label key={key}>
                  <input
                    type="checkbox"
                    role="switch"
                    checked={settings[key]}
                    onChange={(e) =>
                      setSettings((s) => ({ ...s, [key]: e.target.checked }))
                    }
                  />
                  {key === "opportunity" ? "Opportunities" : "Notifications"}
                </label>
              ),
          )}
        </>
      )}
      {panel === "accessibility" && (
        <div className="accessibility-tiles">
          {accessibilityKeys.map((key, i) => (
            <button
              type="button"
              key={key}
              className={settings.accessibility[key] ? "selected" : ""}
              aria-label={`${accessibilityLabels[i]}: ${settings.accessibility[key] || 0}%`}
              onClick={() => {
                const accessibility = {
                  ...settings.accessibility,
                  [key]: nextAccessibility(
                    key,
                    settings.accessibility[key] || 0,
                  ),
                };
                setSettings((s) => ({ ...s, accessibility }));
                applyAccountSettings(settings.theme, accessibility);
              }}
            >
              <progress max={100} value={settings.accessibility[key] || 0} />
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={`/accessibility/${images[i]}`}
                alt={accessibilityLabels[i]}
                width={100}
                height={100}
              />
              <span>{accessibilityLabels[i]}</span>
            </button>
          ))}
        </div>
      )}
      {error && <p role="alert">{error}</p>}
      <footer>
        <button
          type="button"
          disabled={busy}
          onClick={() => {
            applyAccountSettings(
              initial.settings.theme,
              initial.settings.accessibility,
            );
            close();
          }}
        >
          Cancel
        </button>
        {(panel !== "profile" || tab !== "profile") && (
          <button className="primary" disabled={busy} type="submit">
            {busy ? "Saving…" : "Save"}
          </button>
        )}
      </footer>
    </form>
  );
}
function friendlyName(key: string) {
  return key
    .replace(/Chart$/, "")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/^pBy/, "Proposals by ")
    .replace(/^eBy/, "Ethics by ")
    .replace(/^aBy/, "Awards by ");
}
function ResearchSelection({
  label,
  options,
  values,
  onChange,
}: {
  label: string;
  options: string[];
  values: string[];
  onChange: (v: string[]) => void;
}) {
  const [draft, setDraft] = useState("");
  return (
    <div>
      <label>
        {label}
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          list={label.replaceAll(" ", "-")}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              const value = draft.trim();
              if (value && !value.includes(","))
                onChange([...new Set([...values, value])]);
              setDraft("");
            }
          }}
        />
      </label>
      <datalist id={label.replaceAll(" ", "-")}>
        {options.map((value) => (
          <option key={value} value={value} />
        ))}
      </datalist>
      <button
        type="button"
        onClick={() => {
          const value = draft.trim();
          if (value && !value.includes(","))
            onChange([...new Set([...values, value])]);
          setDraft("");
        }}
      >
        Add
      </button>
      <div className="research-chips">
        {values.map((value) => (
          <button
            type="button"
            key={value}
            aria-label={`Remove ${value}`}
            onClick={() => onChange(values.filter((v) => v !== value))}
          >
            {value} <Icon name="close" size={12} />
          </button>
        ))}
      </div>
    </div>
  );
}

function StatusEditor({
  value,
  onChange,
  organizations,
}: {
  value: AccountData["status"];
  onChange: (v: AccountData["status"]) => void;
  organizations: AccountData["organizations"];
}) {
  const [org, setOrg] = useState("");
  const people = useRemote<{ id: string; name: string }[]>(
    org ? `/api/account?organization=${encodeURIComponent(org)}` : undefined,
  );
  const local = (v: string) => {
    const d = new Date(v);
    return Number.isFinite(d.getTime())
      ? new Date(d.getTime() - d.getTimezoneOffset() * 60000)
          .toISOString()
          .slice(0, 16)
      : "";
  };
  return (
    <div className="research-fields">
      <label>
        Select Status
        <select
          value={value.status_code}
          onChange={(e) =>
            onChange({
              ...value,
              status_code: e.target.value as "ACTIVE" | "OOO",
            })
          }
        >
          <option value="ACTIVE">Active</option>
          <option value="OOO">Out of Office</option>
        </select>
      </label>
      {value.status_code === "OOO" && (
        <>
          <label>
            Start Date Time
            <input
              type="datetime-local"
              required
              value={local(value.effective_start_date)}
              onChange={(e) =>
                onChange({
                  ...value,
                  effective_start_date: e.target.value
                    ? new Date(e.target.value).toISOString()
                    : "",
                })
              }
            />
          </label>
          <label>
            End Date Time
            <input
              type="datetime-local"
              required
              value={local(value.effective_end_date)}
              onChange={(e) =>
                onChange({
                  ...value,
                  effective_end_date: e.target.value
                    ? new Date(e.target.value).toISOString()
                    : "",
                })
              }
            />
          </label>
          <label>
            Status Message
            <textarea
              required
              value={value.status_msg}
              onChange={(e) =>
                onChange({ ...value, status_msg: e.target.value })
              }
            />
          </label>
          <label>
            Select Org
            <select value={org} onChange={(e) => setOrg(e.target.value)}>
              <option value="">Select organization</option>
              {organizations.map((o) => (
                <option value={o.id} key={o.id}>
                  {o.name}
                </option>
              ))}
            </select>
          </label>
          {people.error ? (
            <div role="alert">
              {people.error.message}
              <button type="button" onClick={people.retry}>
                Retry
              </button>
            </div>
          ) : org && !people.data ? (
            <RecordSkeleton label="Loading proxy directory" rows={1} />
          ) : (
            <label>
              Select Proxy
              <select
                value=""
                disabled={!people.data}
                onChange={(e) => {
                  if (
                    e.target.value &&
                    !value.proxy_users.some(
                      (p) => p.org_id === org && p.proxy_pid === e.target.value,
                    )
                  )
                    onChange({
                      ...value,
                      proxy_users: [
                        ...value.proxy_users,
                        { org_id: org, proxy_pid: e.target.value },
                      ],
                    });
                }}
              >
                <option value="">Select proxy</option>
                {people.data?.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </label>
          )}
          <table>
            <thead>
              <tr>
                <th>Org Name</th>
                <th>Proxy</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {value.proxy_users.map((p, i) => (
                <tr key={`${p.org_id}:${p.proxy_pid}`}>
                  <td>
                    {organizations.find((o) => o.id === p.org_id)?.name ||
                      p.org_id}
                  </td>
                  <td>
                    {people.data?.find((person) => person.id === p.proxy_pid)
                      ?.name || p.proxy_pid}
                  </td>
                  <td>
                    <button
                      type="button"
                      onClick={() =>
                        onChange({
                          ...value,
                          proxy_users: value.proxy_users.filter(
                            (_, index) => index !== i,
                          ),
                        })
                      }
                    >
                      Remove
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </div>
  );
}
