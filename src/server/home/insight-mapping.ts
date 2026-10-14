import "server-only";
import { z } from "zod";
import { AppError } from "@/lib/errors";
import type { StatisticRow } from "@/features/home/types";
export function insightRows(
  items: Record<string, unknown>[],
  mapping?: string,
): StatisticRow[] {
  const number = (v: unknown) => {
    if (
      v === null ||
      v === undefined ||
      v === "" ||
      !["string", "number"].includes(typeof v) ||
      !Number.isFinite(Number(v))
    )
      throw new AppError(
        "CONTRACT",
        "Insights returned an invalid numeric value.",
      );
    return Number(v);
  };
  const text = (v: unknown) =>
    typeof v === "string" || typeof v === "number" ? String(v) : "";
  return items.flatMap((r, i) => {
    if (mapping === "scatter")
      return [
        {
          id: String(r.RN ?? i),
          label: text(r.x),
          series: text(r.x),
          value: number(r.Y),
        },
      ];
    if (mapping === "top-category")
      return [
        {
          id: `${i}:a`,
          label: text(r.SECTORS),
          series: "Awarded Proposals",
          value: number(r.NUM_PROP),
        },
        {
          id: `${i}:b`,
          label: text(r.SECTORS),
          series: "Awarded Amount",
          value: number(r.AMOUNT),
        },
      ];
    if (mapping === "category" || mapping === "gap") {
      const applied = number(r.APPLIED_AMT),
        awarded = number(r.AWARDED_AMT),
        label = text(r.SECTORS);
      return [
        {
          id: `${i}:a`,
          label,
          series:
            mapping === "gap" ? "Total Awarded Amount" : "Total Applied Amount",
          value: mapping === "gap" ? awarded : applied,
        },
        {
          id: `${i}:b`,
          label,
          series:
            mapping === "gap"
              ? "Gap (Applied - Awarded)"
              : "Total Awarded Amount",
          value: mapping === "gap" ? applied - awarded : awarded,
        },
      ];
    }
    if (mapping === "funnel")
      return [
        {
          id: String(r.display_order ?? i),
          label: text(r.label_txt),
          value: number(r.amount),
        },
      ];
    return [
      {
        id: `${text(r.label)}:${text(r.code ?? r.seriesid)}:${i}`,
        label: text(r.label),
        series: text(r.code ?? r.seriesid) || undefined,
        value: number(r.value),
      },
    ];
  });
}
export function fundingEfficiency(raw: unknown) {
  const candidate = z
    .array(z.object({ widget_name: z.string() }).passthrough())
    .parse(raw)
    .find((r) => r.widget_name === "DASHBOARD_FEI");
  if (!candidate) return undefined;
  const row = z
    .object({
      widget_value: z
        .union([z.number(), z.string().min(1)])
        .transform(Number)
        .refine(Number.isFinite),
      parameters: z.array(
        z.object({
          param: z.string(),
          param_value: z.union([z.number(), z.string().min(1)]),
        }),
      ),
    })
    .parse(candidate);
  const params = Object.fromEntries(
    row.parameters.map((p) => [p.param, Number(p.param_value)]),
  );
  if (
    !Number.isFinite(params.FEI_TARGET) ||
    params.FEI_TARGET <= 0 ||
    !Number.isFinite(params.FEI_LOW) ||
    !Number.isFinite(params.FEI_MEDIUM)
  )
    throw new AppError(
      "CONTRACT",
      "Funding efficiency targets are missing or invalid.",
    );
  return {
    value: row.widget_value,
    low: params.FEI_LOW,
    medium: params.FEI_MEDIUM,
    target: params.FEI_TARGET,
  };
}
