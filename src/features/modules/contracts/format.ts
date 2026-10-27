import type { StatusTone } from "@/components/ui/status-badge";
import { dateDisplay, type FormatSettings } from "@/lib/format";

/** VBCS Signers uses an oj-input-date-time pattern ending in `hh:mm:ss` without an AM/PM marker. */
export function contractSignerStamp(value: string, format?: FormatSettings) {
  if (!value || Number.isNaN(Date.parse(value))) return value;
  const instant = new Date(value);
  const date = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(instant);
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Kolkata",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h12",
  }).formatToParts(instant);
  const part = (type: string) =>
    parts.find((item) => item.type === type)?.value;
  return `${dateDisplay(date, format)} ${part("hour")}:${part("minute")}:${part("second")}`;
}

/**
 * Legacy contracts-start-page badge tones. Its class object named oj-badge-success twice, so only SUBMIT_SIGN kept it
 * and SIGNED fell back to the plain badge; both are success here, as intended, and so is SUB, the code DEV returns
 * for "Submitted for Signing".
 */
export const CONTRACT_STATUS_TONE: Record<string, StatusTone> = {
  IA: "info",
  REJ: "danger",
  AIA: "warning",
  SIGNED: "success",
  SUBMIT_SIGN: "success",
  SUB: "success",
};
