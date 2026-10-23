import "server-only";
import { cache } from "react";
import { configuration } from "@/server/oracle/api";
import type { GlobalVariable } from "@/server/oracle/api/configuration";
export type { GlobalVariable };
export function formattingSettings(items: GlobalVariable[]) {
  const values = Object.fromEntries(items.map((r) => [r.var_key, r.var_value]));
  const currency =
    typeof values.DEFAULT_CURRENCY_CODE === "string" &&
    /^[A-Z]{3}$/.test(values.DEFAULT_CURRENCY_CODE)
      ? values.DEFAULT_CURRENCY_CODE
      : undefined;
  const raw = values.DECIMAL_PLACES_COUNT,
    rawDecimals =
      raw === null || raw === undefined || raw === "" ? NaN : Number(raw);
  return {
    currency,
    // null = not configured; display applies legacy's `|| 2` / `|| 0` defaults.
    decimals:
      Number.isInteger(rawDecimals) && rawDecimals >= 0 && rawDecimals <= 6
        ? rawDecimals
        : null,
    dateFormat:
      typeof values.DEFAULT_DATE_FORMAT === "string" &&
      values.DEFAULT_DATE_FORMAT.trim() !== ""
        ? values.DEFAULT_DATE_FORMAT
        : "DD-MMM-YYYY",
  };
}
export type FormattingConfiguration = ReturnType<typeof formattingSettings>;
/** The global variables (admin configuration): formats, form and file limits, the chatbot flag share one read. */
export const globalVariables = cache(async (token?: string) =>
  configuration.globalVariables(undefined, token ? { token } : {}),
);
export const formattingConfiguration = cache(async () =>
  formattingSettings(await globalVariables()),
);
/** Configured display formats; legacy falls back to its defaults when global variables are unavailable. */
export async function displayFormat(): Promise<
  FormattingConfiguration | undefined
> {
  try {
    return await formattingConfiguration();
  } catch {
    return undefined;
  }
}
