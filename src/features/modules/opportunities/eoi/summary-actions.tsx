"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/ui/icon";
import { useInFlight } from "@/lib/hooks/use-in-flight";
import { useConfirm } from "../../../../components/dialog/action-dialog";
import {
  ConvertDialog,
  warmConvert,
  type ConvertKind,
} from "../components/actions/convert-dialog";
import { nearDeadline } from "../components/actions/duration";
import { opportunities } from "@/lib/api";
import { useActionFailure } from "../../../../components/dialog/action-failure";
import type { SummaryActionContext, SummaryView } from "./types";
import styles from "./summary.module.css";
/** More Info's actions: each after the deadline warning; Apply opens the new application's form. */
export function SummaryActions({
  actions,
  context,
}: {
  actions: SummaryView["actions"];
  context: SummaryActionContext;
}) {
  const router = useRouter(),
    { run, isActive } = useInFlight(),
    { ask, element: confirmation } = useConfirm("eoi-summary-deadline"),
    fail = useActionFailure(),
    [converting, setConverting] = useState<ConvertKind | null>(null),
    { texts } = context;
  const deadlineOk = () =>
    !nearDeadline(context.closingAt, context.deadlineWarningDays) ||
    ask({
      title: texts.deadlineTitle,
      message: texts.deadlineMessage,
      detail: `${texts.closingDate}: ${context.closingDisplay ?? ""}`,
      confirm: texts.continue,
      cancel: texts.cancel,
    });
  const apply = () =>
    run(async () => {
      if (!(await deadlineOk())) return;
      const result = await opportunities.apply({
        opportunityId: Number(context.opportunityId),
        tab: "application",
      });
      if (!result.ok) return fail(result.error);
      router.push(result.data.href);
    }, "apply");
  const warm = (kind: ConvertKind) =>
    warmConvert("finder", kind, context.opportunityId);
  const convert = (kind: ConvertKind) =>
    run(async () => {
      // The setup loads while the deadline warning is read.
      warm(kind);
      if (await deadlineOk()) setConverting(kind);
    }, "convert");
  return (
    <div id="eoi-summary-actions" className={styles.buttons}>
      {actions.apply && (
        <button
          type="button"
          id="eoi-summary-apply"
          className="gn-btn gn-btn--outlined"
          disabled={isActive("apply")}
          onClick={apply}
        >
          <Icon name="chevron-double-right" size={14} />
          {actions.apply}
        </button>
      )}
      {actions.convert && (
        <button
          type="button"
          id="eoi-summary-convert"
          className="gn-btn gn-btn--primary"
          disabled={isActive("convert") || converting !== null}
          onPointerEnter={() => warm("OUTLINE_PROPOSAL")}
          onFocus={() => warm("OUTLINE_PROPOSAL")}
          onClick={() => convert("OUTLINE_PROPOSAL")}
        >
          <Icon name="workflow" size={14} />
          {actions.convert}
        </button>
      )}
      {actions.convertToProposal && (
        <button
          type="button"
          id="eoi-summary-convert-to-proposal"
          className="gn-btn gn-btn--primary"
          disabled={isActive("convert") || converting !== null}
          onPointerEnter={() => warm("PROPOSAL")}
          onFocus={() => warm("PROPOSAL")}
          onClick={() => convert("PROPOSAL")}
        >
          <Icon name="workflow" size={14} />
          {actions.convertToProposal}
        </button>
      )}
      {confirmation}
      {converting && (
        <ConvertDialog
          id="eoi-summary-convert-dialog"
          opener="finder"
          kind={converting}
          opportunityId={context.opportunityId}
          onClose={() => setConverting(null)}
        />
      )}
    </div>
  );
}
