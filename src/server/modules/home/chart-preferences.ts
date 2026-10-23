import "server-only";
import { z } from "zod";
import { AppError } from "@/lib/errors";
import { fixtureMode } from "@/server/platform/configuration/environment";
import { home } from "@/server/oracle/api";
export const chartDimensions = z
  .object({
    infolet_id: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
    colspan: z.number().int().min(1).max(12),
    rowspan: z.number().int().min(1).max(3),
  })
  .strict();
// The sole write operation here is the verified personal chart-layout preference.
export async function saveChartPreference(
  body: z.infer<typeof chartDimensions>,
  signal?: AbortSignal,
) {
  chartDimensions.parse(body);
  if (fixtureMode()) return;
  // The save gives up after 15 s, as before; the client's own limit is longer.
  const deadline = signal
    ? AbortSignal.any([signal, AbortSignal.timeout(15000)])
    : AbortSignal.timeout(15000);
  try {
    await home.saveChartDimensions({ body }, { signal: deadline });
  } catch (e) {
    if (!(e instanceof AppError)) throw e;
    if (e.code === "UPSTREAM")
      throw new AppError(
        "UPSTREAM",
        "Your chart dimensions could not be saved. Please retry.",
      );
    if (e.code === "FORBIDDEN")
      throw new AppError(
        "FORBIDDEN",
        "Oracle denied this preference change.",
        403,
      );
    if (e.code === "CONTRACT")
      throw new AppError(
        "CONTRACT",
        "Oracle returned an unreadable preference response.",
      );
    throw e;
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
