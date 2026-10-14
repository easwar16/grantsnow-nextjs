"use client";
import { useState } from "react";
import Link from "next/link";
import type { AttentionRow } from "../types";
export function DeadlineCalendar({
  rows,
  hasMore,
}: {
  rows: AttentionRow[];
  hasMore: boolean;
}) {
  const [month, setMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const count = new Date(
    month.getFullYear(),
    month.getMonth() + 1,
    0,
  ).getDate();
  const prefix = `${month.getFullYear()}-${String(month.getMonth() + 1).padStart(2, "0")}-`;
  return (
    <div className="deadline-calendar">
      <div className="calendar-toolbar">
        <button
          aria-label="Previous calendar month"
          onClick={() =>
            setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))
          }
        >
          ‹
        </button>
        <h3>
          {new Intl.DateTimeFormat("en-GB", {
            month: "long",
            year: "numeric",
          }).format(month)}
        </h3>
        <button
          aria-label="Next calendar month"
          onClick={() =>
            setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))
          }
        >
          ›
        </button>
      </div>
      {hasMore && (
        <p className="notice">
          Calendar shows the loaded records. Load further records in List View
          to view their deadlines.
        </p>
      )}
      <div className="calendar-grid">
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
          <strong key={day}>{day}</strong>
        ))}
        {Array.from({ length: month.getDay() }, (_, i) => (
          <div key={`blank-${i}`} />
        ))}
        {Array.from({ length: count }, (_, i) => {
          const day = i + 1,
            date = `${prefix}${String(day).padStart(2, "0")}`;
          return (
            <div className="calendar-day" key={date}>
              <time dateTime={date}>{day}</time>
              {rows
                .filter((r) => r.date?.slice(0, 10) === date)
                .map((r) =>
                  r.href ? (
                    <Link
                      key={r.id}
                      href={r.href}
                      prefetch={false}
                      title={r.title}
                    >
                      {r.reference}
                    </Link>
                  ) : (
                    <span key={r.id} title={r.title}>
                      {r.reference}
                    </span>
                  ),
                )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
