"use client";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react";
import { useRouter, useSelectedLayoutSegment } from "next/navigation";
import { Icon } from "@/components/ui/icon";
import { useInFlight } from "@/lib/hooks/use-in-flight";
import { useToast } from "@/components/feedback/toast";
import { useConfirm } from "@/components/dialog/action-dialog";
import { useActionFailure } from "@/components/dialog/action-failure";
import { RecordFrame } from "@/features/record/shell/record-frame";
import { useLeaveGuard } from "@/features/record/shell/leave-guard";
import {
  mustAsk,
  type LeaveGuard,
} from "@/features/modules/opportunities/eoi/unsaved";
import { awards } from "@/lib/api";
import type { PageLock } from "@/shared/opportunities/eoi-record";
import {
  AWARD_MODULE,
  awardTabs,
  finalizeSwitch,
  pageOf,
  type AwardTab,
} from "@/shared/awards/award-record";
import type { AwardShellModel } from "./types";

/** The Header tab's save and cancel, run by the shell's Save and Cancel (legacy saveApplication / cancelProposalEdit). */
export interface HeaderCommands {
  save: () => void;
  cancel: () => void;
}
/** Per-record state the shell shares with its tabs: header edit mode, the record save, the tab's lock, the leave guard. */
export interface AwardRecordState {
  editing: boolean;
  setEditing: (on: boolean) => void;
  run: ReturnType<typeof useInFlight>["run"];
  isActive: ReturnType<typeof useInFlight>["isActive"];
  setLock: (tab: AwardTab, lock: PageLock) => void;
  setGuard: (guard: LeaveGuard | null) => void;
  setHeader: (commands: HeaderCommands | null) => void;
}
/** The record-level save: the Header's Save and Cancel and a form tab's Submit wait for each other. */
export const RECORD_SAVE = "record";
const AwardRecordContext = createContext<AwardRecordState | null>(null);
export function useAwardRecord() {
  const state = useContext(AwardRecordContext);
  if (!state) throw new Error("useAwardRecord needs the award record shell.");
  return state;
}
/** Tells the shell the current tab's lock (read on the server with the tab). */
export function AwardTabLock({ tab, lock }: { tab: AwardTab; lock: PageLock }) {
  const { setLock } = useAwardRecord();
  useEffect(() => setLock(tab, lock), [setLock, tab, lock]);
  return null;
}

const ERP = "erp";
const FINALIZE = "finalize";
const asTab = (segment: string | null): AwardTab =>
  (awardTabs as readonly string[]).includes(segment ?? "")
    ? (segment as AwardTab)
    : "header";

/** The award record (legacy awards-detail-page): List, Edit Award Header / Save / Cancel, tabs, panel and drawers. */
export function AwardRecordShell({
  model,
  children,
}: {
  model: AwardShellModel;
  children: React.ReactNode;
}) {
  const router = useRouter(),
    tab = asTab(useSelectedLayoutSegment()),
    { run, isActive } = useInFlight(),
    { ask, element: confirmation } = useConfirm("award-record-discard"),
    fail = useActionFailure(),
    toast = useToast(),
    [, startTransition] = useTransition(),
    [editing, setEditing] = useState(false),
    [lockState, setLockState] = useState<{ tab: AwardTab; lock: PageLock }>(),
    [pendingFinalize, setPendingFinalize] = useState<boolean | null>(null),
    guard = useRef<LeaveGuard | null>(null),
    header = useRef<HeaderCommands | null>(null);
  const lock = lockState?.tab === tab ? lockState.lock : undefined;
  const setLock = useCallback(
    (t: AwardTab, l: PageLock) => setLockState({ tab: t, lock: l }),
    [],
  );
  const setGuard = useCallback((g: LeaveGuard | null) => {
    guard.current = g;
  }, []);
  const setHeader = useCallback((c: HeaderCommands | null) => {
    header.current = c;
  }, []);
  const navigate = useCallback((href: string) => router.push(href), [router]);
  const state = useMemo<AwardRecordState>(
    () => ({
      editing,
      setEditing,
      run,
      isActive,
      setLock,
      setGuard,
      setHeader,
    }),
    [editing, setEditing, run, isActive, setLock, setGuard, setHeader],
  );
  useLeaveGuard(guard, ask, navigate, () => setEditing(false));
  const finalized = new Set(
    model.tabs.filter((t) => t.finalized).map((t) => pageOf(t.tab)),
  );
  const finalize = finalizeSwitch(
    model.statusCode,
    model.finalizable?.map(pageOf) ?? null,
    finalized,
    tab,
    lock,
  );
  const sendToErp = () =>
    void run(async () => {
      const result = await awards.sendToErp(model.awardId);
      if (!result.ok) return fail(result.error);
      // Legacy: the flow's Status as a confirmation, then the award re-read.
      toast.show("success", result.data.status);
      startTransition(() => router.refresh());
    }, ERP);
  const setFinalized = (on: boolean) => {
    if (on && mustAsk(guard.current))
      return toast.show(
        "error",
        "Can't Finalize",
        "Save your changes before Finalizing",
      );
    setPendingFinalize(on);
    void run(async () => {
      const result = await awards.setFinalized(model.awardId, tab, on);
      if (!result.ok) {
        setPendingFinalize(null);
        return fail(result.error);
      }
      startTransition(() => {
        setPendingFinalize(null);
        router.refresh();
      });
    }, FINALIZE);
  };
  const saving = isActive(RECORD_SAVE);
  const locked = lock?.locked ?? true;
  return (
    <AwardRecordContext.Provider value={state}>
      <RecordFrame
        prefix="award-record"
        back={{ href: "/awards", label: model.labels.list }}
        record
        panelColumns={3}
        tabs={model.tabs.map((t) => ({
          key: t.tab,
          href: `/awards/${model.awardId}/${t.tab}`,
          name: t.name,
          icon: t.icon,
          finalized: t.finalized,
        }))}
        current={tab}
        panel={model.panel}
        creator={{
          endpoint: awards.creator,
          params: { awardId: model.awardId },
        }}
        finalize={
          // Legacy: read-only outside view mode.
          finalize && {
            on: pendingFinalize ?? finalize.on,
            busy: isActive(FINALIZE) || editing,
            onChange: setFinalized,
          }
        }
        objectType={AWARD_MODULE}
        objectId={model.awardId}
        page={pageOf(tab)}
        labels={model.labels}
        toolbarStart={
          <>
            {model.canSendToErp && (
              // Legacy btnSendToERP: on every tab of an internally approved award.
              <button
                type="button"
                id="award-record-send-to-erp"
                className="gn-btn gn-btn--danger"
                disabled={isActive(ERP)}
                onClick={sendToErp}
              >
                <Icon name="adapter" size={14} />
                {model.labels.sendToErp}
              </button>
            )}
            {tab === "header" &&
              model.canEditHeader &&
              (editing ? (
                <>
                  <button
                    type="button"
                    id="award-record-save"
                    className="gn-btn gn-btn--primary"
                    disabled={locked || saving}
                    onClick={() => header.current?.save()}
                  >
                    <Icon name="save" size={14} />
                    {model.labels.save}
                  </button>
                  <button
                    type="button"
                    id="award-record-cancel"
                    className="gn-btn gn-btn--outlined"
                    disabled={saving}
                    onClick={() => header.current?.cancel()}
                  >
                    <Icon name="close" size={14} />
                    {model.labels.cancel}
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  id="award-record-edit"
                  className="gn-btn gn-btn--outlined"
                  disabled={locked}
                  onClick={() => setEditing(true)}
                >
                  <Icon name="edit" size={14} />
                  {model.labels.editHeader}
                </button>
              ))}
          </>
        }
      >
        {children}
      </RecordFrame>
      {confirmation}
    </AwardRecordContext.Provider>
  );
}
