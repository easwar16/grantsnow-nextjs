import "server-only";
import { cache } from "react";
import { memo, memoKey, TTL } from "@/server/cache/memo";
import { z } from "zod";
import { authenticate } from "@/server/session/service";
import { oracle } from "@/server/api/transport";
const schema = z.object({
  items: z.array(
    z.object({
      var_key: z.string(),
      var_value: z.union([z.string(), z.number()]).nullish(),
    }),
  ),
});
export function formattingSettings(items: z.infer<typeof schema>["items"]) {
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
export type GlobalVariable = z.infer<typeof schema>["items"][number];
/** The global variables (admin configuration): formats, form and file limits, the chatbot flag share one read. */
export const globalVariables = cache(async (token: string) =>
  memo(
    memoKey("global-variables", token),
    TTL.config,
    async () =>
      schema.parse(await oracle("getPre_award_costingGetGlobalVar", { token }))
        .items,
  ),
);
export const formattingConfiguration = cache(async () =>
  formattingSettings(
    await globalVariables((await authenticate()).session.token),
  ),
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
