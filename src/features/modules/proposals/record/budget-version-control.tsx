"use client";

import {
  usePathname,
  useRouter,
  useSearchParams,
  useSelectedLayoutSegment,
} from "next/navigation";
import { Select } from "@/components/ui/select";

export function BudgetVersionControl({
  options,
  activeId,
}: {
  options: { id: number; label: string }[];
  activeId: number;
}) {
  const router = useRouter();
  const path = usePathname();
  const query = useSearchParams();
  const segment = useSelectedLayoutSegment();
  const selected =
    segment === "budget"
      ? (query.get("version") ?? String(activeId))
      : String(activeId);
  return (
    <Select
      id="proposal-active-budget-version"
      label="Active Budget Version"
      options={options.map((option) => ({
        value: String(option.id),
        label: option.label,
      }))}
      value={selected}
      clearable={false}
      disabled={segment !== "budget"}
      onChange={(next) =>
        router.push(`${path}?version=${encodeURIComponent(next)}`)
      }
    />
  );
}
