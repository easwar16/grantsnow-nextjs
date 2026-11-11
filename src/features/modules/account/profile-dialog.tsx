"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { account, useApi } from "@/lib/api";
import { useInFlight } from "@/lib/hooks/use-in-flight";
import { Skeleton, ListSkeleton } from "@/components/feedback/skeleton";
import { useToast } from "@/components/feedback/toast";
import { HelpButton } from "@/components/ui/help-button";
import { Icon } from "@/components/ui/icon";
import { ActionDialog } from "@/components/dialog/action-dialog";
import { DataTable } from "@/components/ui/data-table";
import { Select } from "@/components/ui/select";
import { MultiSelect } from "@/components/ui/multi-select";
import { TabBar } from "@/components/ui/tab-bar";
import { InsideField } from "@/components/ui/inside-field";
import { useShell } from "@/components/layout/shell-context";
import { saveFailure, saveSettings } from "./apply";
import {
  presenceKeys,
  type AccountData,
  type DigitalPresence,
} from "./contracts";
import styles from "./profile-dialog.module.css";
type Tab = "profile" | "pref" | "digital-presence" | "manage";
// GN-Angular LINKS: one field per network with its logo.
const STATUSES = [
  { value: "ACTIVE", label: "Active" },
  { value: "OOO", label: "Out of Office" },
];
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
  const remote = useApi(account.settings, "profile");
  return (
    <ActionDialog
      id="profile-dialog"
      title={labels.manageProfileTitle}
      width="66.667vw" /* legacy #dialogManageProfile oj-md-8 */
      className={styles.dialog}
      closeLabel={labels.close}
      onClose={onClose}
    >
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
    </ActionDialog>
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
  const presenceRemote = useApi(
    account.presence,
    tab === "digital-presence" ? undefined : null,
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
      const r = await saveSettings(kind, changes);
      if (!r.ok) return saveFailure(toast, r.error);
      toast.show("success", success);
      onClose();
      router.refresh();
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
      <TabBar
        id="profile"
        label="Manage profile sections"
        align="stretch"
        tabs={tabs.map((key) => ({ key, name: tabName[key] }))}
        selected={tab}
        onSelect={setTab}
      />
      <div
        id={`profile-panel-${tab}`}
        className={styles.body}
        role="tabpanel"
        aria-labelledby={`profile-tab-${tab}`}
      >
        <div className="enter-fade" key={tab}>
          {tab === "profile" && (
            <div id="profile-details" className={styles.profile}>
              <div className={styles.avatar}>
                <Icon name="employee" size={54} />
              </div>
              {initial.fields.map((column, c) => (
                <dl
                  key={c}
                  id={`profile-details-column-${c + 1}`}
                  className={styles.facts}
                >
                  {column.map((f) => (
                    <div key={f.key} id={`profile-${f.key}`}>
                      <dt>
                        {f.label}
                        <HelpButton
                          id={`profile-${f.key}-help`}
                          html={f.help}
                        />
                      </dt>
                      {f.values.map((v, i) => (
                        <dd key={i}>{v}</dd>
                      ))}
                    </div>
                  ))}
                </dl>
              ))}
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
                  // Live's oj-combobox-many: pick from the list or type a new value.
                  <div key={key} className={styles.research}>
                    <span id={`profile-${id}-label`}>{name}</span>
                    <MultiSelect
                      id={`profile-${id}`}
                      label={name}
                      variant="chips"
                      allowCustom
                      options={(initial.options[key] || []).map((v) => ({
                        value: v,
                        label: v,
                      }))}
                      value={research[key]}
                      // A comma would split the stored list.
                      onChange={(next) =>
                        setResearch((r) => ({
                          ...r,
                          [key]: next.filter((v) => !v.includes(",")),
                        }))
                      }
                    />
                  </div>
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
  const people = useApi(account.proxyPeople, org || null);
  const local = (v: string) => {
    const d = new Date(v);
    return Number.isFinite(d.getTime())
      ? new Date(d.getTime() - d.getTimezoneOffset() * 60000)
          .toISOString()
          .slice(0, 16)
      : "";
  };
  const instant = (v: string) => (v ? new Date(v).toISOString() : "");
  // Legacy manage-tab-panel (621): inside-label fields a quarter wide, the message 52%, the proxy table 70%.
  return (
    <div id="profile-status" className={styles.status}>
      <div className={styles.quarter}>
        <InsideField
          htmlFor="profile-status-select-trigger"
          label={labels.selectStatus}
          filled
        >
          <Select
            id="profile-status-select"
            label={labels.selectStatus}
            options={STATUSES}
            value={value.status_code}
            clearable={false}
            onChange={(code) =>
              onChange({ ...value, status_code: code as "ACTIVE" | "OOO" })
            }
          />
        </InsideField>
      </div>
      {value.status_code === "OOO" && (
        <>
          <div className={styles.row}>
            <div className={styles.quarter}>
              {/* The browser always shows the date-time format, so the label stays up. */}
              <InsideField
                htmlFor="profile-status-start"
                label={labels.startDatetime}
                required
                filled
              >
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
              </InsideField>
            </div>
            <div className={styles.quarter}>
              <InsideField
                htmlFor="profile-status-end"
                label={labels.endDatetime}
                required
                filled
              >
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
              </InsideField>
            </div>
          </div>
          <div className={styles.message}>
            <InsideField
              htmlFor="profile-status-message"
              label={labels.statusMessage}
              required
              multiline
              filled
            >
              <textarea
                id="profile-status-message"
                rows={5}
                required
                value={value.status_msg}
                onChange={(e) =>
                  onChange({ ...value, status_msg: e.target.value })
                }
              />
            </InsideField>
          </div>
          <div className={styles.row}>
            <div className={styles.quarter}>
              <InsideField
                htmlFor="profile-proxy-organization-trigger"
                label={labels.selectOrg}
                filled={org !== ""}
              >
                <Select
                  id="profile-proxy-organization"
                  label={labels.selectOrg}
                  options={organizations.map((o) => ({
                    value: o.id,
                    label: o.name,
                  }))}
                  value={org}
                  onChange={setOrg}
                />
              </InsideField>
            </div>
            <div className={styles.quarter}>
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
                <ListSkeleton label="Loading proxy directory" rows={1} />
              ) : (
                <InsideField
                  htmlFor="profile-proxy-person-trigger"
                  label={labels.selectProxy}
                  filled={false}
                >
                  <Select
                    id="profile-proxy-person"
                    label={labels.selectProxy}
                    options={(people.data ?? []).map((p) => ({
                      value: p.id,
                      label: p.name,
                    }))}
                    value=""
                    disabled={!people.data}
                    onChange={(pid) => {
                      // Picking an org and a person adds the proxy at once, as the original (no Add button).
                      if (
                        pid &&
                        !value.proxy_users.some(
                          (p) => p.org_id === org && p.proxy_pid === pid,
                        )
                      )
                        onChange({
                          ...value,
                          proxy_users: [
                            ...value.proxy_users,
                            { org_id: org, proxy_pid: pid },
                          ],
                        });
                    }}
                  />
                </InsideField>
              )}
            </div>
          </div>
          <DataTable
            id="profile-proxies"
            rowIds="profile-proxy"
            className={styles.proxies}
            columns={[
              {
                id: "org",
                header: labels.orgName,
                cell: (p) =>
                  organizations.find((o) => o.id === p.org_id)?.name ||
                  p.org_id,
              },
              {
                id: "proxy",
                header: labels.proxyName,
                cell: (p) =>
                  people.data?.find((person) => person.id === p.proxy_pid)
                    ?.name || p.proxy_pid,
              },
            ]}
            rows={value.proxy_users}
            rowKey={(p) => `${p.org_id}-${p.proxy_pid}`}
            actions={[
              {
                id: "remove",
                icon: "trash",
                label: () => "Remove proxy",
                className: styles.danger,
                onClick: (p) =>
                  onChange({
                    ...value,
                    proxy_users: value.proxy_users.filter((x) => x !== p),
                  }),
              },
            ]}
            actionsLabel="Remove"
            empty={labels.noData}
          />
        </>
      )}
    </div>
  );
}
