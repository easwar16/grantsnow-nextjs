"use client";
import { useRouter, useSearchParams } from "next/navigation";
export function OrganizationHeading({
  organizations,
  selected,
  fallback,
}: {
  organizations: { id: string; name: string }[];
  selected: string;
  fallback: string;
}) {
  const router = useRouter(),
    params = useSearchParams();
  return (
    <h1
      className="organization-heading"
      aria-label={
        organizations.find((o) => o.id === selected)?.name || fallback
      }
    >
      <label>
        <span className="sr-only">Dashboard organization</span>
        <select
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
                {o.name}
              </option>
            ))
          ) : (
            <option value={selected}>{fallback}</option>
          )}
        </select>
      </label>
    </h1>
  );
}
