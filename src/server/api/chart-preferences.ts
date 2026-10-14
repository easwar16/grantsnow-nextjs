import "server-only";
import { z } from "zod";
import { AppError } from "@/lib/errors";
import {
  fixtureMode,
  oracleSettings,
} from "@/server/configuration/environment";
import { assertBusiness } from "./transport";
export const chartDimensions = z
  .object({
    infolet_id: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
    colspan: z.number().int().min(1).max(12),
    rowspan: z.number().int().min(1).max(12),
  })
  .strict();
// The sole write operation here is the verified personal chart-layout preference.
export async function saveChartPreference(
  token: string,
  body: z.infer<typeof chartDimensions>,
  signal?: AbortSignal,
) {
  chartDimensions.parse(body);
  if (fixtureMode()) return;
  const config = oracleSettings();
  let response: Response;
  try {
    response = await fetch(new URL("shared/saveDynamicCharts", config.apps), {
      method: "POST",
      headers: {
        token,
        "Content-Type": "application/json",
        Accept: "application/json",
        ...(config.authorization
          ? { Authorization: config.authorization }
          : {}),
      },
      body: JSON.stringify(body),
      cache: "no-store",
      redirect: "error",
      signal: signal
        ? AbortSignal.any([signal, AbortSignal.timeout(15000)])
        : AbortSignal.timeout(15000),
    });
  } catch {
    throw new AppError(
      "UPSTREAM",
      "Your chart dimensions could not be saved. Please retry.",
    );
  }
  if (response.status === 401)
    throw new AppError("EXPIRED", "Your session has expired.", 401);
  if (response.status === 403)
    throw new AppError(
      "FORBIDDEN",
      "Oracle denied this preference change.",
      403,
    );
  if (!response.ok)
    throw new AppError(
      "UPSTREAM",
      "Oracle could not save your chart dimensions.",
    );
  const text = await response.text();
  if (text.trim()) {
    let body: unknown;
    try {
      body = JSON.parse(text);
    } catch {
      throw new AppError(
        "CONTRACT",
        "Oracle returned an unreadable preference response.",
      );
    }
    assertBusiness(body);
  }
}
export function safeChartReport(value: string | undefined, origin: string) {
  if (!value) return undefined;
  try {
    const url = new URL(value);
    if (
      url.protocol !== "https:" ||
      url.origin !== origin ||
      url.username ||
      url.password ||
      !/^\/ords\/r\/[a-z0-9_-]+\/[a-z0-9_-]+\/report-result\/?$/i.test(
        url.pathname,
      ) ||
      url.hash
    )
      return undefined;
    const entries = [...url.searchParams];
    if (
      entries.length !== 1 ||
      !/^p\d+_report_id$/.test(entries[0][0]) ||
      !/^[1-9]\d{0,14}$/.test(entries[0][1])
    )
      return undefined;
    return url.href;
  } catch {
    return undefined;
  }
}
