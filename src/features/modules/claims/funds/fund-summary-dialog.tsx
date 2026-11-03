"use client";
import { useEffect, useEffectEvent, useState } from "react";
import { Skeleton } from "@/components/feedback/skeleton";
import { useToast } from "@/components/feedback/toast";
import { ActionDialog } from "@/components/dialog/action-dialog";
import type { ActionError } from "@/components/dialog/action-failure";
import type { FormatSettings } from "@/lib/format";
import { claims } from "@/lib/api";
import type { FundRow, FundSummary } from "./types";
import { FundSummaryTable } from "./fund-summary-table";

/** Legacy summaryDialog: a fund's budget against claims per function and object code. */
export function FundSummaryDialog({
  id,
  fund,
  format,
  onClose,
}: {
  id: string;
  fund: FundRow;
  format?: FormatSettings & { currency?: string };
  onClose: () => void;
}) {
  const [summary, setSummary] = useState<FundSummary>(),
    toast = useToast();
  const failed = useEffectEvent((error: ActionError) => {
    toast.error(error);
    onClose();
  });
  useEffect(() => {
    let live = true;
    claims.fundSummary(fund.id, fund.fiscalYear).then((r) => {
      if (!live) return;
      if (!r.ok) return failed(r.error);
      setSummary(r.data);
    });
    return () => {
      live = false;
    };
  }, [fund.id, fund.fiscalYear]);
  if (!summary)
    return (
      <ActionDialog id={id} title="" width="75vw" onClose={onClose}>
        <Skeleton kind="table" count={4} label="Loading the fund summary" />
      </ActionDialog>
    );
  return (
    <ActionDialog
      id={id}
      title={summary.title}
      width="75vw" /* legacy summaryDialog width: 75vw */
      onClose={onClose}
    >
      <FundSummaryTable
        id={`${id}-table`}
        summary={summary}
        format={format}
        height="dialog"
      />
    </ActionDialog>
  );
}
