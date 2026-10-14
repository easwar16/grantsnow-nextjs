"use client";
import { useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
export function HomeFilterControls({ currentYear }: { currentYear: number }) {
  const formRef = useRef<HTMLFormElement>(null),
    focusAfterNavigation = useRef<string | undefined>(undefined);
  const router = useRouter(),
    params = useSearchParams();
  const queryKey = params.toString();
  useEffect(() => {
    if (focusAfterNavigation.current)
      document
        .getElementById(focusAfterNavigation.current)
        ?.focus({ preventScroll: true });
  }, [queryKey]);
  useEffect(() => {
    const close = (event: PointerEvent | KeyboardEvent) => {
      if (event instanceof KeyboardEvent && event.key !== "Escape") return;
      formRef.current
        ?.querySelectorAll<HTMLDetailsElement>("details[open]")
        .forEach((details) => {
          if (
            event instanceof PointerEvent &&
            details.contains(event.target as Node)
          )
            return;
          const focused = details.contains(document.activeElement);
          details.open = false;
          if (focused && event instanceof KeyboardEvent)
            details.querySelector<HTMLElement>("summary")?.focus();
        });
    };
    document.addEventListener("pointerdown", close);
    document.addEventListener("keydown", close);
    return () => {
      document.removeEventListener("pointerdown", close);
      document.removeEventListener("keydown", close);
    };
  }, []);
  const groups = [
    {
      key: "year",
      label: "Years",
      options: Array.from({ length: currentYear - 1994 }, (_, i) => ({
        value: String(currentYear - i),
        label: String(currentYear - i),
      })),
    },
    {
      key: "quarter",
      label: "Quarter",
      options: [
        "Q1 (Jan - Mar)",
        "Q2 (Apr - Jun)",
        "Q3 (Jul - Sep)",
        "Q4 (Oct - Dec)",
      ].map((label, i) => ({ value: String(i + 1), label })),
    },
    {
      key: "month",
      label: "Months",
      options: Array.from({ length: 12 }, (_, i) => ({
        value: String(i + 1),
        label: new Intl.DateTimeFormat("en", {
          month: "long",
          timeZone: "UTC",
        }).format(new Date(Date.UTC(2026, i, 1))),
      })),
    },
  ];
  function apply(form: HTMLFormElement) {
    const values = new FormData(form),
      next = new URLSearchParams(params.toString());
    next.delete("offset");
    for (const { key } of groups) {
      const selected = values.getAll(key).map(String);
      if (selected.length) next.set(key, selected.join(","));
      else next.delete(key);
    }
    router.push(`/home?${next}`, { scroll: false });
  }
  return (
    <form
      ref={formRef}
      className="insight-filters"
      onChange={(e) => {
        if (e.target instanceof HTMLInputElement)
          focusAfterNavigation.current = e.target.id;
        apply(e.currentTarget);
      }}
      onSubmit={(e) => {
        e.preventDefault();
        apply(e.currentTarget);
      }}
    >
      {groups.map((group) => {
        const selected = (params.get(group.key) || "")
          .split(",")
          .filter(Boolean);
        return (
          <details className="insight-filter" key={group.key}>
            <summary aria-label={`${group.label} filter`}>
              <span className={selected.length ? "filter-caption" : ""}>
                {group.label}
              </span>
              {selected.length > 0 && (
                <span className="filter-values">
                  {group.options
                    .filter((o) => selected.includes(o.value))
                    .map((o) => o.label)
                    .join(", ")}
                </span>
              )}
            </summary>
            <fieldset>
              <legend className="sr-only">{group.label}</legend>
              {group.options.map((option) => (
                <label key={`${option.value}:${params.toString()}`}>
                  <input
                    id={`insight-${group.key}-${option.value}`}
                    type="checkbox"
                    name={group.key}
                    value={option.value}
                    defaultChecked={selected.includes(option.value)}
                  />
                  {option.label}
                </label>
              ))}
            </fieldset>
          </details>
        );
      })}
      {groups.some((g) => params.has(g.key)) && (
        <button
          type="button"
          className="insight-clear"
          aria-label="Clear insights filters"
          onClick={() => {
            const next = new URLSearchParams(params.toString());
            for (const { key } of groups) next.delete(key);
            router.push(`/home?${next}`, { scroll: false });
          }}
        >
          ×
        </button>
      )}
    </form>
  );
}
