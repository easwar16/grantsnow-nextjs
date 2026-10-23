"use client";
import { useRouter, useSearchParams } from "next/navigation";
import { Icon } from "@/components/ui/icon";
import { Select } from "@/components/ui/select";
/** An option's tree indentation: legacy NUM_SPACES as non-breaking spaces, which option text keeps. */
export const indent = (depth: number) => " ".repeat(Math.max(0, depth));
/** The title is the org picker: a Select laid transparently over the heading and its chevron. */
export function OrganizationHeading({
  organizations,
  selected,
  fallback,
}: {
  organizations: { id: string; name: string; depth: number }[];
  selected: string;
  fallback: string;
}) {
  const router = useRouter(),
    params = useSearchParams();
  const name = organizations.find((o) => o.id === selected)?.name || fallback;
  return (
    <div id="home-organization" className="organization-heading">
      <h1>{name}</h1>
      <Icon name="chevron-down" size={18} />
      <Select
        id="home-organization-select"
        className="organization-picker"
        label="Dashboard organization"
        options={
          organizations.length
            ? organizations.map((o) => ({
                value: o.id,
                label: `${indent(o.depth)}${o.name}`,
              }))
            : [{ value: selected, label: fallback }]
        }
        value={selected}
        clearable={false}
        onChange={(organization) => {
          const next = new URLSearchParams(params.toString());
          next.set("organization", organization);
          next.delete("offset");
          router.push(`/home?${next}`, { scroll: false });
        }}
      />
    </div>
  );
}
