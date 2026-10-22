"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useRemote } from "@/lib/use-remote";
import { useInFlight } from "@/lib/use-in-flight";
import { Skeleton, RecordSkeleton } from "@/components/feedback/skeleton";
import { useToast } from "@/components/feedback/toast";
import { Icon } from "@/components/ui/icon";
import { useShell } from "@/components/layout/shell-context";
import { postAccount, saveFailure } from "./apply";
import {
  presenceKeys,
  type AccountData,
  type DigitalPresence,
} from "./contracts";
import styles from "./profile-dialog.module.css";
type Tab = "profile" | "pref" | "digital-presence" | "manage";
type Failure = { code?: string; message: string; action?: string };
// GN-Angular LINKS: one field per network with its logo.
const links: Record<keyof DigitalPresence, [string, string]> = {
  linkedin: ["LinkedIn", "/images/linkedIn.png"],
  scholar: [
    "Google Scholar",
    "/images/Google-Scholar--Streamline-Font-Awesome.svg",
  ],
  research_gate: ["ResearchGate URL", "/images/RG_Logo.02_Black.White.png"],
  orc_id: ["ORCID", "/images/ORCID_full_logo.png"],
  researcher_id: ["Researcher ID", "/images/ORCID_full_logo.png"],
};
/** Manage profile (GN-Angular profile-dialog): read-only profile, opportunity preferences, digital presence, status. */
export function ProfileDialog({ onClose }: { onClose: () => void }) {
  const { labels } = useShell();
  const remote = useRemote<AccountData>("/api/account?panel=profile");
  return (
    <>
      <div className={styles.head}>
        <h2 id="profile-title">{labels.manageProfileTitle}</h2>
        <button
          id="profile-close"
          type="button"
          className={styles.close}
          aria-label={labels.close}
          onClick={onClose}
        >
          <Icon name="close" />
        </button>
      </div>
      {remote.error ? (
        <div id="profile-error" className={styles.body} role="alert">
          <p>{remote.error.message}</p>
          {remote.error.action && <p>{remote.error.action}</p>}
          <button id="profile-retry" type="button" onClick={remote.retry}>
            Retry
          </button>
        </div>
      ) : remote.data ? (
        <Profile initial={remote.data} onClose={onClose} />
      ) : (
        <div className={styles.body}>
          <Skeleton kind="lines" count={4} label="Loading profile" />
        </div>
      )}
    </>
  );
}
function Profile({
  initial,
  onClose,
}: {
  initial: AccountData;
  onClose: () => void;
}) {
  const { labels } = useShell();
  const toast = useToast();
  const router = useRouter();
  const { run, busy } = useInFlight();
  const tabs: Tab[] = [
    "profile",
    ...(initial.researchAllowed ? (["pref"] as const) : []),
    ...(initial.presenceAllowed ? (["digital-presence"] as const) : []),
    ...(initial.manageAllowed ? (["manage"] as const) : []),
  ];
  const [tab, setTab] = useState<Tab>("profile");
  const [research, setResearch] = useState(initial.research);
  const [status, setStatus] = useState(initial.status);
  const [presence, setPresence] = useState<DigitalPresence | null>(null);
  const presenceRemote = useRemote<DigitalPresence>(
    tab === "digital-presence" ? "/api/account?panel=presence" : undefined,
  );
  const announced = useRef(false);
  useEffect(() => {
    // The original tells an out-of-office user so when the profile opens.
    if (initial.status.status_code !== "OOO" || announced.current) return;
    announced.current = true;
    toast.show("info", labels.statusOoo);
  }, [initial, toast, labels]);
  async function save(kind: string, changes: unknown, success: string) {
    // Blocks Save from click to settle (D44).
    await run(async () => {
      try {
        await postAccount(kind, changes);
        toast.show("success", success);
        onClose();
        router.refresh();
      } catch (e) {
        saveFailure(toast, e as Failure);
      }
    });
  }
  function saveStatus() {
    if (
      status.status_code === "OOO" &&
      (status.effective_start_date === "" ||
        status.status_msg.trim() === "" ||
        status.proxy_users.length === 0)
    ) {
      toast.show("error", labels.dataIncomplete, "Please fill in all the data");
      return;
    }
    void save("status", status, labels.statusUpdated);
  }
  const tabName: Record<Tab, string> = {
    profile: labels.profile,
    pref: labels.preference,
    "digital-presence": labels.digitalPresence,
    manage: labels.manage,
  };
  const presenceValue = presence ?? presenceRemote.data ?? null;
  const footer = (name: string, onSave: () => void) => (
    <div className={styles.foot}>
      <button
        id={`profile-${name}-save`}
        type="button"
        className="primary"
        disabled={busy}
        onClick={onSave}
      >
        {labels.save}
      </button>
    </div>
  );
  return (
    <>
      <div
        id="profile-tabs"
        className={styles.tabs}
        role="tablist"
        aria-label="Manage profile sections"
        onKeyDown={(event) => {
          if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key))
            return;
          event.preventDefault();
          const current = tabs.indexOf(tab);
          const next =
            event.key === "Home"
              ? 0
              : event.key === "End"
                ? tabs.length - 1
                : (current +
                    (event.key === "ArrowRight" ? 1 : tabs.length - 1)) %
                  tabs.length;
          setTab(tabs[next]);
          event.currentTarget
            .querySelectorAll<HTMLButtonElement>('[role="tab"]')
            [next]?.focus();
        }}
      >
        {tabs.map((id) => (
          <button
            key={id}
            id={`profile-tab-${id}`}
            type="button"
            role="tab"
            aria-selected={tab === id}
            tabIndex={tab === id ? 0 : -1}
            onClick={() => setTab(id)}
          >
            {tabName[id]}
          </button>
        ))}
      </div>
      <div
        id="profile-panel"
        className={styles.body}
        role="tabpanel"
        aria-label={tabName[tab]}
      >
        <div className="enter-fade" key={tab}>
          {tab === "profile" && (
            <div id="profile-details" className={styles.profile}>
              <div className={styles.avatar}>
                <Icon name="employee" size={48} />
              </div>
              <dl className={styles.facts}>
                {initial.fields.map((f, i) => (
                  <div key={i}>
                    <dt>{f.label}</dt>
                    <dd>{f.value}</dd>
                  </div>
                ))}
              </dl>
            </div>
          )}
          {tab === "pref" && (
            <>
              <div id="profile-preferences" className={styles.form}>
                {(
                  [
                    ["research_areas", "research-areas", labels.researchAreas],
                    [
                      "favourite_funder",
                      "favourite-funders",
                      labels.favouriteFunders,
                    ],
                    [
                      "research_keywords",
                      "research-keywords",
                      labels.researchKeywords,
                    ],
                  ] as const
                ).map(([key, id, name]) => (
                  <ResearchSelection
                    key={key}
                    id={`profile-${id}`}
                    label={name}
                    options={initial.options[key] || []}
                    values={research[key]}
                    onChange={(next) =>
                      setResearch((r) => ({ ...r, [key]: next }))
                    }
                  />
                ))}
              </div>
              {footer(
                "preferences",
                () => void save("research", research, labels.profileSaved),
              )}
            </>
          )}
          {tab === "digital-presence" &&
            (presenceValue ? (
              <>
                <div id="profile-presence" className={styles.form}>
                  {presenceKeys.map((key) => (
                    <label className={styles.linkField} key={key}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={links[key][1]} alt="" />
                      <span>{links[key][0]}</span>
                      <input
                        id={`profile-presence-${key.replaceAll("_", "-")}`}
                        type="url"
                        value={presenceValue[key]}
                        onChange={(e) =>
                          setPresence({
                            ...presenceValue,
                            [key]: e.target.value,
                          })
                        }
                      />
                    </label>
                  ))}
                </div>
                {footer(
                  "presence",
                  () => void save("presence", presenceValue, "Success"),
                )}
              </>
            ) : presenceRemote.error ? (
              <div id="profile-presence-error" role="alert">
                <p>{presenceRemote.error.message}</p>
                <button
                  id="profile-presence-retry"
                  type="button"
                  onClick={presenceRemote.retry}
                >
                  Retry
                </button>
              </div>
            ) : (
              <Skeleton kind="lines" count={4} label="Loading links" />
            ))}
          {tab === "manage" && (
            <>
              <StatusEditor
                value={status}
                onChange={setStatus}
                organizations={initial.organizations}
              />
              {footer("status", saveStatus)}
            </>
          )}
        </div>
      </div>
    </>
  );
}
function ResearchSelection({
  id,
  label,
  options,
  values,
  onChange,
}: {
  id: string;
  label: string;
  options: string[];
  values: string[];
  onChange: (v: string[]) => void;
}) {
  const [draft, setDraft] = useState("");
  const list = `${id}-options`;
  // Custom values are allowed, as the original's allowCustom multi-select; commas would split the stored list.
  const add = () => {
    const value = draft.trim();
    if (value !== "" && !value.includes(","))
      onChange([...new Set([...values, value])]);
    setDraft("");
  };
  return (
    <div id={id} className={styles.research}>
      <label>
        <span>{label}</span>
        <input
          id={`${id}-input`}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          list={list}
          onKeyDown={(e) => {
            if (e.key !== "Enter") return;
            e.preventDefault();
            add();
          }}
        />
      </label>
      <datalist id={list}>
        {options.map((value) => (
          <option key={value} value={value} />
        ))}
      </datalist>
      <button id={`${id}-add`} type="button" onClick={add}>
        Add
      </button>
      <div id={`${id}-chips`} className={styles.chips}>
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
  const { labels } = useShell();
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
  const instant = (v: string) => (v ? new Date(v).toISOString() : "");
  return (
    <div id="profile-status" className={`${styles.form} ${styles.grid}`}>
      <label>
        <span>{labels.selectStatus}</span>
        <select
          id="profile-status-select"
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
            <span>{labels.startDatetime} *</span>
            <input
              id="profile-status-start"
              type="datetime-local"
              required
              value={local(value.effective_start_date)}
              onChange={(e) =>
                onChange({
                  ...value,
                  effective_start_date: instant(e.target.value),
                })
              }
            />
          </label>
          <label>
            <span>{labels.endDatetime} *</span>
            <input
              id="profile-status-end"
              type="datetime-local"
              required
              value={local(value.effective_end_date)}
              onChange={(e) =>
                onChange({
                  ...value,
                  effective_end_date: instant(e.target.value),
                })
              }
            />
          </label>
          <label className={styles.wide}>
            <span>{labels.statusMessage} *</span>
            <textarea
              id="profile-status-message"
              rows={5}
              required
              value={value.status_msg}
              onChange={(e) =>
                onChange({ ...value, status_msg: e.target.value })
              }
            />
          </label>
          <label>
            <span>{labels.selectOrg}</span>
            <select
              id="profile-proxy-organization"
              value={org}
              onChange={(e) => setOrg(e.target.value)}
            >
              <option value="" />
              {organizations.map((o) => (
                <option value={o.id} key={o.id}>
                  {o.name}
                </option>
              ))}
            </select>
          </label>
          {people.error ? (
            <div id="profile-proxy-error" role="alert">
              {people.error.message}
              <button
                id="profile-proxy-retry"
                type="button"
                onClick={people.retry}
              >
                Retry
              </button>
            </div>
          ) : org && !people.data ? (
            <RecordSkeleton label="Loading proxy directory" rows={1} />
          ) : (
            <label>
              <span>{labels.selectProxy}</span>
              <select
                id="profile-proxy-person"
                value=""
                disabled={!people.data}
                onChange={(e) => {
                  // Picking an org and a person adds the proxy at once, as the original (no Add button).
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
                <option value="" />
                {people.data?.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </label>
          )}
          <table id="profile-proxies" className={styles.wide}>
            <thead>
              <tr>
                <th>{labels.orgName}</th>
                <th>{labels.proxyName}</th>
                <th>
                  <span className="sr-only">Remove</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {value.proxy_users.length === 0 ? (
                <tr>
                  <td colSpan={3} className="muted">
                    {labels.noData}
                  </td>
                </tr>
              ) : (
                value.proxy_users.map((p, i) => (
                  <tr
                    key={`${p.org_id}:${p.proxy_pid}`}
                    id={`profile-proxy-${p.org_id}-${p.proxy_pid}`}
                  >
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
                        id={`profile-proxy-${p.org_id}-${p.proxy_pid}-remove`}
                        type="button"
                        className={styles.danger}
                        aria-label="Remove proxy"
                        onClick={() =>
                          onChange({
                            ...value,
                            proxy_users: value.proxy_users.filter(
                              (_, index) => index !== i,
                            ),
                          })
                        }
                      >
                        <Icon name="trash" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </>
      )}
    </div>
  );
}
