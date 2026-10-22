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
export function dateDisplay(value?: string, settings?: FormatSettings) {
  if (!value) return "—";
  const parts = calendarDate(value);
  if (!parts) return value;
  return (
    renderPattern(settings?.dateFormat || DEFAULT_DATE_FORMAT, parts) ??
    renderPattern(DEFAULT_DATE_FORMAT, parts)!
  );
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
