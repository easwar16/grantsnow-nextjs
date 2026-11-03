/** Configured display settings (getGlobalVar DECIMAL_PLACES_COUNT / DEFAULT_DATE_FORMAT). View-only: never round stored or sent values. */
export interface FormatSettings {
  decimals?: number | null;
  dateFormat?: string;
}
