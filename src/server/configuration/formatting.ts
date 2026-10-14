import "server-only";
import { cache } from "react";
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
export const formattingConfiguration = cache(async () => {
  const { session } = await authenticate();
  const b = schema.parse(
    await oracle("getPre_award_costingGetGlobalVar", { token: session.token }),
  );
  const values = Object.fromEntries(
    b.items.map((r) => [r.var_key, r.var_value]),
  );
  const currency =
    typeof values.DEFAULT_CURRENCY_CODE === "string" &&
    /^[A-Z]{3}$/.test(values.DEFAULT_CURRENCY_CODE)
      ? values.DEFAULT_CURRENCY_CODE
      : undefined;
  const rawDecimals = Number(values.DECIMAL_PLACES_COUNT);
  return {
    currency,
    decimals:
      Number.isInteger(rawDecimals) && rawDecimals >= 0 && rawDecimals <= 6
        ? rawDecimals
        : 2,
    dateFormat:
      typeof values.DEFAULT_DATE_FORMAT === "string"
        ? values.DEFAULT_DATE_FORMAT
        : "DD-MMM-YYYY",
  };
});
