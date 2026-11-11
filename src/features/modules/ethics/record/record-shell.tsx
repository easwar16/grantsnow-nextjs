"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { ethics } from "@/lib/api";
import { useActionFailure } from "@/components/dialog/action-failure";
import { useFormat } from "@/components/layout/shell-context";
import { RecordFrame } from "@/features/record/shell/record-frame";
import { functions } from "@/lib/functions";
import type { EthicsShellModel } from "@/server/modules/ethics/record/shell";
import { RecordPrint } from "@/features/record/shell/record-print";
import { ReferenceLink } from "@/features/record/linked/reference-link";

/** Legacy ethics-detail-page on the shared record frame, with tab and participant deep links. */
export function EthicsRecordShell({
  model,
  current,
  children,
  finalizeState,
  printOptions,
  canLink,
  autoSubmit,
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
}) {
  const format = useFormat();
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [saved, setSaved] = useState<boolean | null>(null);
  const fail = useActionFailure();
  const query = model.access
    ? `?access=${encodeURIComponent(model.access)}`
    : "";
  const participant = model.selectedParticipant;
  return (
    <RecordFrame
      prefix="ethics-record"
      back={{ href: "/ethics", label: model.labels.list }}
      toolbarStart={
        canLink &&
        ["ethics-general-overview", "ethics-responses"].includes(current) ? (
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
        ) : null
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
      panel={model.panel.map((c) => ({
        key: c.key,
        label: c.label,
        value: c.date ? functions.format.dateDisplay(c.value, format) : c.value,
      }))}
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
  );
}
