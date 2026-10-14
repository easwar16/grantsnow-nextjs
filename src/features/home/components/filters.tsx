"use client";
import { useRouter, useSearchParams } from "next/navigation";
export function HomeFilterControls({
  organizations,
  defaultOrganization,
}: {
  organizations: { id: string; name: string }[];
  defaultOrganization: string;
}) {
  const router = useRouter(),
    params = useSearchParams();
  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget),
      next = new URLSearchParams();
    for (const [k, v] of form.entries()) if (v) next.set(k, String(v));
    router.push(`/home?${next}`, { scroll: false });
  }
  return (
    <form className="home-filters" onSubmit={submit} key={params.toString()}>
      <label>
        Organization
        <select
          name="organization"
          defaultValue={params.get("organization") || defaultOrganization}
        >
          {organizations.map((o) => (
            <option key={o.id} value={o.id}>
              {o.name}
            </option>
          ))}
        </select>
      </label>
      <label>
        Year
        <input
          name="year"
          type="number"
          min={1900}
          max={9999}
          placeholder="All years"
          defaultValue={params.get("year") || ""}
        />
      </label>
      <label>
        Quarter
        <select name="quarter" defaultValue={params.get("quarter") || ""}>
          <option value="">All quarters</option>
          {[1, 2, 3, 4].map((n) => (
            <option key={n} value={n}>
              Q{n}
            </option>
          ))}
        </select>
      </label>
      <label>
        Month
        <select name="month" defaultValue={params.get("month") || ""}>
          <option value="">All months</option>
          {Array.from({ length: 12 }, (_, i) => (
            <option key={i} value={i + 1}>
              {new Intl.DateTimeFormat("en", {
                month: "long",
                timeZone: "UTC",
              }).format(new Date(Date.UTC(2026, i, 1)))}
            </option>
          ))}
        </select>
      </label>
      <button type="submit" className="primary">
        Apply
      </button>
      <button
        type="button"
        onClick={() => router.push("/home", { scroll: false })}
      >
        Reset
      </button>
    </form>
  );
}
