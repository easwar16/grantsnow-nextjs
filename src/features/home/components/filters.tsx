"use client";
import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Icon } from "@/components/ui/icon";
import { MultiSelect } from "@/components/ui/multi-select";
import {
  QUARTERS,
  monthOptions,
  pruneMonths,
  yearOptions,
} from "../insight-filters";
type FilterKey = "year" | "quarter" | "month";
/** Insights Years / Quarter / Months filters; each change goes straight into the URL, as legacy applied it at once. */
export function HomeFilterControls({
  currentYear,
  labels,
}: {
  currentYear: number;
  /** RB `labels.years`, `labels.quarter`, `labels.months`. */
  labels: Record<FilterKey, string>;
}) {
  const router = useRouter(),
    params = useSearchParams();
  // The URL only changes once Home re-renders on the server (slow on DEV), so ticks show from local state at once.
  const fromUrl = () =>
    new URLSearchParams(
      ["year", "quarter", "month"].flatMap((k) =>
        params.has(k) ? [[k, params.get(k) ?? ""]] : [],
      ),
    );
  const [draft, setDraft] = useState(fromUrl);
  const [syncedUrl, setSyncedUrl] = useState(params.toString());
  if (syncedUrl !== params.toString()) {
    setSyncedUrl(params.toString());
    setDraft(fromUrl());
  }
  const selected = (key: FilterKey) =>
    (draft.get(key) || "").split(",").filter(Boolean);
  function apply(changes: Partial<Record<FilterKey, string[]>>) {
    const local = new URLSearchParams(draft.toString());
    for (const [k, values] of Object.entries(changes))
      if (values.length) local.set(k, values.join(","));
      else local.delete(k);
    setDraft(local);
    const next = new URLSearchParams(params.toString());
    next.delete("offset");
    for (const [key, values] of Object.entries(changes))
      if (values.length) next.set(key, values.join(","));
      else next.delete(key);
    router.push(`/home?${next}`, { scroll: false });
  }
  const quarters = selected("quarter");
  return (
    <div className="insight-filters">
      <MultiSelect
        className="insight-filter"
        label={labels.year}
        options={yearOptions(currentYear)}
        value={selected("year")}
        onChange={(year) => apply({ year })}
      />
      <MultiSelect
        className="insight-filter"
        label={labels.quarter}
        options={QUARTERS}
        value={quarters}
        onChange={(quarter) =>
          apply({ quarter, month: pruneMonths(selected("month"), quarter) })
        }
      />
      <MultiSelect
        className="insight-filter"
        label={labels.month}
        options={monthOptions(quarters)}
        value={selected("month")}
        onChange={(month) => apply({ month })}
      />
      {(["year", "quarter", "month"] as const).some((k) => draft.has(k)) && (
        <button
          type="button"
          className="insight-clear"
          aria-label="Clear insights filters"
          onClick={() => apply({ year: [], quarter: [], month: [] })}
        >
          <Icon name="close" />
        </button>
      )}
    </div>
  );
}
