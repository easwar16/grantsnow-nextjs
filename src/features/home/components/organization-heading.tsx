"use client";
import { useRouter, useSearchParams } from "next/navigation";
import { Icon } from "@/components/ui/icon";
/** An option's tree indentation: legacy NUM_SPACES as non-breaking spaces, which option text keeps. */
export const indent = (depth: number) => " ".repeat(Math.max(0, depth));
/** The title is the org picker: a native select laid transparently over the heading and its chevron. */
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
      <select
        id="home-organization-select"
        aria-label="Dashboard organization"
        value={selected}
        onChange={(e) => {
          const next = new URLSearchParams(params.toString());
          next.set("organization", e.target.value);
          next.delete("offset");
          router.push(`/home?${next}`, { scroll: false });
        }}
      >
        {organizations.length ? (
          organizations.map((o) => (
            <option key={o.id} value={o.id}>
              {`${indent(o.depth)}${o.name}`}
            </option>
          ))
        ) : (
          <option value={selected}>{fallback}</option>
        )}
      </select>
    </div>
  );
}
