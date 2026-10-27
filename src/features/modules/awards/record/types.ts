import type { IconName } from "@/components/ui/icon";
import type { AwardTab } from "@/shared/awards/award-record";
import type {
  FrameCell,
  FrameLabels,
} from "@/features/record/shell/record-frame";

export interface AwardTabLink {
  tab: AwardTab;
  name: string;
  icon: IconName;
  finalized: boolean;
}
/** The award record's frame: its tabs, the record panel, finalize state and labels (all settled on the server). */
export interface AwardShellModel {
  awardId: string;
  statusCode: string;
  tabs: AwardTabLink[];
  panel: FrameCell[];
  /** Finalizable tabs (null: the list could not be read, so no switch). */
  finalizable: AwardTab[] | null;
  /** Edit Award Header: an editable draft and edit access on the header page (the lock is the tab's). */
  canEditHeader: boolean;
  /** Send to ERP: an internally approved award the user may edit (legacy showed it on IA alone). */
  canSendToErp: boolean;
  labels: FrameLabels &
    Record<"list" | "editHeader" | "save" | "cancel" | "sendToErp", string>;
}
