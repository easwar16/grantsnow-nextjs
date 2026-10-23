/** Configured display settings (getGlobalVar DECIMAL_PLACES_COUNT / DEFAULT_DATE_FORMAT). View-only: never round stored or sent values. */
export interface FormatSettings {
  decimals?: number | null;
  dateFormat?: string;
}
const DEFAULT_DATE_FORMAT = "DD-MMM-YYYY";
// moment's English month names, as legacy formatDate renders them.
const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];
type DateParts = { year: number; month: number; day: number };
const tokens: Record<string, (d: DateParts) => string> = {
  YYYY: (d) => String(d.year).padStart(4, "0"),
  YY: (d) => String(d.year % 100).padStart(2, "0"),
  MMMM: (d) => MONTHS[d.month - 1],
  MMM: (d) => MONTHS[d.month - 1].slice(0, 3),
  MM: (d) => String(d.month).padStart(2, "0"),
  M: (d) => String(d.month),
  DD: (d) => String(d.day).padStart(2, "0"),
  D: (d) => String(d.day),
};
/** Renders legacy's `DEFAULT_DATE_FORMAT.toUpperCase()` moment pattern; undefined when it holds a token we do not support. */
function renderPattern(pattern: string, d: DateParts) {
  let out = "";
  for (const part of pattern.toUpperCase().match(/([A-Z])\1*|[^A-Z]+/g) ?? []) {
    if (/^[A-Z]/.test(part)) {
      const token = tokens[part];
      if (!token) return undefined;
      out += token(d);
    } else out += part;
  }
  return out;
}
/** The value's leading calendar date (date-only and timestamp alike), never shifted through UTC. */
export function calendarDate(value?: string): DateParts | undefined {
  const match = value?.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return undefined;
  const [year, month, day] = match.slice(1).map(Number);
  const check = new Date(Date.UTC(year, month - 1, day));
  return check.getUTCMonth() === month - 1 && check.getUTCDate() === day
    ? { year, month, day }
    : undefined;
}
/** The configured date pattern as typed by a user, e.g. "DD-MMM-YYYY": a date field's placeholder. */
export function datePattern(settings?: FormatSettings) {
  const pattern = (settings?.dateFormat || DEFAULT_DATE_FORMAT).toUpperCase();
  return renderPattern(pattern, { year: 2000, month: 1, day: 1 })
    ? pattern
    : DEFAULT_DATE_FORMAT;
}
const PARSERS: Record<string, [string, (v: string, d: DateParts) => void]> = {
  YYYY: ["(\\d{4})", (v, d) => (d.year = Number(v))],
  YY: ["(\\d{2})", (v, d) => (d.year = 2000 + Number(v))],
  MMMM: ["([a-z]+)", (v, d) => (d.month = monthOf(v, 0))],
  MMM: ["([a-z]{3})", (v, d) => (d.month = monthOf(v, 3))],
  MM: ["(\\d{1,2})", (v, d) => (d.month = Number(v))],
  M: ["(\\d{1,2})", (v, d) => (d.month = Number(v))],
  DD: ["(\\d{1,2})", (v, d) => (d.day = Number(v))],
  D: ["(\\d{1,2})", (v, d) => (d.day = Number(v))],
};
// A month name, whole or as its first `length` letters (0: whole); 0 when unknown.
const monthOf = (name: string, length: number) =>
  MONTHS.findIndex(
    (m) =>
      (length ? m.slice(0, length) : m).toLowerCase() === name.toLowerCase(),
  ) + 1;
/** Reads a date typed in the configured pattern; the ISO yyyy-mm-dd it names, or undefined when it names none. */
export function parseDisplayDate(text: string, settings?: FormatSettings) {
  const setters: ((v: string, d: DateParts) => void)[] = [];
  let source = "";
  for (const part of datePattern(settings).match(/([A-Z])\1*|[^A-Z]+/g) ?? []) {
    const parser = PARSERS[part];
    if (parser) {
      source += parser[0];
      setters.push(parser[1]);
    } else source += part.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }
  const match = text.trim().match(new RegExp(`^${source}$`, "i"));
  if (!match) return undefined;
  const parts: DateParts = { year: 0, month: 0, day: 0 };
  setters.forEach((set, i) => set(match[i + 1], parts));
  const iso = `${String(parts.year).padStart(4, "0")}-${String(parts.month).padStart(2, "0")}-${String(parts.day).padStart(2, "0")}`;
  return calendarDate(iso) ? iso : undefined;
}
export function dateDisplay(value?: string, settings?: FormatSettings) {
  if (!value) return "—";
  const parts = calendarDate(value);
  if (!parts) return value;
  return (
    renderPattern(settings?.dateFormat || DEFAULT_DATE_FORMAT, parts) ??
    renderPattern(DEFAULT_DATE_FORMAT, parts)!
  );
}
const pad = (n: number) => String(n).padStart(2, "0");
/**
 * A timestamp as legacy `formatDate(value, DEFAULT_DATE_FORMAT.toUpperCase() + ' hh:mm a')`: an instant (Z or an
 * offset) in the viewer's time zone, a wall-clock value as written; anything else is shown verbatim.
 */
export function dateTimeDisplay(
  value?: string | null,
  settings?: FormatSettings,
) {
  if (!value) return "—";
  let parts: DateParts | undefined, hours: number, minutes: number;
  if (/(?:Z|[+-]\d{2}:?\d{2})$/i.test(value)) {
    const at = new Date(value);
    if (Number.isNaN(at.getTime())) return value;
    parts = {
      year: at.getFullYear(),
      month: at.getMonth() + 1,
      day: at.getDate(),
    };
    [hours, minutes] = [at.getHours(), at.getMinutes()];
  } else {
    const time = value.match(/^\d{4}-\d{2}-\d{2}[T ](\d{2}):(\d{2})/);
    parts = time ? calendarDate(value) : undefined;
    if (!time || !parts) return value;
    [hours, minutes] = [Number(time[1]), Number(time[2])];
  }
  const date =
    renderPattern(settings?.dateFormat || DEFAULT_DATE_FORMAT, parts) ??
    renderPattern(DEFAULT_DATE_FORMAT, parts)!;
  return `${date} ${pad(hours % 12 || 12)}:${pad(minutes)} ${hours < 12 ? "am" : "pm"}`;
}
export function moneyDisplay(
  value?: string,
  currency?: string,
  settings?: FormatSettings,
) {
  if (value == null || value === "") return "—";
  const n = Number(value);
  if (!Number.isFinite(n)) return value; // Preserve backend masking verbatim.
  // Legacy formatCurrency: min = DECIMAL_PLACES_COUNT || 0, max = DECIMAL_PLACES_COUNT || 2.
  const maximumFractionDigits = settings?.decimals || 2;
  if (!currency || !/^[A-Z]{3}$/.test(currency))
    return new Intl.NumberFormat("en-GB", { maximumFractionDigits }).format(n);
  try {
    return new Intl.NumberFormat("en-GB", {
      style: "currency",
      currency,
      ...(settings
        ? {
            minimumFractionDigits: settings.decimals || 0,
            maximumFractionDigits,
          }
        : {}),
    }).format(n);
  } catch {
    return `${value} ${currency}`;
  }
}
