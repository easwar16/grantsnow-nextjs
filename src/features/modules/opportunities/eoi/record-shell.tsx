"use client";
import { useCallback, useMemo, useRef, useState, useTransition } from "react";
import { useRouter, useSelectedLayoutSegment } from "next/navigation";
import { Icon } from "@/components/ui/icon";
import { RecordFrame } from "@/features/record/shell/record-frame";
import { useInFlight } from "@/lib/hooks/use-in-flight";
import { useToast } from "@/components/feedback/toast";
import { useConfirm } from "../../../../components/dialog/action-dialog";
import {
  ConvertDialog,
  warmConvert,
} from "../components/actions/convert-dialog";
import { useActionFailure } from "../../../../components/dialog/action-failure";
import {
  EOI_MODULE,
  eoiTabs,
  finalizeSwitch,
  pageOf,
} from "@/shared/opportunities/eoi-record";
import {
  RECORD_SAVE,
  RecordContext,
  type ApplicationCommands,
  type RecordState,
} from "./record-context";
import { eoi } from "@/lib/api";
import type { EoiTab, PageLock, RecordShellModel } from "./types";
import { mustAsk, type LeaveGuard } from "./unsaved";
import { useLeaveGuard } from "@/features/record/shell/leave-guard";
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
  useLeaveGuard(guard, ask, navigate, () => setEditing(false));
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
      const result = await eoi.setFinalized(model.requestId!, tab, on);
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
  const saving = isActive(RECORD_SAVE);
  const record = model.mode === "record" && model.requestId !== undefined;
  return (
    <RecordContext.Provider value={state}>
      <RecordFrame
        prefix="eoi-record"
        back={{ href: model.listHref, label: model.labels.list }}
        record={record}
        tabs={
          model.mode === "detail"
            ? []
            : model.tabs.map((t) => ({
                key: t.tab,
                href: `${model.base}/${t.tab}`,
                name: t.name,
                icon: t.icon,
                finalized: t.finalized,
              }))
        }
        current={tab}
        panel={model.panel}
        creator={
          model.requestId === undefined
            ? undefined
            : { endpoint: eoi.creator, params: { id: model.requestId } }
        }
        finalize={
          finalize && {
            on: pendingFinalize ?? finalize.on,
            busy: isActive(FINALIZE),
            onChange: setFinalized,
          }
        }
        objectType={EOI_MODULE}
        objectId={model.requestId}
        page={pageOf(tab)}
        labels={model.labels}
        toolbarStart={
          record &&
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
          ))
        }
        toolbarEnd={
          record && (
            <>
              {model.opportunityId && model.converts.outline && (
                <button
                  type="button"
                  id="eoi-record-convert"
                  className="gn-btn gn-btn--primary"
                  disabled={converting !== null}
                  onPointerEnter={() => warmRecordConvert("OUTLINE_PROPOSAL")}
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
          )
        }
      >
        {children}
      </RecordFrame>
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
