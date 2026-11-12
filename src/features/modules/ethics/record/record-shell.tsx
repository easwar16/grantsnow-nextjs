"use client";
import { useCallback, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { ethics } from "@/lib/api";
import { useActionFailure } from "@/components/dialog/action-failure";
import { useFormat } from "@/components/layout/shell-context";
import { Select } from "@/components/ui/select";
import {
  RecordFrame,
  type FrameCell,
} from "@/features/record/shell/record-frame";
import { functions } from "@/lib/functions";
import type { EthicsShellModel } from "@/server/modules/ethics/record/shell";
import { RecordPrint } from "@/features/record/shell/record-print";
import { ReferenceLink } from "@/features/record/linked/reference-link";
import type { StatusTone } from "@/components/ui/status-badge";
import { Icon } from "@/components/ui/icon";
import { ResponseEditContext } from "./response-edit-context";

/** Legacy ethics-detail-page on the shared record frame, with tab and participant deep links. */
export function EthicsRecordShell({
  model,
  current,
  children,
  finalizeState,
  printOptions,
  canLink,
  autoSubmit,
  versions = [],
  selectedVersion,
  canEditSetup = false,
  canEditResponses = false,
}: {
  model: EthicsShellModel;
  current: string;
  children: React.ReactNode;
  finalizeState?: {
    visible: boolean;
    finalized: boolean;
    finalizedPages: string[];
  };
  printOptions?: { code: string; label: string; enabled: boolean }[];
  canLink?: boolean;
  autoSubmit?: { label: string };
  versions?: { value: number; label: string }[];
  selectedVersion?: number;
  canEditSetup?: boolean;
  canEditResponses?: boolean;
}) {
  const format = useFormat();
  const router = useRouter();
  const search = useSearchParams();
  const [pending, setPending] = useState(false);
  const [saved, setSaved] = useState<boolean | null>(null);
  const fail = useActionFailure();
  const [responseEditing, setResponseEditing] = useState(false);
  const [responseSaving, setResponseSaving] = useState(false);
  const responseHandlers = useRef<{
    save: () => void;
    cancel: () => void;
  } | null>(null);
  const registerResponseHandlers = useCallback(
    (handlers: { save: () => void; cancel: () => void } | null) => {
      responseHandlers.current = handlers;
    },
    [],
  );
  const query = model.access
    ? `?access=${encodeURIComponent(model.access)}`
    : "";
  const participant = model.selectedParticipant;
  const badgeTone = (key: string): StatusTone | undefined => {
    if (key === "status") {
      if (["REJ"].includes(model.statusCode)) return "danger";
      if (model.statusCode === "REWORK") return "warning";
      if (["WIP", "AIA", "DRFT"].includes(model.statusCode)) return "info";
      return "success";
    }
    if (key === "risk") {
      if (["HIGH", "CRITICAL"].includes(model.riskCode)) return "danger";
      if (model.riskCode === "MEDIUM") return "warning";
      if (model.riskCode === "LOW") return "success";
      return "info";
    }
  };
  const panel: FrameCell[] = model.panel
    .filter((cell) => current !== "ethics-responses" || cell.key !== "spacer")
    .map((cell) => ({
      key: cell.key,
      label: cell.label,
      value: cell.date
        ? functions.format.dateDisplay(cell.value, format)
        : cell.value,
      tone: badgeTone(cell.key),
    }));
  if (current === "ethics-responses" && versions.length > 0)
    panel.push({
      key: "version",
      label: model.labels.version,
      value: (
        <Select
          id="ethics-response-version"
          label={model.labels.version}
          clearable={false}
          options={versions.map((row) => ({
            value: String(row.value),
            label: row.label,
          }))}
          value={String(selectedVersion ?? versions[0].value)}
          onChange={(value) => {
            const next = new URLSearchParams(search.toString());
            next.set("version", value);
            router.replace(`?${next.toString()}`, { scroll: false });
          }}
        />
      ),
    });
  return (
    <ResponseEditContext.Provider
      value={{
        editing: responseEditing,
        saving: responseSaving,
        setEditing: setResponseEditing,
        setSaving: setResponseSaving,
        register: registerResponseHandlers,
      }}
    >
      <RecordFrame
        prefix="ethics-record"
        back={{ href: "/ethics", label: model.labels.list }}
        toolbarStart={
          <>
            {canEditSetup && !responseEditing && (
              <Link
                id="ethics-edit-setup"
                className="gn-btn gn-btn--primary"
                href={`/ethics/${model.id}/edit?access=${encodeURIComponent(model.access)}`}
              >
                <Icon name="edit" size={14} /> {model.labels.editSetup}
              </Link>
            )}
            {current === "ethics-responses" &&
              canEditResponses &&
              (responseEditing ? (
                <>
                  <button
                    id="ethics-response-save"
                    type="button"
                    className="gn-btn gn-btn--primary"
                    disabled={responseSaving}
                    onClick={() => responseHandlers.current?.save()}
                  >
                    <Icon name="save" size={14} /> {model.labels.responseSave}
                  </button>
                  <button
                    id="ethics-response-cancel"
                    type="button"
                    className="gn-btn gn-btn--outlined"
                    disabled={responseSaving}
                    onClick={() => responseHandlers.current?.cancel()}
                  >
                    {model.labels.cancel}
                  </button>
                </>
              ) : (
                <button
                  id="ethics-response-edit"
                  type="button"
                  className="gn-btn gn-btn--outlined"
                  disabled={
                    selectedVersion !== undefined &&
                    selectedVersion !== versions[0]?.value
                  }
                  onClick={() => setResponseEditing(true)}
                >
                  <Icon name="edit" size={14} /> {model.labels.edit}
                </button>
              ))}
            {canLink &&
              ["ethics-general-overview", "ethics-responses"].includes(
                current,
              ) && (
                <ReferenceLink
                  id="ethics"
                  record={model.id}
                  access={model.access}
                  texts={model.referenceLink}
                  api={{
                    types: ethics.referenceTypes,
                    items: ethics.referenceItems,
                    link: ethics.linkReferences,
                  }}
                />
              )}
          </>
        }
        toolbarEnd={
          <>
            {autoSubmit && participant && (
              <button
                id="ethics-auto-submit"
                type="button"
                className="gn-btn gn-btn--primary"
                disabled={pending}
                onClick={() => {
                  setPending(true);
                  void ethics
                    .autoSubmit(model.id, { access: model.access, participant })
                    .then((result) => {
                      if (result.ok) router.refresh();
                      else fail(result.error);
                      setPending(false);
                    });
                }}
              >
                {autoSubmit.label}
              </button>
            )}
            {printOptions?.length && participant ? (
              <RecordPrint
                id="ethics-print"
                label={model.labels.print}
                options={printOptions}
                generate={(code) =>
                  ethics.print(model.id, {
                    access: model.access,
                    participant,
                    code,
                  })
                }
              />
            ) : null}
          </>
        }
        record
        editing={responseEditing}
        panelColumns={3}
        tabs={model.tabs.map((tab) => ({
          key: tab.key,
          href: `/ethics/${model.id}${query}${query ? "&" : "?"}tab=${tab.key}${participant ? `&participant=${encodeURIComponent(participant)}` : ""}`,
          name: tab.name,
          icon:
            tab.key === "ethics-history"
              ? ("clock-history" as const)
              : tab.key === "ethics-attachments"
                ? ("attachment" as const)
                : ("settings" as const),
          finalized: finalizeState?.finalizedPages.includes(tab.key) ?? false,
        }))}
        current={current}
        panel={panel}
        finalize={
          finalizeState?.visible && participant
            ? {
                on: saved ?? finalizeState.finalized,
                busy: pending,
                onChange: (finalize) => {
                  setPending(true);
                  void ethics
                    .finalize(model.id, {
                      access: model.access,
                      participant,
                      page: current,
                      finalize,
                    })
                    .then((result) => {
                      if (result.ok) {
                        setSaved(result.data.finalized);
                        router.refresh();
                      } else fail(result.error);
                      setPending(false);
                    });
                },
              }
            : null
        }
        objectType="ETHICS"
        objectId={
          model.statusCode !== "DRFT"
            ? current === "ethics-general-overview"
              ? model.id
              : (model.selectedParticipant ?? undefined)
            : undefined
        }
        panelSec={model.selectedParticipant ?? undefined}
        page={current}
        labels={{
          comments: model.labels.comments,
          audit: model.labels.audit,
          auditTitle: model.labels.auditTitle,
          close: model.labels.close,
          finalize: model.labels.finalize,
          finalized: model.labels.finalized,
          tabs: model.labels.tabs,
        }}
      >
        {children}
      </RecordFrame>
    </ResponseEditContext.Provider>
  );
}
