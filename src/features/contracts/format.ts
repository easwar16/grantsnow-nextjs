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
