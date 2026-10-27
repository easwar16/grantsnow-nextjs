import moment from "moment";
/** Configured display settings (getGlobalVar DECIMAL_PLACES_COUNT / DEFAULT_DATE_FORMAT). View-only: never round stored or sent values. */
export interface FormatSettings {
  decimals?: number | null;
  dateFormat?: string;
}
/** The viewer's IANA time zone, set by the shell, so the server can count calendar days on the viewer's day. */
export const TIME_ZONE_COOKIE = "gn-tz";
const DEFAULT_DATE_FORMAT = "DD-MMM-YYYY";
type DateParts = { year: number; month: number; day: number };
// The tokens a user can type and read back; a pattern with any other falls back to the default.
const TYPEABLE = new Set(["YYYY", "YY", "MMMM", "MMM", "MM", "M", "DD", "D"]);
const partsOf = (pattern: string) => pattern.match(/([A-Z])\1*|[^A-Z]+/g) ?? [];
/** The configured pattern as legacy applies it (`DEFAULT_DATE_FORMAT.toUpperCase()`, a moment pattern). */
function patternOf(settings?: FormatSettings) {
  const pattern = (settings?.dateFormat || DEFAULT_DATE_FORMAT).toUpperCase();
  return partsOf(pattern).every((t) => !/^[A-Z]/.test(t) || TYPEABLE.has(t))
    ? pattern
    : DEFAULT_DATE_FORMAT;
}
/** The value's leading calendar date (date-only and timestamp alike), never shifted through UTC. */
export function calendarDate(value?: string): DateParts | undefined {
  const m = value ? moment.utc(value.slice(0, 10), "YYYY-MM-DD", true) : null;
  return m?.isValid()
    ? { year: m.year(), month: m.month() + 1, day: m.date() }
    : undefined;
}
/** The configured date pattern as typed by a user, e.g. "DD-MMM-YYYY": a date field's placeholder. */
export function datePattern(settings?: FormatSettings) {
  return patternOf(settings);
}
/** Reads a date typed in the configured pattern; the ISO yyyy-mm-dd it names, or undefined when it names none. */
export function parseDisplayDate(text: string, settings?: FormatSettings) {
  // Strict to the pattern, but a one-digit day or month is accepted as users type it.
  const pattern = patternOf(settings),
    oneDigit = partsOf(pattern)
      .map((t) => (t === "DD" ? "D" : t === "MM" ? "M" : t))
      .join("");
  const m = moment.utc(text.trim(), [pattern, oneDigit], true);
  return m.isValid() ? m.format("YYYY-MM-DD") : undefined;
}
export function dateDisplay(value?: string, settings?: FormatSettings) {
  if (!value) return "—";
  if (!calendarDate(value)) return value;
  return moment
    .utc(value.slice(0, 10), "YYYY-MM-DD")
    .format(patternOf(settings));
}
/**
 * A timestamp as legacy `formatDate(value, DEFAULT_DATE_FORMAT.toUpperCase() + ' hh:mm a')`: an instant (Z or an
 * offset) in the viewer's time zone, a wall-clock value as written; anything else is shown verbatim.
 */
export function dateTimeDisplay(
  value?: string | null,
  settings?: FormatSettings,
) {
  if (!value) return "—";
  if (!/^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}/.test(value)) return value;
  const m = moment(value, moment.ISO_8601);
  return m.isValid() ? m.format(`${patternOf(settings)} hh:mm a`) : value;
}
/**
 * A timestamp as legacy's datetime converter (`DEFAULT_DATE_FORMAT + " HH:mm:ss"`): an instant in the viewer's time
 * zone, a wall-clock value as written, a bare date as a date. Call it in the browser, where the zone is the viewer's.
 */
export function stampDisplay(value?: string | null, settings?: FormatSettings) {
  if (!value) return "—";
  if (!/^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}/.test(value))
    return dateDisplay(value, settings);
  const m = moment(value, moment.ISO_8601);
  return m.isValid() ? m.format(`${patternOf(settings)} HH:mm:ss`) : value;
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
