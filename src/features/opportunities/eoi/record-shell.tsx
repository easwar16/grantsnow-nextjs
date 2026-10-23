"use client";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react";
import Link from "next/link";
import {
  useRouter,
  useSearchParams,
  useSelectedLayoutSegment,
} from "next/navigation";
import { Icon } from "@/components/ui/icon";
import { useInFlight } from "@/lib/use-in-flight";
import { useToast } from "@/components/feedback/toast";
import { useConfirm } from "../components/actions/action-dialog";
import {
  ConvertDialog,
  warmConvert,
} from "../components/actions/convert-dialog";
import { useActionFailure } from "../components/actions/request";
import {
  EOI_MODULE,
  eoiTabs,
  finalizeSwitch,
  pageOf,
} from "@/server/opportunities/eoi-record/model";
import { ObjectAudit, ObjectComments } from "./object-panels";
import {
  RECORD_SAVE,
  RecordContext,
  type ApplicationCommands,
  type RecordState,
} from "./record-context";
import { postRecord } from "./request";
import type { EoiTab, PageLock, RecordShellModel } from "./types";
import {
  DISCARD_DIALOG,
  inAppDestination,
  mustAsk,
  type LeaveGuard,
} from "./unsaved";
import styles from "./record.module.css";
const FINALIZE = "finalize";
const asTab = (segment: string | null): EoiTab =>
  (eoiTabs as readonly string[]).includes(segment ?? "")
    ? (segment as EoiTab)
    : "summary";
/**
 * The AOI / EOI record container (GN-Angular eoi-record): header actions, tab bar, record panel, the routed tab and
 * the comments / audit end drawer. More Info (`detail`) shows the summary alone, without tabs or panel.
 */
export function RecordShell({
  model,
  children,
}: {
  model: RecordShellModel;
  children: React.ReactNode;
}) {
  const router = useRouter(),
    tab = asTab(useSelectedLayoutSegment()),
    { run, isActive } = useInFlight(),
    { ask, element: confirmation } = useConfirm("eoi-record-discard"),
    fail = useActionFailure(),
    toast = useToast(),
    [, startTransition] = useTransition(),
    [editing, setEditing] = useState(model.mode === "new"),
    [lockState, setLockState] = useState<{ tab: EoiTab; lock: PageLock }>(),
    // A mention notification links with `comment-id`: the comments drawer opens on it (legacy HandleMentionDeepLinkChain).
    commentLink = useSearchParams().has("comment-id"),
    [drawer, setDrawer] = useState<"comments" | "audit" | null>(
      commentLink ? "comments" : null,
    ),
    [converting, setConverting] = useState<
      "OUTLINE_PROPOSAL" | "PROPOSAL" | null
    >(null),
    [pendingFinalize, setPendingFinalize] = useState<boolean | null>(null),
    guard = useRef<LeaveGuard | null>(null),
    application = useRef<ApplicationCommands | null>(null);
  const lock = lockState?.tab === tab ? lockState.lock : undefined;
  const locked = lock?.locked ?? false;
  const setLock = useCallback(
    (t: EoiTab, l: PageLock) => setLockState({ tab: t, lock: l }),
    [],
  );
  // Stable, so a tab's registration effects run once per mount.
  const setGuard = useCallback((g: LeaveGuard | null) => {
    guard.current = g;
  }, []);
  const setApplication = useCallback((c: ApplicationCommands | null) => {
    application.current = c;
  }, []);
  const navigate = useCallback(
    (href: string, replace = false) =>
      replace ? router.replace(href) : router.push(href),
    [router],
  );
  const state = useMemo<RecordState>(
    () => ({
      editing,
      setEditing,
      run,
      isActive,
      setLock,
      setGuard,
      setApplication,
      navigate,
    }),
    [
      editing,
      setEditing,
      run,
      isActive,
      setLock,
      setGuard,
      setApplication,
      navigate,
    ],
  );
  // Unsaved changes (the original's exit gate): every in-app link asks first, and the browser asks on unload.
  // ponytail: browser Back / Forward is not intercepted (App Router has no blocking API); add one when Next ships it.
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (!mustAsk(guard.current)) return;
      const link = (e.target as Element | null)?.closest?.("a[href]");
      if (!(link instanceof HTMLAnchorElement)) return;
      const href = inAppDestination(
        e,
        {
          href: link.href,
          target: link.target,
          download: link.hasAttribute("download"),
        },
        window.location,
      );
      if (href === null) return;
      // Window capture runs before React's document listeners, so the Link never sees the click.
      e.preventDefault();
      e.stopPropagation();
      void ask(DISCARD_DIALOG).then((discard) => {
        if (!discard) return;
        guard.current = null;
        setEditing(false);
        router.push(href);
      });
    };
    const onUnload = (e: BeforeUnloadEvent) => {
      if (mustAsk(guard.current)) e.preventDefault();
    };
    window.addEventListener("click", onClick, true);
    window.addEventListener("beforeunload", onUnload);
    return () => {
      window.removeEventListener("click", onClick, true);
      window.removeEventListener("beforeunload", onUnload);
    };
  }, [ask, router]);
  const finalized = new Set(
    model.tabs.filter((t) => t.finalized).map((t) => pageOf(t.tab)),
  );
  const finalize =
    model.mode === "record"
      ? finalizeSwitch(
          model.statusCode,
          model.finalizable?.map(pageOf) ?? null,
          finalized,
          tab,
          lock,
        )
      : null;
  const setFinalized = (on: boolean) => {
    // Legacy FinalizeValueChangeChain: unsaved answers must be saved first; the switch stays as it was.
    if (on && mustAsk(guard.current))
      return toast.show(
        "error",
        "Can't Finalize",
        "Save your changes before Finalizing",
      );
    setPendingFinalize(on);
    void run(async () => {
      const result = await postRecord(`${model.base}/lock`, {
        tab,
        finalize: on,
      });
      if (!result.ok) {
        // A refused change puts the switch back.
        setPendingFinalize(null);
        return fail(result.error);
      }
      // Re-read the locks, ticks and the Workflow gate with the tab.
      startTransition(() => {
        setPendingFinalize(null);
        router.refresh();
      });
    }, FINALIZE);
  };
  const warmRecordConvert = (kind: "OUTLINE_PROPOSAL" | "PROPOSAL") => {
    if (model.opportunityId)
      warmConvert("finder", kind, model.opportunityId, model.requestId);
  };
  const tabName = model.tabs.find((t) => t.tab === tab)?.name ?? "";
  const saving = isActive(RECORD_SAVE);
  const record = model.mode === "record" && model.requestId !== undefined;
  return (
    <RecordContext.Provider value={state}>
      <div id="eoi-record" className={`page-fill ${styles.record}`}>
        <div id="eoi-record-page" className={styles.page}>
          <div id="eoi-record-actions" className={styles.actionBar}>
            <Link
              id="eoi-record-back"
              className="gn-btn gn-btn--outlined"
              href={model.listHref}
              prefetch={false}
            >
              <Icon name="arrow-left" size={14} />
              {model.labels.list}
            </Link>
            <div id="eoi-record-toolbar" className={styles.toolbar}>
              {record &&
                tab === "application" &&
                (editing ? (
                  <>
                    <button
                      type="button"
                      id="eoi-record-save-draft"
                      className="gn-btn gn-btn--outlined"
                      disabled={locked || saving}
                      onClick={() => application.current?.save()}
                    >
                      <Icon name="draft" size={14} />
                      {model.labels.saveDraft}
                    </button>
                    <button
                      type="button"
                      id="eoi-record-cancel"
                      className="gn-btn gn-btn--outlined"
                      disabled={locked || saving}
                      onClick={() => application.current?.cancel()}
                    >
                      <Icon name="close" size={14} />
                      {model.labels.cancelEdit}
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    id="eoi-record-edit"
                    className="gn-btn gn-btn--outlined"
                    disabled={locked}
                    onClick={() => setEditing(true)}
                  >
                    <Icon name="pen" size={14} />
                    {model.labels.edit}
                  </button>
                ))}
              {record && (
                <>
                  <button
                    type="button"
                    id="eoi-record-comments"
                    className={`gn-btn gn-btn--outlined${drawer === "comments" ? ` ${styles.active}` : ""}`}
                    aria-expanded={drawer === "comments"}
                    onClick={() =>
                      setDrawer((d) => (d === "comments" ? null : "comments"))
                    }
                  >
                    <Icon name="chat" size={14} />
                    {model.labels.comments}
                  </button>
                  {model.labels.audit && (
                    <button
                      type="button"
                      id="eoi-record-audit"
                      className={`gn-btn gn-btn--outlined${drawer === "audit" ? ` ${styles.active}` : ""}`}
                      aria-expanded={drawer === "audit"}
                      onClick={() =>
                        setDrawer((d) => (d === "audit" ? null : "audit"))
                      }
                    >
                      <Icon name="audits" size={14} />
                      {model.labels.audit}
                    </button>
                  )}
                  {model.opportunityId && model.converts.outline && (
                    <button
                      type="button"
                      id="eoi-record-convert"
                      className="gn-btn gn-btn--primary"
                      disabled={converting !== null}
                      onPointerEnter={() =>
                        warmRecordConvert("OUTLINE_PROPOSAL")
                      }
                      onFocus={() => warmRecordConvert("OUTLINE_PROPOSAL")}
                      onClick={() => setConverting("OUTLINE_PROPOSAL")}
                    >
                      <Icon name="arrow-right" size={14} />
                      {model.converts.outline}
                    </button>
                  )}
                  {model.opportunityId && model.converts.full && (
                    <button
                      type="button"
                      id="eoi-record-convert-to-proposal"
                      className="gn-btn gn-btn--primary"
                      disabled={converting !== null}
                      onPointerEnter={() => warmRecordConvert("PROPOSAL")}
                      onFocus={() => warmRecordConvert("PROPOSAL")}
                      onClick={() => setConverting("PROPOSAL")}
                    >
                      <Icon name="arrow-right" size={14} />
                      {model.converts.full}
                    </button>
                  )}
                </>
              )}
            </div>
          </div>
          {model.mode !== "detail" && model.tabs.length > 0 && (
            <nav
              id="eoi-record-tabs"
              className={styles.tabs}
              aria-label={model.labels.tabs}
            >
              {model.tabs.map((t) => (
                <Link
                  key={t.tab}
                  id={`eoi-record-tab-${t.tab}`}
                  href={`${model.base}/${t.tab}`}
                  prefetch={false}
                  className={t.tab === tab ? styles.selected : undefined}
                  aria-current={t.tab === tab ? "page" : undefined}
                  title={t.name}
                >
                  <Icon name={t.icon} size={16} />
                  <span className={styles.tabName}>{t.name}</span>
                  {t.finalized && (
                    <Icon
                      className={styles.finalized}
                      name="success"
                      size={14}
                      label={model.labels.finalized}
                    />
                  )}
                </Link>
              ))}
            </nav>
          )}
          {record && (
            <dl id="eoi-record-panel" className={styles.panel}>
              {model.panel.map((cell) => (
                <div key={cell.key} id={`eoi-record-panel-${cell.key}`}>
                  <dt>{cell.label}</dt>
                  <dd>
                    {cell.tone ? (
                      <span className="gn-status" data-tone={cell.tone}>
                        {cell.value}
                      </span>
                    ) : (
                      cell.value
                    )}
                  </dd>
                </div>
              ))}
              {finalize && (
                <div>
                  <dt id="eoi-finalize">{model.labels.finalize}</dt>
                  <dd>
                    <label className={styles.switch}>
                      <input
                        id="eoi-record-finalize"
                        type="checkbox"
                        role="switch"
                        aria-labelledby="eoi-finalize"
                        checked={pendingFinalize ?? finalize.on}
                        disabled={isActive(FINALIZE)}
                        onChange={(e) => setFinalized(e.currentTarget.checked)}
                      />
                      <span className={styles.track} />
                    </label>
                  </dd>
                </div>
              )}
            </dl>
          )}
          <div id="eoi-record-content" className={styles.content}>
            {children}
          </div>
        </div>
        {drawer && record && (
          <aside
            id="eoi-record-drawer"
            className={`${styles.drawer} enter-fade`}
            aria-label={drawer === "audit" ? model.labels.auditTitle : tabName}
          >
            <div id="eoi-record-drawer-head" className={styles.drawerHead}>
              <h2>{drawer === "audit" ? model.labels.auditTitle : tabName}</h2>
              <button
                type="button"
                id="eoi-record-drawer-close"
                className="gn-btn gn-btn--borderless gn-btn--icon"
                aria-label={model.labels.close}
                onClick={() => setDrawer(null)}
              >
                <Icon name="close" size={14} />
              </button>
            </div>
            {drawer === "comments" ? (
              <ObjectComments
                id="eoi-record-comments-panel"
                objectType={EOI_MODULE}
                objectId={model.requestId!}
                page={pageOf(tab)}
              />
            ) : (
              <ObjectAudit
                id="eoi-record-audit-panel"
                objectType={EOI_MODULE}
                objectId={model.requestId!}
                page={pageOf(tab)}
              />
            )}
          </aside>
        )}
      </div>
      {confirmation}
      {converting && model.opportunityId && (
        <ConvertDialog
          id="eoi-record-convert-dialog"
          opener="finder"
          kind={converting}
          opportunityId={model.opportunityId}
          requestId={model.requestId}
          onClose={() => setConverting(null)}
        />
      )}
    </RecordContext.Provider>
  );
}
